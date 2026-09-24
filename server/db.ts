import fs from 'fs';
import path from 'path';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  geminiApiKey?: string;
}

export type LessonType = 'video' | 'photo' | 'pdf' | 'doc';

export interface VideoRecord {
  id: string;
  title: string;
  description: string;
  category: 'Mathematics' | 'Science' | 'English' | 'Other';
  gradeLevel?: string;
  type: LessonType;
  driveFileId: string;
  localFilePath?: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration?: number;
  createdAt: string;
  uploader: string;
  uploaderEmail?: string;
}

export interface HomeworkRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  gradeLevel?: string;
  type: 'pdf' | 'photo' | 'doc';
  fileName: string;
  fileNames?: string[];
  mimeType: string;
  size: number;
  driveFileId?: string;
  studentName: string;
  studentEmail: string;
  status: 'submitted' | 'reviewed';
  feedback?: string;
  aiExtractedText?: string;
  aiExtractedAt?: string;
  aiSummary?: string;
  createdAt: string;
}

export interface DriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  user_email: string;
  user_name: string;
  user_picture?: string;
  root_folder_id?: string;
  root_folder_name?: string;
  category_folders?: Record<string, string>;
  connected_at: string;
}

export interface AppConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  rootFolderId?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const HOMEWORK_FILE = path.join(DATA_DIR, 'homework.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');

export const DEFAULT_SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Physics',
  'Chemistry',
  'Computer Science',
  'Other'
];

export const SUPER_ADMIN_EMAIL = 'naveen.an.18.an@gmail.com';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = {
  getTokens(): DriveTokens | null {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading tokens from disk:', err);
    }
    return null;
  },

  saveTokens(tokens: DriveTokens): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
    } catch (err) {
      console.error('Error writing tokens to disk:', err);
    }
  },

  clearTokens(): void {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        fs.unlinkSync(TOKENS_FILE);
      }
    } catch (err) {
      console.error('Error clearing tokens:', err);
    }
  },

  getVideos(): VideoRecord[] {
    try {
      if (fs.existsSync(VIDEOS_FILE)) {
        const raw = fs.readFileSync(VIDEOS_FILE, 'utf-8');
        const list: VideoRecord[] = JSON.parse(raw);
        return list.map((v) => ({
          ...v,
          type: v.type || (v.mimeType?.startsWith('image/') ? 'photo' : 'video'),
        }));
      }
    } catch (err) {
      console.error('Error reading videos database:', err);
    }
    return [];
  },

  saveVideo(video: VideoRecord): void {
    const list = this.getVideos();
    const existingIndex = list.findIndex((v) => v.id === video.id);
    if (existingIndex >= 0) {
      list[existingIndex] = video;
    } else {
      list.unshift(video);
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(VIDEOS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing video record:', err);
    }
  },

  deleteVideo(id: string): VideoRecord | null {
    const list = this.getVideos();
    const idx = list.findIndex((v) => v.id === id);
    if (idx >= 0) {
      const removed = list.splice(idx, 1)[0];
      try {
        fs.writeFileSync(VIDEOS_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error updating videos database after deletion:', err);
      }
      return removed;
    }
    return null;
  },

  // Homework Database Operations
  getHomework(): HomeworkRecord[] {
    try {
      if (fs.existsSync(HOMEWORK_FILE)) {
        const raw = fs.readFileSync(HOMEWORK_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading homework database:', err);
    }
    return [];
  },

  saveHomework(item: HomeworkRecord): void {
    const list = this.getHomework();
    const existingIndex = list.findIndex((h) => h.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(HOMEWORK_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing homework record:', err);
    }
  },

  deleteHomework(id: string): HomeworkRecord | null {
    const list = this.getHomework();
    const idx = list.findIndex((h) => h.id === id);
    if (idx >= 0) {
      const removed = list.splice(idx, 1)[0];
      try {
        fs.writeFileSync(HOMEWORK_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error updating homework database after deletion:', err);
      }
      return removed;
    }
    return null;
  },

  updateHomework(id: string, updates: Partial<HomeworkRecord>): HomeworkRecord | null {
    const list = this.getHomework();
    const idx = list.findIndex((h) => h.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      try {
        fs.writeFileSync(HOMEWORK_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error updating homework record:', err);
      }
      return list[idx];
    }
    return null;
  },

  getUsers(): AppUser[] {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading users database:', err);
    }
    return [];
  },

  getUserByEmail(email: string): AppUser | null {
    if (!email) return null;
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  saveUserGeminiKey(email: string, key: string): AppUser | null {
    const users = this.getUsers();
    const cleanEmail = email.toLowerCase().trim();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.geminiApiKey = key.trim();
      try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error saving user gemini key:', err);
      }
      return user;
    }
    return null;
  },

  saveOrUpdateUser(profile: {
    email: string;
    name: string;
    picture?: string;
  }): AppUser {
    const users = this.getUsers();
    const cleanEmail = profile.email.toLowerCase().trim();
    const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    let existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    const now = new Date().toISOString();

    if (existing) {
      existing.name = profile.name || existing.name;
      existing.picture = profile.picture || existing.picture;
      existing.lastLoginAt = now;
      if (isSuperAdmin) {
        existing.role = 'admin';
      }
    } else {
      existing = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        name: profile.name || cleanEmail.split('@')[0],
        picture: profile.picture || '',
        role: isSuperAdmin ? 'admin' : 'student',
        createdAt: now,
        lastLoginAt: now,
      };
      users.push(existing);
    }

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving user database:', err);
    }

    return existing;
  },

  updateUserRole(userId: string, newRole: UserRole): AppUser {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }

    // Protect super admin from accidental demotion
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && newRole !== 'admin') {
      throw new Error('Cannot change the role of the Super Administrator.');
    }

    user.role = newRole;

    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error updating user role:', err);
    }

    return user;
  },

  getConfig(): AppConfig {
    let savedConfig: AppConfig = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (err) {
      console.error('Error reading config file:', err);
    }

    return {
      clientId: process.env.GOOGLE_CLIENT_ID || savedConfig.clientId || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || savedConfig.clientSecret || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || savedConfig.redirectUri,
      rootFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || savedConfig.rootFolderId,
    };
  },

  saveConfig(config: AppConfig): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
    } catch (err) {
      console.error('Error saving config file:', err);
    }
  },

  getSubjects(): string[] {
    try {
      if (fs.existsSync(SUBJECTS_FILE)) {
        const raw = fs.readFileSync(SUBJECTS_FILE, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    } catch (err) {
      console.error('Error reading subjects file:', err);
    }
    return [...DEFAULT_SUBJECTS];
  },

  addSubject(subject: string): string[] {
    const clean = subject.trim();
    if (!clean) return this.getSubjects();
    const current = this.getSubjects();
    if (!current.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      current.push(clean);
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
      } catch (err) {
        console.error('Error saving subjects:', err);
      }
    }
    return current;
  },

  deleteSubject(subject: string): string[] {
    const clean = subject.trim().toLowerCase();
    if (clean === 'other') return this.getSubjects(); // 'Other' cannot be removed
    let current = this.getSubjects();
    current = current.filter((s) => s.toLowerCase() !== clean);
    if (!current.includes('Other')) {
      current.push('Other');
    }
    try {
      fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error deleting subject:', err);
    }
    return current;
  },
};
