/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { AuthGateway } from './components/AuthGateway.tsx';
import { AdminSettings } from './components/AdminSettings.tsx';
import { TeacherStudio } from './components/TeacherStudio.tsx';
import { StudentLibrary } from './components/StudentLibrary.tsx';
import { StudentHub } from './components/StudentHub.tsx';
import { LiveClassesUpcoming } from './components/LiveClassesUpcoming.tsx';
import { VideoPlayerModal, PreviewItem } from './components/VideoPlayerModal.tsx';
import { UserSettingsModal } from './components/UserSettingsModal.tsx';
import { OAuthConfig, LessonRecord, HomeworkRecord, AppUser } from './types.ts';
import { initAuthListener, syncUserWithBackend, signInWithGoogle } from './lib/firebaseAuth.ts';
import { ShieldCheck, Heart, Sparkles } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'student' | 'homework' | 'live' | 'teacher' | 'admin'>('student');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [config, setConfig] = useState<OAuthConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PreviewItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('10prv_dark_mode') === 'true';
  });

  // App-level Toast Notification (replaces window.alert for iFrame compatibility)
  const [toastMsg, setToastMsg] = useState<{ message: string; type?: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('10prv_dark_mode', String(darkMode));
  }, [darkMode]);

  // Check URL pathname for direct admin route navigation
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/admin')) {
      setCurrentTab('admin');
    }
  }, []);

  // Listen to Google Auth state
  useEffect(() => {
    const unsubscribe = initAuthListener(async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser && firebaseUser.email) {
        try {
          const appUser = await syncUserWithBackend(firebaseUser);
          setCurrentUser(appUser);
        } catch (err) {
          console.error('Error syncing user with backend:', err);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/oauth/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to load OAuth config:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const fetchLessons = useCallback(async () => {
    try {
      setLoadingLessons(true);
      const headers: Record<string, string> = {};
      if (currentUser?.email) {
        headers['x-user-email'] = currentUser.email;
      }
      const res = await fetch('/api/videos', { headers });
      if (res.ok) {
        const data = await res.json();
        setLessons(data.videos || []);
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoadingLessons(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    fetchLessons();
  }, [currentUser, fetchLessons]);

  const handleDeleteLesson = async (id: string) => {
    // Immediate optimistic removal from local state for instant zero-lag response
    setLessons((prev) => prev.filter((l) => l.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }

    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: currentUser?.email ? { 'x-user-email': currentUser.email } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to delete lesson.', 'error');
        fetchLessons();
      } else {
        showToast('Lesson deleted successfully.', 'success');
        fetchLessons();
      }
    } catch (err) {
      console.error('Network error deleting lesson:', err);
      showToast('Network error deleting lesson.', 'error');
      fetchLessons();
    }
  };

  const handleSignInClick = async () => {
    try {
      const { appUser } = await signInWithGoogle();
      setCurrentUser(appUser);
      showToast('Signed in successfully with Google.', 'success');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(err.message || 'Sign in failed. Please try again.', 'error');
      }
    }
  };

  // Safe navigation gate: if not admin, don't allow tab switch to admin
  const handleTabChange = (tab: 'student' | 'homework' | 'live' | 'teacher' | 'admin') => {
    if (tab === 'admin' && currentUser?.role !== 'admin') {
      showToast('Administrator clearance required to access this area.', 'error');
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-slate-50 dark:bg-[#070b14] flex flex-col font-sans text-slate-900 dark:text-slate-100 antialiased selection:bg-sky-500 selection:text-white transition-colors pb-24 md:pb-6">
      {/* Toast Notification Container */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
          <div
            className={`pointer-events-auto px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-xl flex items-center gap-2 ${
              toastMsg.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-900 dark:text-rose-200'
                : toastMsg.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'ios-glass border-sky-400/30 text-sky-900 dark:text-sky-100'
            }`}
          >
            <span>{toastMsg.message}</span>
          </div>
        </div>
      )}

      {/* Subtle Atmospheric Light Blue Glass Light Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-sky-400/15 dark:bg-sky-500/12 rounded-full blur-3xl animate-pulse duration-1000" />
        <div className="absolute top-1/4 -right-32 w-[30rem] h-[30rem] bg-cyan-300/15 dark:bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-[28rem] h-[28rem] bg-blue-400/12 dark:bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation Header */}
      <div className="relative z-40">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={handleTabChange}
          config={config}
          currentUser={currentUser}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSignOut={() => {
            setCurrentUser(null);
            setCurrentTab('student');
          }}
          onSignInClick={handleSignInClick}
        />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Student Library / Courses / Preview (Publicly accessible) */}
        {currentTab === 'student' && (
          <StudentLibrary
            lessons={lessons}
            currentUser={currentUser}
            onSelectLesson={(lesson) => setSelectedItem(lesson)}
            onNavigateToUpload={() => {
              if (!currentUser) {
                showToast('Please sign in with Google to upload lessons.', 'info');
                setCurrentTab('teacher');
              } else {
                setCurrentTab('teacher');
              }
            }}
            onDeleteLesson={handleDeleteLesson}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* Homework Hub (Publicly accessible) */}
        {currentTab === 'homework' && (
          <StudentHub
            currentUser={currentUser}
            onOpenPreview={(hw) =>
              setSelectedItem({
                ...hw,
                isHomework: true,
                uploader: hw.studentName,
                uploaderEmail: hw.studentEmail,
              } as PreviewItem)
            }
            onNavigateToLibrary={() => setCurrentTab('student')}
          />
        )}

        {/* Live Classes (Publicly accessible) */}
        {currentTab === 'live' && <LiveClassesUpcoming />}

        {/* Teacher Studio & Admin Settings (Require Sign In) */}
        {(currentTab === 'teacher' || currentTab === 'admin') && !currentUser ? (
          <AuthGateway onSignInSuccess={(user) => setCurrentUser(user)} />
        ) : (
          <>
            {currentTab === 'teacher' && currentUser && (
              <TeacherStudio
                config={config}
                currentUser={currentUser}
                lessons={lessons.filter(
                  (l) =>
                    currentUser.role === 'admin' ||
                    (l.uploaderEmail && l.uploaderEmail.toLowerCase() === currentUser.email.toLowerCase())
                )}
                onLessonUploaded={fetchLessons}
                onSelectLesson={(lesson) => setSelectedItem(lesson)}
                onDeleteLesson={handleDeleteLesson}
                onNavigateToSettings={() => {
                  if (currentUser.role === 'admin' || currentUser.email?.toLowerCase() === 'naveen.an.18.an@gmail.com') {
                    setCurrentTab('admin');
                    window.history.pushState({}, '', '/admin/settings/google-drive');
                  }
                }}
              />
            )}

            {currentTab === 'admin' && currentUser && (
              (currentUser.role === 'admin' || currentUser.email?.toLowerCase() === 'naveen.an.18.an@gmail.com') ? (
                <AdminSettings
                  config={config}
                  loading={loadingConfig}
                  currentUser={currentUser}
                  onRefresh={() => {
                    fetchConfig();
                    fetchLessons();
                  }}
                />
              ) : (
                <div className="py-20 text-center">
                  <div className="text-base font-bold text-slate-800 dark:text-white">
                    Access Restricted
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Only administrators can access this section.
                  </p>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Global Media Preview Modal (Handles Video, Photo, PDF, and Word Docs) */}
      {selectedItem && (
        <VideoPlayerModal
          lesson={selectedItem}
          currentUser={currentUser}
          onClose={() => setSelectedItem(null)}
          onDeleteLesson={handleDeleteLesson}
        />
      )}

      {/* User Preferences & Gemini AI Modal */}
      {isSettingsOpen && (
        <UserSettingsModal
          currentUser={currentUser}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onClose={() => setIsSettingsOpen(false)}
          onApiKeyUpdated={(key) => {
            if (currentUser) {
              setCurrentUser({ ...currentUser, geminiApiKey: key });
            }
          }}
        />
      )}

      {/* Clean Glassmorphic Footer */}
      <footer className="relative z-10 border-t border-sky-400/15 dark:border-sky-400/15 backdrop-blur-xl bg-white/70 dark:bg-[#070b14]/70 py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">10PrvDriver</span>
            <span className="text-sky-500">•</span>
            <span className="text-sky-700 dark:text-sky-300 font-medium">Private Google Drive Cloud</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span>Site made by Naveen</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Anti-Download DRM</span>
            <span className="text-sky-500">•</span>
            <span>Watermark Protected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
