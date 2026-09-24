import fs from 'fs';
import { db, DriveTokens } from './db.js';

export const CATEGORIES = ['Mathematics', 'Science', 'English', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export class DriveService {
  /**
   * Exchanges authorization code for access and refresh tokens.
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<DriveTokens> {
    const config = db.getConfig();
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Google Client ID and Client Secret must be configured.');
    }

    const params = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange error:', tokenRes.status, errText);
      throw new Error(`Failed to exchange token with Google: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!refreshToken) {
      // If user had previously authorized without prompt=consent, Google might omit refresh token.
      // We check if we already had a stored refresh token.
      const existing = db.getTokens();
      if (!existing?.refresh_token) {
        throw new Error(
          'No refresh token received from Google. Please ensure prompt=consent is used when connecting.'
        );
      }
    }

    // Fetch user info to detect the authenticated Google account
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Google user profile.');
    }

    const userData = await userRes.json();

    const existingTokens = db.getTokens();
    const finalRefreshToken = refreshToken || existingTokens?.refresh_token || '';

    const tokens: DriveTokens = {
      access_token: accessToken,
      refresh_token: finalRefreshToken,
      expiry_date: Date.now() + (expiresIn - 60) * 1000,
      user_email: userData.email,
      user_name: userData.name || userData.email,
      user_picture: userData.picture || '',
      connected_at: new Date().toISOString(),
    };

    // Save initial tokens
    db.saveTokens(tokens);

    // Initialize root folder 'PrivateTeacherVideos' and category folders
    await this.initializeFolderHierarchy();

    return db.getTokens()!;
  }

  /**
   * Sets or updates active session access token and initializes folders.
   */
  async setSessionToken(
    accessToken: string,
    user: { email: string; name: string; picture?: string }
  ): Promise<DriveTokens> {
    let email = user.email;
    let name = user.name;
    let picture = user.picture || '';

    try {
      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        email = userData.email || email;
        name = userData.name || name;
        picture = userData.picture || picture;
      }
    } catch (e) {
      console.warn('Could not fetch userinfo directly, using provided profile', e);
    }

    const existing = db.getTokens();
    const tokens: DriveTokens = {
      access_token: accessToken,
      refresh_token: existing?.refresh_token || '',
      expiry_date: Date.now() + 3500 * 1000,
      user_email: email,
      user_name: name,
      user_picture: picture,
      connected_at: new Date().toISOString(),
    };

    db.saveTokens(tokens);
    await this.initializeFolderHierarchy();
    return db.getTokens()!;
  }

  /**
   * Retrieves a valid access token, automatically refreshing if expired or expiring soon.
   */
  async getValidAccessToken(): Promise<string> {
    const tokens = db.getTokens();
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      throw new Error('Google Drive is not connected. Please connect via Admin Settings.');
    }

    // Refresh if we have a refresh token and token is near expiry
    if (tokens.refresh_token && tokens.expiry_date && Date.now() > tokens.expiry_date - 120000) {
      try {
        return await this.refreshAccessToken();
      } catch (e) {
        if (tokens.access_token) return tokens.access_token;
        throw e;
      }
    }

    return tokens.access_token;
  }

  /**
   * Refreshes the access token using the stored server-side refresh token.
   */
  async refreshAccessToken(): Promise<string> {
    const tokens = db.getTokens();
    const config = db.getConfig();

    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available to refresh access token.');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Google OAuth credentials not configured.');
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to refresh Google token:', res.status, errText);
      throw new Error('Google Drive session expired. Please reconnect in Admin Settings.');
    }

    const data = await res.json();
    tokens.access_token = data.access_token;
    tokens.expiry_date = Date.now() + (data.expires_in || 3600) * 1000;
    if (data.refresh_token) {
      tokens.refresh_token = data.refresh_token;
    }

    db.saveTokens(tokens);
    return tokens.access_token;
  }

  /**
   * Ensures 'PrivateTeacherVideos' root folder and category folders exist in Google Drive.
   */
  async initializeFolderHierarchy(): Promise<{
    rootFolderId: string;
    categoryFolders: Record<string, string>;
  }> {
    const accessToken = await this.getValidAccessToken();
    const config = db.getConfig();
    const tokens = db.getTokens()!;

    let rootFolderId = config.rootFolderId || tokens.root_folder_id || '';

    // If no root folder ID stored, check or create 'PrivateTeacherVideos'
    if (!rootFolderId) {
      rootFolderId = await this.findOrCreateFolder(accessToken, 'PrivateTeacherVideos');
      tokens.root_folder_id = rootFolderId;
      tokens.root_folder_name = 'PrivateTeacherVideos';
    }

    // Now ensure category folders exist inside 'PrivateTeacherVideos'
    const categoryFolders: Record<string, string> = { ...(tokens.category_folders || {}) };

    for (const cat of CATEGORIES) {
      if (!categoryFolders[cat]) {
        const catFolderId = await this.findOrCreateFolder(accessToken, cat, rootFolderId);
        categoryFolders[cat] = catFolderId;
      }
    }

    tokens.category_folders = categoryFolders;
    db.saveTokens(tokens);

    return {
      rootFolderId,
      categoryFolders,
    };
  }

  /**
   * Helper to find an existing folder or create one.
   */
  private async findOrCreateFolder(
    accessToken: string,
    folderName: string,
    parentId?: string
  ): Promise<string> {
    // Search query
    let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }

    const searchUrl = `${GOOGLE_DRIVE_API_BASE}/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const result = await searchRes.json();
      if (result.files && result.files.length > 0) {
        return result.files[0].id;
      }
    }

    // Not found, create it
    const body: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      body.parents = [parentId];
    }

    const createRes = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?fields=id,name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error(`Failed to create Drive folder ${folderName}:`, err);
      throw new Error(`Failed to create Google Drive folder "${folderName}": ${err}`);
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Uploads a video file buffer/stream to Google Drive into the appropriate category folder.
   */
  async uploadVideo(options: {
    fileName: string;
    mimeType: string;
    category: Category;
    buffer: Buffer;
  }): Promise<{ fileId: string; webViewLink?: string }> {
    const accessToken = await this.getValidAccessToken();

    // Ensure category folder exists
    const { categoryFolders } = await this.initializeFolderHierarchy();
    const targetFolderId = categoryFolders[options.category] || categoryFolders['Other'];

    const boundary = '-------' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: options.fileName,
      mimeType: options.mimeType,
      parents: targetFolderId ? [targetFolderId] : undefined,
    };

    const metadataPart =
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);

    const mediaPartHeader = `Content-Type: ${options.mimeType}\r\n\r\n`;

    const multipartRequestBody = Buffer.concat([
      Buffer.from(delimiter + metadataPart + delimiter + mediaPartHeader),
      options.buffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadUrl = `${GOOGLE_UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartRequestBody.length.toString(),
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Drive video upload error:', res.status, errText);
      throw new Error(`Google Drive upload failed: ${errText}`);
    }

    const fileData = await res.json();
    return {
      fileId: fileData.id,
      webViewLink: fileData.webViewLink,
    };
  }

  /**
   * Uploads large files (up to 10 GB) from temporary disk storage to Google Drive using Resumable Upload.
   */
  async uploadFileFromDisk(options: {
    filePath: string;
    fileName: string;
    mimeType: string;
    category: Category;
    size: number;
  }): Promise<{ fileId: string; webViewLink?: string }> {
    const accessToken = await this.getValidAccessToken();

    // Ensure category folder exists
    const { categoryFolders } = await this.initializeFolderHierarchy();
    const targetFolderId = categoryFolders[options.category] || categoryFolders['Other'];

    const metadata = {
      name: options.fileName,
      mimeType: options.mimeType,
      parents: targetFolderId ? [targetFolderId] : undefined,
    };

    // Step 1: Initialize Resumable Upload Session
    const initUrl = `${GOOGLE_UPLOAD_API_BASE}/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink`;
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': options.mimeType,
        'X-Upload-Content-Length': options.size.toString(),
      },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Google Drive resumable upload initialization failed: ${err}`);
    }

    const uploadSessionUrl = initRes.headers.get('location');
    if (!uploadSessionUrl) {
      throw new Error('Google Drive did not return a valid upload session URL.');
    }

    // Step 2: Stream file from disk to Google Drive
    const fileStream = fs.createReadStream(options.filePath);

    const uploadRes = await fetch(uploadSessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': options.size.toString(),
        'Content-Type': options.mimeType,
      },
      body: fileStream as any,
      // @ts-ignore
      duplex: 'half',
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Google Drive file stream upload failed: ${err}`);
    }

    const fileData = await uploadRes.json();
    return {
      fileId: fileData.id,
      webViewLink: fileData.webViewLink,
    };
  }

  /**
   * Fetches Drive storage quota information (e.g. 2 TB Google One storage limit & usage).
   */
  async getStorageQuota(): Promise<{
    limit: number;
    usage: number;
    usageInDrive: number;
    usageInDriveTrash: number;
    accountEmail: string;
    accountName: string;
  } | null> {
    try {
      const accessToken = await this.getValidAccessToken();
      const res = await fetch(
        `${GOOGLE_DRIVE_API_BASE}/about?fields=storageQuota,user`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const quota = data.storageQuota || {};
      const user = data.user || {};

      return {
        limit: Number(quota.limit) || 0,
        usage: Number(quota.usage) || 0,
        usageInDrive: Number(quota.usageInDrive) || 0,
        usageInDriveTrash: Number(quota.usageInDriveTrash) || 0,
        accountEmail: user.emailAddress || '',
        accountName: user.displayName || '',
      };
    } catch {
      return null;
    }
  }

  /**
   * Streams a file from Google Drive, supporting HTTP Range requests.
   */
  async streamFile(
    fileId: string,
    rangeHeader?: string
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    stream: NodeJS.ReadableStream | ReadableStream<Uint8Array> | any;
  }> {
    const accessToken = await this.getValidAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const fetchUrl = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const res = await fetch(fetchUrl, { headers });

    if (!res.ok && res.status !== 206) {
      const errText = await res.text();
      throw new Error(`Drive stream error (${res.status}): ${errText}`);
    }

    const responseHeaders: Record<string, string> = {};
    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];

    forwardHeaders.forEach((h) => {
      const val = res.headers.get(h);
      if (val) responseHeaders[h] = val;
    });

    if (!responseHeaders['accept-ranges']) {
      responseHeaders['accept-ranges'] = 'bytes';
    }

    return {
      status: res.status,
      headers: responseHeaders,
      stream: res.body,
    };
  }

  /**
   * Deletes a file from Google Drive.
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken();
      const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok || res.status === 404;
    } catch (err) {
      console.error('Error deleting file from Drive:', err);
      return false;
    }
  }

  /**
   * Disconnects the Google Drive account and revokes token if possible.
   */
  async disconnect(): Promise<void> {
    const tokens = db.getTokens();
    if (tokens?.refresh_token || tokens?.access_token) {
      try {
        const tokenToRevoke = tokens.refresh_token || tokens.access_token;
        await fetch(`${GOOGLE_REVOKE_URL}?token=${tokenToRevoke}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch (err) {
        console.warn('Could not revoke Google token with server:', err);
      }
    }
    db.clearTokens();
  }
}

export const driveService = new DriveService();
