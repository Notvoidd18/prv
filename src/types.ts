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

export interface LessonRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  gradeLevel?: string;
  type: LessonType;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration?: number;
  posterUrl?: string;
  masterPlaylistUrl?: string;
  availableQualities?: string[];
  processingStatus?: 'processing' | 'ready' | 'failed';
  createdAt: string;
  uploader: string;
  uploaderEmail?: string;
}

export type VideoRecord = LessonRecord;

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

export interface OAuthConfig {
  configured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  maskedClientId: string;
  redirectUri: string;
  connected: boolean;
  account: {
    email: string;
    name: string;
    picture?: string;
    connectedAt: string;
  } | null;
  drive: {
    rootFolderId?: string;
    rootFolderName?: string;
    categoryFolders?: Record<string, string>;
  } | null;
  quota: {
    limit: number;
    usage: number;
    usageInDrive: number;
    usageInDriveTrash: number;
    accountEmail: string;
    accountName: string;
  } | null;
  sampleRenderCallback: string;
}

export interface AISearchResult {
  query: string;
  answer: string;
  matchedLessonIds: string[];
  matchedHomeworkIds: string[];
  keyTopics: string[];
}
