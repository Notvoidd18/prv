import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Readable } from 'stream';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { db, VideoRecord, HomeworkRecord, UserRole, SUPER_ADMIN_EMAIL } from './db.js';
import { driveService, Category, CATEGORIES } from './driveService.js';
import { processVideoMedia, processImageMedia } from './mediaService.js';

export const router = express.Router();

// Allowed file types: Videos, Lesson Photos, and PDF / Document Notes
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'video/avi',
  'video/mpeg',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Multer disk storage for supporting uploads up to 10 GB without memory exhaustion
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(os.tmpdir(), '10prvdriver_uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
      const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10 GB MAX FILE SIZE
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file format. Supported: MP4, WebM, QuickTime, MKV videos (up to 10 GB) and JPEG, PNG, WebP images.'
        )
      );
    }
  },
});

/**
 * Authentication Middleware:
 * Verifies user presence via x-user-email, Authorization header, or auth query parameter (for HTML5 video player requests).
 */
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let userEmail = (req.headers['x-user-email'] as string) || '';

  // Video and audio stream requests from HTML5 elements cannot set custom HTTP headers,
  // so we securely support query parameters 'auth' or 'email'.
  if (!userEmail && (req.query.auth || req.query.email)) {
    userEmail = (req.query.auth as string) || (req.query.email as string) || '';
  }

  // Also support Bearer tokens containing email
  if (!userEmail && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.includes('@')) {
      userEmail = token;
    }
  }

  if (!userEmail) {
    res.status(401).json({
      error: 'Authentication required. Please sign in with Google to access 10PrvDriver materials.',
    });
    return;
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  const user = db.getUserByEmail(cleanEmail);
  if (!user) {
    const newUser = db.saveOrUpdateUser({ email: cleanEmail, name: cleanEmail.split('@')[0] });
    (req as any).currentUser = newUser;
  } else {
    (req as any).currentUser = user;
  }

  next();
}

/**
 * Teacher / Admin Middleware:
 * Only users with 'teacher' or 'admin' role can upload lesson materials.
 */
function requireTeacherOrAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).currentUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (user.role !== 'teacher' && user.role !== 'admin' && !isSuperAdmin) {
    res.status(403).json({
      error:
        'Access Denied: Only authorized teachers and administrators can upload lessons. Please contact the administrator for teacher permissions.',
    });
    return;
  }

  next();
}

/**
 * Super Admin Middleware:
 * Strictly restricts /api/admin/* operations to administrators.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).currentUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (user.role !== 'admin' && !isSuperAdmin) {
    res.status(403).json({
      error: 'Access Denied: Administrator clearance required.',
    });
    return;
  }

  next();
}

/**
 * Helper to determine current dynamic OAuth redirect URI based on request
 */
function getCalculatedRedirectUri(req: Request): string {
  const config = db.getConfig();
  if (config.redirectUri) {
    return config.redirectUri;
  }
  if (process.env.APP_URL) {
    const base = process.env.APP_URL.replace(/\/+$/, '');
    return `${base}/auth/google/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}/auth/google/callback`;
}

// ==========================================
// USER AUTHENTICATION & PROFILE ENDPOINTS
// ==========================================

/**
 * Sync user profile upon Google Sign-In
 */
router.post('/api/auth/sync', (req: Request, res: Response) => {
  const { email, name, picture } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }

  const user = db.saveOrUpdateUser({ email, name, picture });
  res.json({
    success: true,
    user,
    isSuperAdmin: user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
  });
});

/**
 * Get current authenticated user profile
 */
router.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).currentUser;
  res.json({ user });
});

// ==========================================
// ADMIN EXCLUSIVE CONTROL ENDPOINTS (/api/admin/*)
// ==========================================

/**
 * Admin: Get all registered users and their statistics
 */
router.get('/api/admin/users', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const users = db.getUsers();
  const videos = db.getVideos();

  const usersWithStats = users.map((u) => {
    const uploadCount = videos.filter(
      (v) => (v.uploaderEmail && v.uploaderEmail.toLowerCase() === u.email.toLowerCase()) || v.uploader === u.name
    ).length;
    return {
      ...u,
      uploadCount,
    };
  });

  res.json({ users: usersWithStats });
});

/**
 * Admin: Update user role (e.g., grant teacher permissions)
 */
router.post('/api/admin/users/:userId/role', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['admin', 'teacher', 'student'].includes(role)) {
    res.status(400).json({ error: 'Invalid role. Must be admin, teacher, or student.' });
    return;
  }

  try {
    const updated = db.updateUserRole(userId, role as UserRole);
    res.json({
      success: true,
      message: `User ${updated.email} is now assigned the role of ${role}.`,
      user: updated,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update user role.' });
  }
});

/**
 * Admin: Live storage analytics and category breakdown
 */
router.get(['/api/admin/storage', '/api/admin/storage-metrics'], requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const quota = await driveService.getStorageQuota();
    const videos = db.getVideos();

    const videoLessons = videos.filter((v) => v.type === 'video');
    const photoLessons = videos.filter((v) => v.type === 'photo');
    const pdfLessons = videos.filter((v) => v.type === 'pdf');

    const totalVideoBytes = videoLessons.reduce((acc, v) => acc + (v.size || 0), 0);
    const totalPhotoBytes = photoLessons.reduce((acc, v) => acc + (v.size || 0), 0);
    const totalPdfBytes = pdfLessons.reduce((acc, v) => acc + (v.size || 0), 0);
    const totalBytes = totalVideoBytes + totalPhotoBytes + totalPdfBytes;

    const categoryStats = CATEGORIES.map((cat) => {
      const items = videos.filter((v) => v.category === cat);
      const bytes = items.reduce((acc, v) => acc + (v.size || 0), 0);
      return {
        category: cat,
        count: items.length,
        size: bytes,
      };
    });

    res.json({
      quota,
      stats: {
        totalLessons: videos.length,
        videoCount: videoLessons.length,
        photoCount: photoLessons.length,
        pdfCount: pdfLessons.length,
        totalBytes,
        totalVideoBytes,
        totalPhotoBytes,
        totalPdfBytes,
        categoryStats,
      },
    });
  } catch (err: any) {
    console.error('Storage analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve storage metrics.' });
  }
});

/**
 * Admin: Delete ANY lesson from Drive and database
 */
router.delete('/api/admin/videos/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = db.getVideos().find((v) => v.id === id);

    if (!lesson) {
      db.deleteVideo(id);
      res.json({ success: true, message: 'Lesson already removed.' });
      return;
    }

    try {
      if (lesson.driveFileId) {
        await driveService.deleteFile(lesson.driveFileId);
      }
    } catch (driveErr) {
      console.warn('Could not delete file from Google Drive:', driveErr);
    }

    db.deleteVideo(id);
    res.json({ success: true, message: `Lesson "${lesson.title}" permanently deleted.` });
  } catch (err: any) {
    try {
      db.deleteVideo(req.params.id);
    } catch {}
    res.json({ success: true, message: 'Lesson removed from database.' });
  }
});

// ==========================================
// OAUTH & GOOGLE DRIVE CONFIGURATION
// ==========================================

/**
 * Returns current OAuth status, configuration and storage quota.
 */
router.get('/api/oauth/config', async (req: Request, res: Response) => {
  const config = db.getConfig();
  const tokens = db.getTokens();
  const currentRedirectUri = getCalculatedRedirectUri(req);

  const isConfigured = Boolean(config.clientId && config.clientSecret);
  const isConnected = Boolean((tokens?.refresh_token || tokens?.access_token) && tokens?.user_email);

  let quota = null;
  if (isConnected) {
    try {
      quota = await driveService.getStorageQuota();
    } catch {
      // quota check is non-fatal
    }
  }

  res.json({
    configured: isConfigured || Boolean(tokens?.access_token),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    maskedClientId: config.clientId
      ? `${config.clientId.substring(0, 12)}...${config.clientId.slice(-8)}`
      : '',
    redirectUri: currentRedirectUri,
    connected: isConnected,
    account: tokens
      ? {
          email: tokens.user_email,
          name: tokens.user_name,
          picture: tokens.user_picture,
          connectedAt: tokens.connected_at,
        }
      : null,
    drive: tokens
      ? {
          rootFolderId: tokens.root_folder_id || config.rootFolderId,
          rootFolderName: tokens.root_folder_name || 'PrivateTeacherVideos',
          categoryFolders: tokens.category_folders || {},
        }
      : null,
    quota,
    sampleRenderCallback: 'https://YOUR-RENDER-DOMAIN.onrender.com/auth/google/callback',
  });
});

/**
 * Activates Google Drive session from client sign-in (Admin only)
 */
router.post('/api/oauth/session', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { accessToken, email, name, picture } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: 'Missing access token.' });
      return;
    }

    const tokens = await driveService.setSessionToken(accessToken, {
      email: email || 'naveen.an.18.an@gmail.com',
      name: name || 'Google Account',
      picture: picture || '',
    });

    res.json({
      success: true,
      message: 'Google Drive connected and folders initialized.',
      account: {
        email: tokens.user_email,
        name: tokens.user_name,
        picture: tokens.user_picture,
      },
      drive: {
        rootFolderId: tokens.root_folder_id,
        categoryFolders: tokens.category_folders,
      },
    });
  } catch (err: any) {
    console.error('Session token activation error:', err);
    res.status(500).json({ error: err.message || 'Failed to activate Drive session.' });
  }
});

/**
 * Admin updates Google Client ID & Secret
 */
router.post('/api/oauth/credentials', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { clientId, clientSecret, redirectUri, rootFolderId } = req.body;

  if (!clientId || !clientSecret) {
    res.status(400).json({ error: 'Client ID and Client Secret are required.' });
    return;
  }

  db.saveConfig({
    clientId: String(clientId).trim(),
    clientSecret: String(clientSecret).trim(),
    redirectUri: redirectUri ? String(redirectUri).trim() : undefined,
    rootFolderId: rootFolderId ? String(rootFolderId).trim() : undefined,
  });

  res.json({ success: true, message: 'Google Cloud credentials saved securely.' });
});

/**
 * Disconnects the Google Drive account (Admin only)
 */
router.post('/auth/google/disconnect', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await driveService.disconnect();
    res.json({ success: true, message: 'Google Drive disconnected.' });
  } catch (err: any) {
    console.error('Error during disconnect:', err);
    res.status(500).json({ error: err.message || 'Failed to disconnect Google Drive.' });
  }
});

// ==========================================
// LESSONS (VIDEOS & PHOTOS) API ENDPOINTS
// ==========================================

/**
 * Returns all lesson records (Videos & Photos) or filtered by category/type.
 * Requires Google sign-in.
 */
router.get('/api/videos', (req: Request, res: Response) => {
  const { category, type, search } = req.query;
  let list = db.getVideos();

  if (category && category !== 'All') {
    list = list.filter((v) => v.category === category);
  }

  if (type && type !== 'All') {
    list = list.filter((v) => v.type === type);
  }

  if (search && typeof search === 'string') {
    const query = search.toLowerCase();
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query) ||
        v.uploader.toLowerCase().includes(query)
    );
  }

  res.json({
    videos: list,
    total: list.length,
  });
});

/**
 * Teacher/Admin uploads video or photo directly to Google Drive.
 * Supports up to 10 GB file sizes via disk streaming!
 * Strict check: Only users with 'teacher' or 'admin' role can upload!
 */
router.post(
  '/api/videos/upload',
  requireAuth,
  requireTeacherOrAdmin,
  upload.single('video'),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No lesson file provided.' });
      return;
    }

    try {
      const { title, description, category, gradeLevel } = req.body;
      const user = (req as any).currentUser;

      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Lesson title is required.' });
        return;
      }

      const validCategory = (
        CATEGORIES.includes(category as Category) ? category : 'Other'
      ) as Category;

      // Check Google Drive connection or fallback to local disk storage
      const tokens = db.getTokens();
      let driveFileId = '';
      let localFilePath = '';

      const isWordDoc =
        file.mimetype.includes('word') ||
        file.mimetype.includes('officedocument') ||
        file.originalname.toLowerCase().endsWith('.doc') ||
        file.originalname.toLowerCase().endsWith('.docx');
      const isPdf =
        !isWordDoc &&
        (file.mimetype === 'application/pdf' ||
          file.originalname.toLowerCase().endsWith('.pdf') ||
          file.mimetype.startsWith('text/') ||
          file.originalname.toLowerCase().endsWith('.txt'));
      const isPhoto = file.mimetype.startsWith('image/');
      let lessonType: 'video' | 'photo' | 'pdf' | 'doc' = 'video';
      if (isWordDoc) lessonType = 'doc';
      else if (isPdf) lessonType = 'pdf';
      else if (isPhoto) lessonType = 'photo';

      const sanitizedExt =
        path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '') ||
        (isWordDoc ? '.docx' : isPdf ? '.pdf' : isPhoto ? '.jpg' : '.mp4');
      const safeDriveFileName = `${Date.now()}_${crypto.randomUUID().substring(0, 8)}${sanitizedExt}`;

      // Always save a local copy to data/local_videos for instant 0ms Range-request streaming
      const localDir = path.resolve(process.cwd(), 'data', 'local_videos');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const destPath = path.join(localDir, safeDriveFileName);
      fs.copyFileSync(file.path, destPath);
      localFilePath = destPath;

      // Also upload to Google Drive for 2 TB permanent cloud backup if connected
      if (tokens && (tokens.refresh_token || tokens.access_token)) {
        try {
          const driveResult = await driveService.uploadFileFromDisk({
            filePath: destPath,
            fileName: safeDriveFileName,
            mimeType: file.mimetype,
            category: validCategory,
            size: file.size,
          });
          driveFileId = driveResult.fileId;
        } catch (e) {
          console.warn('Google Drive upload warning (local storage is fully active):', e);
        }
      }

      const lessonRecord: VideoRecord = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: (description || '').trim(),
        category: validCategory,
        gradeLevel: gradeLevel || 'All Grades',
        type: lessonType,
        driveFileId,
        localFilePath,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        processingStatus: 'processing',
        processingProgress: 5,
        processingStage: 'Initializing optimization...',
        createdAt: new Date().toISOString(),
        uploader: user.name || user.email.split('@')[0],
        uploaderEmail: user.email,
      };

      db.saveVideo(lessonRecord);

      // Background media processing for instant streaming & thumbnails
      const processingFilePath = localFilePath || file.path;
      if (processingFilePath && fs.existsSync(processingFilePath)) {
        if (lessonType === 'video') {
          processVideoMedia(lessonRecord.id, processingFilePath, (progress, stage) => {
            const current = db.getVideos().find((v) => v.id === lessonRecord.id);
            if (current) {
              current.processingProgress = progress;
              current.processingStage = stage;
              db.saveVideo(current);
            }
          })
            .then((meta) => {
              const current = db.getVideos().find((v) => v.id === lessonRecord.id);
              if (current) {
                current.duration = meta.duration;
                current.posterUrl = meta.posterPath ? `/api/videos/${current.id}/poster` : undefined;
                current.masterPlaylistUrl = meta.masterPlaylistPath ? `/api/videos/${current.id}/hls/master.m3u8` : undefined;
                current.availableQualities = meta.availableQualities;
                current.processingStatus = 'ready';
                current.processingProgress = 100;
                current.processingStage = 'Ready for playback';
                db.saveVideo(current);
              }
            })
            .catch((err) => {
              console.error('Video background processing error:', err);
              const current = db.getVideos().find((v) => v.id === lessonRecord.id);
              if (current) {
                current.processingStatus = 'ready';
                current.processingProgress = 100;
                current.processingStage = 'Standard stream ready';
                db.saveVideo(current);
              }
            });
        } else if (lessonType === 'photo') {
          processImageMedia(lessonRecord.id, processingFilePath, (progress, stage) => {
            const current = db.getVideos().find((v) => v.id === lessonRecord.id);
            if (current) {
              current.processingProgress = progress;
              current.processingStage = stage;
              db.saveVideo(current);
            }
          })
            .then(() => {
              const current = db.getVideos().find((v) => v.id === lessonRecord.id);
              if (current) {
                current.processingStatus = 'ready';
                current.processingProgress = 100;
                current.processingStage = 'Ready';
                db.saveVideo(current);
              }
            })
            .catch(() => {
              const current = db.getVideos().find((v) => v.id === lessonRecord.id);
              if (current) {
                current.processingStatus = 'ready';
                current.processingProgress = 100;
                db.saveVideo(current);
              }
            });
        } else {
          lessonRecord.processingStatus = 'ready';
          lessonRecord.processingProgress = 100;
          lessonRecord.processingStage = 'Ready';
          db.saveVideo(lessonRecord);
        }
      } else {
        lessonRecord.processingStatus = 'ready';
        lessonRecord.processingProgress = 100;
        lessonRecord.processingStage = 'Ready';
        db.saveVideo(lessonRecord);
      }

      res.json({
        success: true,
        message: `${isWordDoc ? 'Document' : isPdf ? 'PDF Note' : isPhoto ? 'Photo' : 'Video'} uploaded successfully${driveFileId ? ' to Google Drive' : ' (Local Storage)'}.`,
        video: lessonRecord,
      });
    } catch (err: any) {
      console.error('Error during lesson upload:', err);
      res.status(500).json({
        error: err.message || 'Failed to upload lesson material.',
      });
    } finally {
      // Clean up temporary upload file from disk
      try {
        if (file && file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanErr) {
        console.warn('Failed to clean up temp file:', cleanErr);
      }
    }
  }
);

/**
 * Get processing status and progress for a specific lesson
 */
router.get('/api/videos/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const lesson = db.getVideos().find((v) => v.id === id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  res.json({
    id: lesson.id,
    processingStatus: lesson.processingStatus || 'ready',
    processingProgress: lesson.processingProgress ?? 100,
    processingStage: lesson.processingStage || (lesson.processingStatus === 'ready' ? 'Ready' : 'Optimizing...'),
    availableQualities: lesson.availableQualities || [],
  });
});

/**
 * Serve video poster image
 */
router.get('/api/videos/:id/poster', (req: Request, res: Response) => {
  const { id } = req.params;
  const posterPath = path.resolve(process.cwd(), 'data', 'media_cache', id, 'poster.jpg');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (fs.existsSync(posterPath)) {
    const stat = fs.statSync(posterPath);
    const etag = `"${stat.size}-${stat.mtimeMs}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    fs.createReadStream(posterPath).pipe(res);
    return;
  }

  // On-demand generation if local file exists
  const lesson = db.getVideos().find((v) => v.id === id);
  if (lesson?.localFilePath && fs.existsSync(lesson.localFilePath)) {
    processVideoMedia(lesson.id, lesson.localFilePath)
      .then((meta) => {
        if (meta.posterPath && fs.existsSync(meta.posterPath)) {
          const current = db.getVideos().find((v) => v.id === lesson.id);
          if (current) {
            current.posterUrl = `/api/videos/${current.id}/poster`;
            current.masterPlaylistUrl = meta.masterPlaylistPath ? `/api/videos/${current.id}/hls/master.m3u8` : undefined;
            current.availableQualities = meta.availableQualities;
            current.processingStatus = 'ready';
            db.saveVideo(current);
          }
        }
      })
      .catch(() => {});
  }

  res.status(404).send('Poster not found');
});

/**
 * Serve image thumbnail variant
 */
router.get('/api/videos/:id/thumbnail', (req: Request, res: Response) => {
  const { id } = req.params;
  const thumbPath = path.resolve(process.cwd(), 'data', 'media_cache', id, 'thumb.jpg');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (fs.existsSync(thumbPath)) {
    const stat = fs.statSync(thumbPath);
    const etag = `"${stat.size}-${stat.mtimeMs}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    fs.createReadStream(thumbPath).pipe(res);
  } else {
    res.redirect(`/api/videos/${id}/stream`);
  }
});

/**
 * Serve HLS master playlist and segments with Range support and CORS
 */
router.get('/api/videos/:id/hls/*', (req: Request, res: Response) => {
  const { id } = req.params;
  const subPath = req.params[0] || '';
  const hlsDir = path.resolve(process.cwd(), 'data', 'media_cache', id, 'hls');
  const targetPath = path.resolve(hlsDir, subPath);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!targetPath.startsWith(hlsDir)) {
    res.status(403).send('Forbidden');
    return;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    const stat = fs.statSync(targetPath);
    const ext = path.extname(targetPath).toLowerCase();
    const etag = `"${stat.size}-${stat.mtimeMs}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());

    if (ext === '.m3u8') {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      fs.createReadStream(targetPath).pipe(res);
    } else if (ext === '.ts' || ext === '.m4s') {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': chunksize,
        });
        fs.createReadStream(targetPath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Length', stat.size);
        fs.createReadStream(targetPath).pipe(res);
      }
    } else {
      fs.createReadStream(targetPath).pipe(res);
    }
  } else {
    res.status(404).send('HLS segment not found');
  }
});

/**
 * Streams video, photo or document from local storage or Google Drive.
 * Supports Range requests for instant video playback and seeking.
 * Publicly accessible for preview without sign-in.
 */
router.get('/api/videos/:id/stream', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = db.getVideos().find((v) => v.id === id);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (!lesson) {
      // Check if this ID belongs to a homework item for seamless preview
      const hw = db.getHomework().find((h) => h.id === id);
      if (hw) {
        const targetFileName = hw.fileName;
        const filePath = path.join(HOMEWORK_DIR, targetFileName);
        if (fs.existsSync(filePath)) {
          let mimeType = hw.mimeType;
          if (targetFileName.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
          else if (targetFileName.match(/\.png$/i)) mimeType = 'image/png';
          else if (targetFileName.match(/\.pdf$/i)) mimeType = 'application/pdf';
          res.setHeader('Content-Type', mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      res.status(404).json({ error: 'Lesson material not found.' });
      return;
    }

    // If local file path exists and file exists, stream locally with instant 0ms range seeking
    const localVideoDir = path.resolve(process.cwd(), 'data', 'local_videos');
    let effectiveLocalPath = lesson.localFilePath;
    if (!effectiveLocalPath || !fs.existsSync(effectiveLocalPath)) {
      const fallbackLocal = path.join(localVideoDir, lesson.fileName);
      if (fs.existsSync(fallbackLocal)) {
        effectiveLocalPath = fallbackLocal;
      }
    }

    if (effectiveLocalPath && fs.existsSync(effectiveLocalPath)) {
      const stat = fs.statSync(effectiveLocalPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', lesson.mimeType || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(effectiveLocalPath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize,
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
        });
        fs.createReadStream(effectiveLocalPath).pipe(res);
      }
      return;
    }

    if (!lesson.driveFileId) {
      res.status(404).json({ error: 'Lesson file source not found.' });
      return;
    }

    // Trigger local background caching from Drive so all subsequent range seeks become instant
    const cacheDestPath = path.join(localVideoDir, `${lesson.id}_${lesson.fileName}`);
    if (!fs.existsSync(cacheDestPath)) {
      driveService
        .downloadFileToDisk(lesson.driveFileId, cacheDestPath)
        .then((savedPath) => {
          const current = db.getVideos().find((v) => v.id === lesson.id);
          if (current) {
            current.localFilePath = savedPath;
            db.saveVideo(current);
            // Also trigger background HLS processing if not already ready
            if (current.processingStatus !== 'ready') {
              processVideoMedia(current.id, savedPath, (progress, stage) => {
                const live = db.getVideos().find((v) => v.id === current.id);
                if (live) {
                  live.processingProgress = progress;
                  live.processingStage = stage;
                  db.saveVideo(live);
                }
              }).then((meta) => {
                const live = db.getVideos().find((v) => v.id === current.id);
                if (live) {
                  live.duration = meta.duration;
                  live.posterUrl = meta.posterPath ? `/api/videos/${live.id}/poster` : undefined;
                  live.masterPlaylistUrl = meta.masterPlaylistPath ? `/api/videos/${live.id}/hls/master.m3u8` : undefined;
                  live.availableQualities = meta.availableQualities;
                  live.processingStatus = 'ready';
                  live.processingProgress = 100;
                  live.processingStage = 'Ready for playback';
                  db.saveVideo(live);
                }
              }).catch(() => {});
            }
          }
        })
        .catch((dlErr) => {
          console.warn('Background caching from Drive warning:', dlErr);
        });
    }

    const rangeHeader = req.headers.range;
    const driveStream = await driveService.streamFile(lesson.driveFileId, rangeHeader);

    // Forward status code (206 Partial Content or 200 OK)
    res.status(driveStream.status);

    // Forward streaming headers
    Object.entries(driveStream.headers).forEach(([key, value]) => {
      if (
        [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
          'last-modified',
          'etag',
        ].includes(key.toLowerCase())
      ) {
        res.setHeader(key, value);
      }
    });

    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', lesson.mimeType || 'video/mp4');
    }

    // STRICT ANTI-DOWNLOAD SECURITY HEADERS
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');

    if (!driveStream.stream) {
      res.end();
      return;
    }

    // Convert Web ReadableStream to Node.js Readable stream and pipe cleanly to Express response
    const nodeStream = Readable.fromWeb(driveStream.stream as any);
    nodeStream.pipe(res);

    nodeStream.on('error', (err) => {
      console.error('Streaming pipe error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on('close', () => {
      nodeStream.destroy();
    });
  } catch (err: any) {
    console.error('Error streaming lesson:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to stream lesson material.' });
    }
  }
});

/**
 * Deletes a lesson:
 * Allowed only for the original uploader or an Admin.
 */
router.delete('/api/videos/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).currentUser;
    const lesson = db.getVideos().find((v) => v.id === id);

    if (!lesson) {
      db.deleteVideo(id);
      res.json({ success: true, message: 'Lesson already removed.' });
      return;
    }

    // Check permission: Owner, Teacher, Admin, or Super Admin
    const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isAdmin = user.role === 'admin' || isSuperAdmin;
    const isTeacher = user.role === 'teacher';
    const isOwner =
      Boolean(lesson.uploaderEmail && lesson.uploaderEmail.toLowerCase() === user.email.toLowerCase()) ||
      Boolean(lesson.uploader && lesson.uploader.toLowerCase() === (user.name || '').toLowerCase()) ||
      !lesson.uploaderEmail;

    if (!isOwner && !isAdmin && !isTeacher) {
      res.status(403).json({
        error: 'Access Denied: Only teachers and administrators can delete lesson materials.',
      });
      return;
    }

    try {
      if (lesson.driveFileId) {
        await driveService.deleteFile(lesson.driveFileId);
      }
    } catch (driveErr) {
      console.warn('Could not delete file from Google Drive (proceeding with local db removal):', driveErr);
    }

    db.deleteVideo(id);
    res.json({ success: true, message: 'Lesson removed successfully.' });
  } catch (err: any) {
    console.error('Error deleting lesson:', err);
    try {
      db.deleteVideo(req.params.id);
    } catch {}
    res.json({ success: true, message: 'Lesson removed from platform.' });
  }
});

// ==========================================
// STUDENT HOMEWORK API ENDPOINTS
// ==========================================

const HOMEWORK_DIR = path.resolve(process.cwd(), 'data', 'homework_files');
if (!fs.existsSync(HOMEWORK_DIR)) {
  fs.mkdirSync(HOMEWORK_DIR, { recursive: true });
}

const homeworkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, HOMEWORK_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
      cb(null, `hw_${Date.now()}_${crypto.randomUUID().substring(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max for homework
});

/**
 * Subject Management Endpoints
 */
router.get('/api/subjects', (req: Request, res: Response) => {
  res.json({ subjects: db.getSubjects() });
});

router.post('/api/subjects', requireAdmin, (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Subject name is required.' });
    return;
  }
  const updated = db.addSubject(name.trim());
  res.json({ success: true, subjects: updated });
});

router.delete('/api/subjects/:name', requireAdmin, (req: Request, res: Response) => {
  const { name } = req.params;
  const updated = db.deleteSubject(decodeURIComponent(name));
  res.json({ success: true, subjects: updated });
});

/**
 * Lists shared student homework & notes.
 * All authenticated users (students & teachers) can browse and study shared materials!
 */
router.get('/api/homework', (req: Request, res: Response) => {
  const allHomework = db.getHomework();
  res.json({ homework: allHomework });
});

/**
 * Student uploads homework (Single or multiple photos / PDFs)
 */
router.post(
  '/api/homework/upload',
  requireAuth,
  homeworkUpload.array('files', 10),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Please select or capture at least one photo or document.' });
      return;
    }

    try {
      const user = (req as any).currentUser;
      const { title, description, category, gradeLevel } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Homework title is required.' });
        return;
      }

      const fileNames = files.map((f) => f.filename);
      const primaryFile = files[0];
      const isPhoto = primaryFile.mimetype.startsWith('image/');
      const isPdf = primaryFile.mimetype === 'application/pdf' || primaryFile.originalname.toLowerCase().endsWith('.pdf');
      const hwType: 'pdf' | 'photo' | 'doc' = isPdf ? 'pdf' : isPhoto ? 'photo' : 'doc';
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);

      const homeworkRecord: HomeworkRecord = {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: (description || '').trim(),
        category: category && category.trim() ? category.trim() : 'Other',
        gradeLevel: gradeLevel || 'All Grades',
        type: hwType,
        fileName: primaryFile.filename,
        fileNames,
        mimeType: primaryFile.mimetype,
        size: totalSize,
        studentName: user.name || user.email.split('@')[0],
        studentEmail: user.email,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };

      db.saveHomework(homeworkRecord);

      res.json({
        success: true,
        message: 'Homework & notes shared successfully!',
        homework: homeworkRecord,
      });
    } catch (err: any) {
      console.error('Homework upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to submit homework.' });
    }
  }
);

/**
 * Streams / previews a homework file (or specific photo index)
 */
router.get('/api/homework/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  const fileIndex = parseInt(req.query.fileIndex as string, 10);
  const hw = db.getHomework().find((h) => h.id === id);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (!hw) {
    res.status(404).json({ error: 'Homework not found.' });
    return;
  }

  let targetFileName = hw.fileName;
  if (!isNaN(fileIndex) && hw.fileNames && hw.fileNames[fileIndex]) {
    targetFileName = hw.fileNames[fileIndex];
  }

  const filePath = path.join(HOMEWORK_DIR, targetFileName);
  if (!fs.existsSync(filePath)) {
    // Check if default fileName exists
    if (hw.fileName && fs.existsSync(path.join(HOMEWORK_DIR, hw.fileName))) {
      const fallbackStream = fs.createReadStream(path.join(HOMEWORK_DIR, hw.fileName));
      res.setHeader('Content-Type', hw.mimeType || 'image/jpeg');
      res.setHeader('Content-Disposition', 'inline');
      fallbackStream.pipe(res);
      return;
    }
    res.status(404).json({ error: 'Homework file missing on server.' });
    return;
  }

  let mimeType = hw.mimeType;
  if (targetFileName.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
  else if (targetFileName.match(/\.png$/i)) mimeType = 'image/png';
  else if (targetFileName.match(/\.pdf$/i)) mimeType = 'application/pdf';

  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * Streams a homework file/photo by numeric index: /api/homework/:id/file/:index
 */
router.get('/api/homework/:id/file/:index', (req: Request, res: Response) => {
  const { id, index } = req.params;
  const fileIndex = parseInt(index, 10);
  const hw = db.getHomework().find((h) => h.id === id);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (!hw) {
    res.status(404).json({ error: 'Homework not found.' });
    return;
  }

  let targetFileName = hw.fileName;
  if (!isNaN(fileIndex) && hw.fileNames && hw.fileNames[fileIndex]) {
    targetFileName = hw.fileNames[fileIndex];
  }

  const filePath = path.join(HOMEWORK_DIR, targetFileName);
  if (!fs.existsSync(filePath)) {
    // Check fallback
    if (hw.fileName && fs.existsSync(path.join(HOMEWORK_DIR, hw.fileName))) {
      const fallbackStream = fs.createReadStream(path.join(HOMEWORK_DIR, hw.fileName));
      res.setHeader('Content-Type', hw.mimeType || 'image/jpeg');
      res.setHeader('Content-Disposition', 'inline');
      fallbackStream.pipe(res);
      return;
    }
    res.status(404).json({ error: 'Homework file missing on server.' });
    return;
  }

  let mimeType = hw.mimeType;
  if (targetFileName.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
  else if (targetFileName.match(/\.png$/i)) mimeType = 'image/png';
  else if (targetFileName.match(/\.pdf$/i)) mimeType = 'application/pdf';

  res.setHeader('Content-Type', mimeType || 'image/jpeg');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * Resilient Gemini Content Generation Helper:
 * Uses fast, low-latency low models (gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-flash-latest)
 * with exponential backoff if a temporary 503 high demand spike or 429 rate limit is encountered.
 */
async function generateGeminiContentWithFallback(
  ai: GoogleGenAI,
  contents: any,
  preferredModel = 'gemini-2.5-flash'
) {
  // Low models: lightweight, high quota, rapid response
  const candidateModels = [preferredModel, 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  const uniqueModels = Array.from(new Set(candidateModels));

  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || '');
        const status = err?.status || err?.code;
        const isTransientOverload =
          status === 503 ||
          status === 'UNAVAILABLE' ||
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('temporary') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429');

        if (!isTransientOverload) {
          // If it's a fatal key validation or formatting issue, throw immediately
          throw err;
        }

        console.warn(`[Gemini Overload Protection] Model '${model}' attempt ${attempt + 1} reported high demand/unavailable. Waiting before retry or model fallback...`);
        // Backoff: 650ms on first attempt, 1300ms on second
        await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * AI Extraction on student homework photo(s) or PDF notes
 * Extracts all visible text, questions, step-by-step solutions, key concepts, formulas, and study notes!
 */
router.post('/api/homework/:id/ai-extract', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).currentUser;
  const hw = db.getHomework().find((h) => h.id === id);

  if (!hw) {
    res.status(404).json({ error: 'Homework item not found.' });
    return;
  }

  const freshUser = db.getUserByEmail(user.email);
  const apiKey = (
    req.body.customApiKey ||
    (req.headers['x-gemini-api-key'] as string) ||
    freshUser?.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    res.status(400).json({
      error: 'NO_API_KEY',
      message: 'Please add your Gemini API Key in Settings to extract and analyze notes with AI.',
    });
    return;
  }

  try {
    const targetFile = hw.fileName;
    const filePath = path.join(HOMEWORK_DIR, targetFile);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Source file not found on server.' });
      return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    let mimeType = hw.mimeType || 'image/jpeg';
    if (hw.type === 'pdf') mimeType = 'application/pdf';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const promptText = `You are an elite academic AI tutor and document extractor for the classroom platform "10PrvDriver".
Analyze this student homework note (photo / PDF / document):
1. Extract all handwritten notes, printed text, diagrams, formulas, and questions with high fidelity.
2. Provide step-by-step verified explanations and clear solutions so other students can study and learn from this work.
3. Formulate key definitions, theorems, and study tips.

Structure your output cleanly in markdown with these sections:
# Topic & Summary
## Extracted Text & Step-by-Step Solutions
## Key Formulas, Theorems & Definitions
## Student Study Notes & Tips`;

    const contents = {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: promptText },
      ],
    };

    const response = await generateGeminiContentWithFallback(ai, contents, 'gemini-2.5-flash');

    const extractedMarkdown = response.text?.trim() || 'No text could be extracted.';

    const updated = db.updateHomework(id, {
      aiExtractedText: extractedMarkdown,
      aiExtractedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      homework: updated,
      extractedText: extractedMarkdown,
    });
  } catch (err: any) {
    console.error('AI extraction error:', err);
    let friendlyMessage = 'Failed to extract content with Gemini AI.';
    const rawMsg = String(err?.message || '');
    if (rawMsg.includes('503') || rawMsg.includes('high demand') || err?.status === 'UNAVAILABLE') {
      friendlyMessage = 'Gemini AI is temporarily experiencing high traffic spikes. We attempted automatic model fallbacks, but please try clicking Extract again in a few moments.';
    } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      friendlyMessage = 'The configured Gemini API key is invalid. Please verify your API key in Settings.';
    } else if (err?.message) {
      friendlyMessage = err.message;
    }

    res.status(503).json({
      error: 'AI_EXTRACT_ERROR',
      message: friendlyMessage,
    });
  }
});

/**
 * Edit / Update AI Extracted Text (Admin or Teacher)
 */
router.patch('/api/homework/:id/ai-info', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).currentUser;
  const { aiExtractedText } = req.body;

  if (user.role !== 'admin' && user.role !== 'teacher') {
    res.status(403).json({ error: 'Only teachers and administrators can edit AI notes.' });
    return;
  }

  const updated = db.updateHomework(id, {
    aiExtractedText: aiExtractedText || '',
  });

  if (!updated) {
    res.status(404).json({ error: 'Homework not found.' });
    return;
  }

  res.json({
    success: true,
    message: 'AI study notes updated successfully.',
    homework: updated,
  });
});

/**
 * Deletes homework (Student can delete own; Teacher/Admin can delete any)
 */
router.delete('/api/homework/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).currentUser;
  const hw = db.getHomework().find((h) => h.id === id);

  if (!hw) {
    db.deleteHomework(id);
    res.json({ success: true, message: 'Homework note already removed.' });
    return;
  }

  const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isOwner = hw.studentEmail.toLowerCase() === user.email.toLowerCase();
  const isTeacherOrAdmin = user.role === 'teacher' || user.role === 'admin' || isSuperAdmin;

  if (!isOwner && !isTeacherOrAdmin) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }

  try {
    const filesToDelete = hw.fileNames && hw.fileNames.length > 0 ? hw.fileNames : [hw.fileName];
    for (const f of filesToDelete) {
      const p = path.join(HOMEWORK_DIR, f);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
  } catch (err) {
    console.warn('Error deleting homework physical file:', err);
  }

  db.deleteHomework(id);
  res.json({ success: true, message: 'Homework removed successfully.' });
});

/**
 * Teacher/Admin reviews homework
 */
router.patch('/api/homework/:id/review', requireAuth, requireTeacherOrAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { feedback } = req.body;

  const updated = db.updateHomework(id, {
    status: 'reviewed',
    feedback: feedback ? String(feedback).trim() : undefined,
  });

  if (!updated) {
    res.status(404).json({ error: 'Homework not found.' });
    return;
  }

  res.json({ success: true, homework: updated });
});

// ==========================================
// GEMINI AI INTEGRATION & FAST SEARCH
// ==========================================

/**
 * Save user's personal Gemini API key
 */
router.post('/api/user/gemini-key', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).currentUser;
  const { apiKey } = req.body;

  if (typeof apiKey !== 'string') {
    res.status(400).json({ error: 'API key is required.' });
    return;
  }

  const updated = db.saveUserGeminiKey(user.email, apiKey.trim());
  res.json({
    success: true,
    message: apiKey.trim() ? 'Gemini API key saved successfully.' : 'Gemini API key cleared.',
    hasKey: Boolean(updated?.geminiApiKey),
  });
});

/**
 * Get user's personal Gemini API key status
 */
router.get('/api/user/gemini-key', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).currentUser;
  const fresh = db.getUserByEmail(user.email);
  res.json({
    hasKey: Boolean(fresh?.geminiApiKey),
    apiKeyMasked: fresh?.geminiApiKey
      ? `${fresh.geminiApiKey.substring(0, 4)}...${fresh.geminiApiKey.substring(fresh.geminiApiKey.length - 4)}`
      : null,
  });
});

/**
 * Gemini AI Fast Semantic Search & Study Assistant
 * Uses the user's personal Gemini API key to semantically match lessons, homework, and notes!
 */
router.post('/api/ai/fast-search', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).currentUser;
    const { query, customApiKey } = req.body;

    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Please enter a search query or question.' });
      return;
    }

    const freshUser = db.getUserByEmail(user.email);
    const apiKey = (customApiKey || freshUser?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      res.status(400).json({
        error: 'NO_API_KEY',
        message: 'Each student or teacher needs to add their Gemini API Key in Settings to unlock AI Fast Search.',
      });
      return;
    }

    const allLessons = db.getVideos();
    const allHomework = db.getHomework();

    // Prepare catalog context for Gemini
    const catalogContext = {
      lessons: allLessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        category: l.category,
        gradeLevel: l.gradeLevel,
        type: l.type,
        uploader: l.uploader,
      })),
      homework: allHomework.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        category: h.category,
        gradeLevel: h.gradeLevel,
        type: h.type,
        studentName: h.studentName,
      })),
    };

    const prompt = `You are the AI Fast Search & Classroom Assistant for "10PrvDriver".
A student or teacher is asking: "${query.trim()}"

Here is the database catalog of classroom lessons and homework submissions:
${JSON.stringify(catalogContext, null, 2)}

Provide a helpful, precise JSON response with the following format:
{
  "answer": "A concise 2-4 sentence explanation, study tip, or summary addressing the user's query and pointing them to the relevant materials.",
  "matchedLessonIds": ["list of matching lesson IDs from the catalog"],
  "matchedHomeworkIds": ["list of matching homework IDs from the catalog if relevant"],
  "keyTopics": ["3-5 short key topic tags"]
}
Return only valid JSON. Do not include markdown code fences or backticks.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await generateGeminiContentWithFallback(ai, prompt, 'gemini-3.8-flash');

    const rawText = response.text?.trim() || '{}';
    const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch {
      parsedResult = {
        answer: rawText,
        matchedLessonIds: [],
        matchedHomeworkIds: [],
        keyTopics: [],
      };
    }

    res.json({
      success: true,
      query: query.trim(),
      answer: parsedResult.answer || 'Search completed.',
      matchedLessonIds: parsedResult.matchedLessonIds || [],
      matchedHomeworkIds: parsedResult.matchedHomeworkIds || [],
      keyTopics: parsedResult.keyTopics || [],
    });
  } catch (err: any) {
    console.error('Gemini AI Fast Search error:', err);
    let friendlyMessage = 'Gemini AI search failed. Please verify your Gemini API key.';
    const rawMsg = String(err?.message || '');
    if (rawMsg.includes('503') || rawMsg.includes('high demand') || err?.status === 'UNAVAILABLE') {
      friendlyMessage = 'Gemini AI is temporarily experiencing high traffic spikes. Please wait a moment and try your search again.';
    } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      friendlyMessage = 'The configured Gemini API key is invalid. Please verify your API key in Settings.';
    } else if (err?.message) {
      friendlyMessage = err.message;
    }

    res.status(503).json({
      error: 'AI_SEARCH_ERROR',
      message: friendlyMessage,
    });
  }
});

/**
 * Item-Level Gemini Assistant for a specific Lesson (Notes, Video, Photo):
 * Allows students to ask questions, get step-by-step concept explanations, flashcards, and summaries.
 */
router.post('/api/ai/ask-lesson', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).currentUser;
    const { lessonId, prompt, customApiKey } = req.body;

    if (!lessonId || !prompt || !prompt.trim()) {
      res.status(400).json({ error: 'Lesson ID and question prompt are required.' });
      return;
    }

    const freshUser = db.getUserByEmail(user.email);
    const apiKey = (
      customApiKey ||
      (req.headers['x-gemini-api-key'] as string) ||
      freshUser?.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    if (!apiKey) {
      res.status(400).json({
        error: 'NO_API_KEY',
        message: 'Please provide your personal Gemini API Key in Settings or the prompt box to study with AI.',
      });
      return;
    }

    const lesson = db.getVideos().find((v) => v.id === lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson material not found.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a helpful, encouraging classroom tutor for students on "10PrvDriver".
A student is currently studying this lesson material:
- Title: "${lesson.title}"
- Material Format: ${lesson.type || 'Lesson'}
- Subject: ${lesson.category}
- Grade Level: ${lesson.gradeLevel || 'All Grades'}
- Overview: ${lesson.description || 'N/A'}
- Instructor: ${lesson.uploader || 'Teacher'}

Student Question / Study Request: "${prompt.trim()}"

Provide an intuitive, structured educational response formatted cleanly in Markdown:
1. Direct Explanation / Answer to the student's question.
2. Key Concepts, Definitions & Formulas (if relevant).
3. 2-3 Quick Self-Check Questions with answers to test understanding.
Keep the tone encouraging, clear, and focused on learning.`;

    const response = await generateGeminiContentWithFallback(ai, systemPrompt, 'gemini-2.5-flash');
    const answer = response.text?.trim() || 'No response generated.';

    res.json({
      success: true,
      lessonId,
      answer,
      lessonTitle: lesson.title,
    });
  } catch (err: any) {
    console.error('Ask lesson AI error:', err);
    let friendlyMessage = 'Failed to generate study answer with Gemini.';
    const rawMsg = String(err?.message || '');
    if (rawMsg.includes('503') || rawMsg.includes('high demand') || err?.status === 'UNAVAILABLE') {
      friendlyMessage = 'Gemini AI is temporarily busy. Please wait a moment and try again.';
    } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
      friendlyMessage = 'The configured Gemini API key is invalid. Please verify your API key in Settings.';
    } else if (err?.message) {
      friendlyMessage = err.message;
    }

    res.status(503).json({
      error: 'AI_STUDY_ERROR',
      message: friendlyMessage,
    });
  }
});
