import React, { useState, useEffect } from 'react';
import {
  Shield,
  HardDrive,
  CheckCircle2,
  Folder,
  Trash2,
  RotateCw,
  Search,
  Users,
  Video,
  FileImage,
  Database,
  BarChart3,
  Lock,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Tag,
  Plus,
  Loader2
} from 'lucide-react';
import { OAuthConfig, AppUser, LessonRecord } from '../types.ts';
import { AdminUserManagement } from './AdminUserManagement.tsx';
import { connectGoogleDrive } from '../lib/firebaseAuth.ts';

interface AdminSettingsProps {
  config: OAuthConfig | null;
  loading: boolean;
  currentUser: AppUser | null;
  onRefresh: () => void;
}

interface StorageMetrics {
  quota: {
    limit: number;
    usage: number;
    usageInDrive: number;
    accountEmail: string;
    accountName: string;
  } | null;
  stats: {
    totalLessons: number;
    videoCount: number;
    photoCount: number;
    pdfCount?: number;
    totalBytes: number;
    totalVideoBytes: number;
    totalPhotoBytes: number;
    totalPdfBytes?: number;
    categoryStats: { category: string; count: number; size: number }[];
  };
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  config,
  loading,
  currentUser,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'lessons' | 'subjects' | 'users' | 'drive'>('storage');
  const [storageData, setStorageData] = useState<StorageMetrics | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [allLessons, setAllLessons] = useState<LessonRecord[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subject management state
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState<string | null>(null);
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // STRICT ACCESS CONTROL GATE:
  // Only users with 'admin' role can view or interact with this component!
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin && currentUser) {
      fetchStorageMetrics();
      fetchAllLessons();
      fetchSubjects();
    }
  }, [isAdmin, currentUser]);

  const fetchSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newSubjectInput.trim()) return;

    setAddingSubject(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ name: newSubjectInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.subjects) {
        setSubjects(data.subjects);
        setNewSubjectInput('');
        setActionMessage(`Subject "${newSubjectInput.trim()}" added successfully.`);
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to add subject');
        setTimeout(() => setErrorMessage(null), 3500);
      }
    } catch {
      setErrorMessage('Error adding subject');
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (sub: string) => {
    if (!currentUser) return;
    if (sub.toLowerCase() === 'other') {
      setErrorMessage('The "Other" subject is a default category and cannot be deleted.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    setDeletingSubject(sub);
    try {
      const res = await fetch(`/api/subjects/${encodeURIComponent(sub)}`, {
        method: 'DELETE',
        headers: { 'x-user-email': currentUser.email },
      });
      const data = await res.json();
      if (res.ok && data.subjects) {
        setSubjects(data.subjects);
        setActionMessage(`Subject "${sub}" removed.`);
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to remove subject');
        setTimeout(() => setErrorMessage(null), 3500);
      }
    } catch {
      setErrorMessage('Error deleting subject');
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setDeletingSubject(null);
    }
  };

  const fetchStorageMetrics = async () => {
    if (!currentUser) return;
    try {
      setLoadingStorage(true);
      const res = await fetch('/api/admin/storage-metrics', {
        headers: { 'x-user-email': currentUser.email },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStorageData(data);
      } else {
        // Fallback to /api/admin/storage
        const fallbackRes = await fetch('/api/admin/storage', {
          headers: { 'x-user-email': currentUser.email },
        });
        const fallbackContentType = fallbackRes.headers.get('content-type') || '';
        if (fallbackRes.ok && fallbackContentType.includes('application/json')) {
          const fallbackData = await fallbackRes.json();
          setStorageData(fallbackData);
        }
      }
    } catch (err) {
      console.warn('Storage metrics fetch notice:', err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const fetchAllLessons = async () => {
    if (!currentUser) return;
    try {
      setLoadingLessons(true);
      const res = await fetch('/api/videos', {
        headers: { 'x-user-email': currentUser.email },
      });
      if (res.ok) {
        const data = await res.json();
        setAllLessons(data.lessons || []);
      }
    } catch (err) {
      console.error('Failed to load lessons list:', err);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleAdminDeleteLesson = async (id: string, title: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/admin/videos/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-email': currentUser.email },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`"${title}" deleted successfully.`);
        setConfirmDeleteLessonId(null);
        fetchAllLessons();
        fetchStorageMetrics();
        onRefresh();
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to delete lesson.');
        setTimeout(() => setErrorMessage(null), 3500);
      }
    } catch {
      setErrorMessage('Network error while deleting lesson.');
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/auth/google/disconnect', {
        method: 'POST',
        headers: { 'x-user-email': currentUser.email },
      });
      if (res.ok) {
        setConfirmDisconnect(false);
        onRefresh();
        fetchStorageMetrics();
        setActionMessage('Google Drive disconnected.');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  // If unauthorized, return strict permission blocked notice
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4 ios-glass rounded-2xl border border-sky-400/20 p-6 mt-6">
        <div className="w-12 h-12 bg-sky-500/10 text-sky-700 dark:text-sky-300 rounded-2xl flex items-center justify-center mx-auto border border-sky-400/20">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Admin Clearance Required</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Access to this control panel is restricted exclusively to system administrators. Your account (<span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">{currentUser?.email}</span>) does not hold administrative credentials.
        </p>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) {
      return (gb / 1024).toFixed(2) + ' TB';
    }
    return gb.toFixed(2) + ' GB';
  };

  const quotaLimit = storageData?.quota?.limit || (2 * 1024 * 1024 * 1024 * 1024); // 2 TB fallback
  const quotaUsage = storageData?.quota?.usage || 0;
  const usagePercentage = quotaLimit > 0 ? Math.min(100, Math.round((quotaUsage / quotaLimit) * 100)) : 0;
  const freeBytes = Math.max(0, quotaLimit - quotaUsage);

  const filteredLessons = allLessons.filter(
    (l) =>
      l.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.uploader.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.fileName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 pt-2">
      {/* Admin Panel Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ios-glass border border-sky-400/25 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Shield className="w-3 h-3 text-sky-500" />
            <span>Administrator Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Admin Master Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your Google One 2 TB Drive, monitor storage usage, oversee user roles, and moderate all lessons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStorageMetrics();
              fetchAllLessons();
              onRefresh();
            }}
            className="btn-secondary-glass flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/25 text-sky-900 dark:text-sky-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-sky-400/15 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'storage'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:bg-sky-500/10'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Storage &amp; Quota</span>
        </button>

        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'lessons'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:bg-sky-500/10'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Lessons ({allLessons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'subjects'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:bg-sky-500/10'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Manage Subjects ({subjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:bg-sky-500/10'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users &amp; Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('drive')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'drive'
              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:bg-sky-500/10'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Google Drive</span>
        </button>
      </div>

      {/* TAB 1: STORAGE METRICS & 2 TB GAUGE */}
      {activeTab === 'storage' && (
        <div className="space-y-5">
          {/* Main 2 TB Quota Card */}
          <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-7 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Google One 2 TB Drive Capacity
                  </h2>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connected Account: <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">{storageData?.quota?.accountEmail || config?.account?.email || 'Connected Administrator'}</span>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {formatBytes(quotaUsage)} <span className="text-xs text-slate-400 font-normal">/ {formatBytes(quotaLimit)}</span>
                </div>
                <div className="text-[11px] text-sky-700 dark:text-sky-400 font-bold">
                  {formatBytes(freeBytes)} Available Free Space
                </div>
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Storage Utilization</span>
                <span>{usagePercentage}% Used</span>
              </div>
              <div className="w-full h-2.5 bg-sky-500/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, usagePercentage)}%` }}
                />
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Lessons</div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {storageData?.stats.totalLessons || allLessons.length}
                </div>
              </div>

              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Videos</div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {storageData?.stats.videoCount ?? allLessons.filter(l => l.type === 'video').length}
                </div>
              </div>

              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Photos</div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {storageData?.stats.photoCount ?? allLessons.filter(l => l.type === 'photo').length}
                </div>
              </div>

              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PDF Notes</div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {storageData?.stats.pdfCount ?? allLessons.filter(l => l.type === 'pdf').length}
                </div>
              </div>

              <div className="p-3 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-0.5 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Drive Volume</div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono truncate">
                  {formatBytes(storageData?.stats.totalBytes || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Subject Breakdown Card */}
          <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-7 shadow-xs space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Storage Usage by Subject Category
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {['Mathematics', 'Science', 'English', 'Other'].map((cat) => {
                const count = allLessons.filter((l) => l.category === cat).length;
                const size = allLessons
                  .filter((l) => l.category === cat)
                  .reduce((acc, l) => acc + (l.size || 0), 0);
                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-xl border border-sky-400/20 bg-sky-500/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{cat}</span>
                      <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300">
                        {formatBytes(size)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {count} {count === 1 ? 'lesson item' : 'lesson items'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      PrivateTeacherVideos/{cat}/
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LESSONS & DELETE MANAGER */}
      {activeTab === 'lessons' && (
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                All Published Platform Lessons
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Super administrators have authority to delete any material from Google Drive.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search lessons or teachers..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl ios-input text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No lessons match your search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sky-400/15 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2 font-semibold">Lesson</th>
                    <th className="py-2.5 px-2 font-semibold">Subject</th>
                    <th className="py-2.5 px-2 font-semibold">Type</th>
                    <th className="py-2.5 px-2 font-semibold">Teacher</th>
                    <th className="py-2.5 px-2 font-semibold">File Size</th>
                    <th className="py-2.5 px-2 font-semibold">Date</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-400/10">
                  {filteredLessons.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-500/5 transition-colors">
                      <td className="py-3 px-2 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-2 capitalize text-slate-500 dark:text-slate-400">
                        {item.type}
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{item.uploader}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{item.uploaderEmail}</div>
                      </td>
                      <td className="py-3 px-2 font-mono text-slate-500 dark:text-slate-400">
                        {(item.size / (1024 * 1024)).toFixed(1)} MB
                      </td>
                      <td className="py-3 px-2 text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {confirmDeleteLessonId === item.id ? (
                          <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-0.5 rounded-lg">
                            <button
                              onClick={() => handleAdminDeleteLesson(item.id, item.title)}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteLessonId(null)}
                              className="px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteLessonId(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Permanently Delete Lesson from Drive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUBJECT MANAGEMENT (ADD / REMOVE SUBJECTS) */}
      {activeTab === 'subjects' && (
        <div className="space-y-5">
          {/* Header Card */}
          <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-sky-400/15 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Tag className="w-4 h-4 text-sky-500" />
                  <span>Curriculum Subjects Management</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Add or remove subjects across the platform. Uploaded lessons and student homework will dynamically tag to these subjects.
                </p>
              </div>

              <div className="px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-400/20 text-xs font-bold text-sky-700 dark:text-sky-300">
                {subjects.length} Active Subjects
              </div>
            </div>

            {/* Add Subject Form */}
            <form onSubmit={handleAddSubject} className="space-y-2.5 max-w-xl">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Create New Subject
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  placeholder="e.g. Biology, World History, Economics, Art..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs ios-input text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={addingSubject || !newSubjectInput.trim()}
                  className="btn-primary-blue px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
                >
                  {addingSubject ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add Subject</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Subjects immediately appear in teacher lesson uploads, student homework tags, and library filters.
              </p>
            </form>

            {/* List of Subjects */}
            <div className="space-y-2.5 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Current Subjects
              </h3>

              {loadingSubjects ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                  <span>Loading subjects...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {subjects.map((sub) => {
                    const isOther = sub.toLowerCase() === 'other';
                    const lessonCount = allLessons.filter(
                      (l) => l.category.toLowerCase() === sub.toLowerCase()
                    ).length;

                    return (
                      <div
                        key={sub}
                        className="ios-glass rounded-xl p-3.5 flex items-center justify-between group border border-sky-400/15 hover:border-sky-400/40 transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {sub}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 pl-4 block">
                            {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
                          </span>
                        </div>

                        {!isOther && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(sub)}
                            disabled={deletingSubject === sub}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title={`Remove subject "${sub}"`}
                            aria-label={`Remove subject ${sub}`}
                          >
                            {deletingSubject === sub ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USERS & TEACHER PERMISSIONS */}
      {activeTab === 'users' && (
        <AdminUserManagement currentUser={currentUser} />
      )}

      {/* TAB 5: GOOGLE DRIVE CONNECTION */}
      {activeTab === 'drive' && (
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-sky-400/15">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Google Drive Storage Sync
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connected with your Google One 2 TB Drive storage.
              </p>
            </div>
            {config?.connected && (
              confirmDisconnect ? (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-1 rounded-xl">
                  <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold px-1">Disconnect?</span>
                  <button
                    onClick={handleDisconnect}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold btn-secondary-glass text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                >
                  Disconnect Drive
                </button>
              )
            )}
          </div>

          {!config?.connected ? (
            <div className="p-6 rounded-xl bg-sky-500/10 border border-sky-400/30 text-center space-y-4">
              <div className="w-12 h-12 bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-400/30">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Drive is not connected</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Connect your Google One 2 TB Drive to sync and store all uploaded lesson videos, photos, and PDF notes directly to your Google Drive account.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    setActionMessage('Connecting to Google Drive...');
                    await connectGoogleDrive(currentUser.email);
                    setActionMessage('Google Drive connected successfully!');
                    onRefresh();
                    setTimeout(() => setActionMessage(null), 3500);
                  } catch (err: any) {
                    setErrorMessage(err.message || 'Failed to connect Google Drive.');
                    setTimeout(() => setErrorMessage(null), 4000);
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-md shadow-sky-500/30 cursor-pointer inline-flex items-center gap-2"
              >
                <HardDrive className="w-4 h-4" />
                <span>Connect Google Drive</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">Root Storage Folder</div>
                <div className="font-mono text-sky-700 dark:text-sky-300 font-bold">
                  {config?.drive?.rootFolderName || 'PrivateTeacherVideos'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Google Drive Folder ID: {config?.drive?.rootFolderId || 'Auto-Provisioned'}
                </div>
              </div>

              <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-400/15 space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">OAuth Access Scope</div>
                <div className="font-mono text-sky-700 dark:text-sky-300 font-semibold truncate">
                  https://www.googleapis.com/auth/drive.file
                </div>
                <div className="text-[11px] text-slate-400">
                  Restricted to files created by 10PrvDriver only.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
