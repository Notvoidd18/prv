import React from 'react';
import {
  HardDrive,
  Video,
  Shield,
  LogOut,
  BookOpen,
  Moon,
  Sun,
  FileCheck2,
  Settings,
} from 'lucide-react';
import { OAuthConfig, AppUser } from '../types.ts';
import { signOutUser } from '../lib/firebaseAuth.ts';

interface NavbarProps {
  currentTab: 'student' | 'homework' | 'teacher' | 'admin';
  setCurrentTab: (tab: 'student' | 'homework' | 'teacher' | 'admin') => void;
  config: OAuthConfig | null;
  currentUser: AppUser | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onSignInClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  config,
  currentUser,
  darkMode,
  onToggleDarkMode,
  onOpenSettings,
  onSignOut,
  onSignInClick,
}) => {
  const isTeacherOrAdmin = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  const handleSignOut = async () => {
    try {
      await signOutUser();
      onSignOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
      case 'teacher':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default:
        return 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/20';
    }
  };

  return (
    <>
      {/* Floating Top Header Bar */}
      <header className="sticky top-0 z-40 transition-all pt-2.5 pb-2 px-3 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="ios-nav-surface rounded-2xl sm:rounded-3xl border border-sky-400/20 dark:border-sky-400/20 shadow-[0_8px_30px_rgb(14,165,233,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3.5 sm:px-5 py-2.5 flex items-center justify-between transition-all">
          {/* Brand Logo - 10PrvDriver */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('student')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-sky-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/30 group-hover:scale-105 transition-transform">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    10PrvDriver
                  </span>
                </div>
                <div className="text-[10px] text-sky-700 dark:text-sky-400 font-medium">
                  Google Drive Classroom
                </div>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-sky-500/8 dark:bg-sky-500/10 border border-sky-400/15 dark:border-sky-400/20">
            {/* Student Lessons Tab */}
            <button
              onClick={() => setCurrentTab('student')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'student'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-500/10'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lessons & Library</span>
            </button>

            {/* Student Hub / Homework Tab */}
            <button
              onClick={() => setCurrentTab('homework')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'homework'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-500/10'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Homework Hub</span>
            </button>

            {/* Teacher Studio (Gated for Teachers/Admins) */}
            {isTeacherOrAdmin && (
              <button
                onClick={() => setCurrentTab('teacher')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'teacher'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-500/10'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Teacher Studio</span>
              </button>
            )}

            {/* Admin Panel (Gated strictly for Admins) */}
            {isAdmin && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'admin'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-sky-500/10'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-sky-500/15 border border-sky-400/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Setting"
              aria-label="Setting"
            >
              <Settings className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Setting</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-600 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300 hover:bg-sky-500/10 border border-sky-400/20 transition-all cursor-pointer"
              title="Toggle Dark / Light Mode"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-sky-400" /> : <Moon className="w-4 h-4 text-sky-600" />}
            </button>

            {/* User Account / Sign In */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-sky-400/20">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900 dark:text-white max-w-[120px] truncate">
                    {currentUser.name}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${getRoleBadgeStyle(
                      currentUser.role
                    )}`}
                  >
                    {currentUser.role}
                  </span>
                </div>

                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full border-2 border-sky-400/40 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignInClick}
                className="px-4 py-1.5 rounded-xl btn-primary-blue text-xs font-bold cursor-pointer transition-all shadow-md"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Dock for Mobile Devices */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-md mx-auto pointer-events-auto">
        <nav className="ios-nav-surface rounded-2xl p-1.5 flex items-center justify-around shadow-[0_12px_36px_rgba(14,165,233,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.7)] border border-sky-400/25 backdrop-blur-2xl">
          <button
            onClick={() => setCurrentTab('student')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[54px] ${
              currentTab === 'student'
                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/35 font-bold scale-[1.03]'
                : 'text-slate-500 hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Lessons</span>
          </button>

          <button
            onClick={() => setCurrentTab('homework')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[54px] ${
              currentTab === 'homework'
                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/35 font-bold scale-[1.03]'
                : 'text-slate-500 hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            <FileCheck2 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Homework</span>
          </button>

          {isTeacherOrAdmin && (
            <button
              onClick={() => setCurrentTab('teacher')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[54px] ${
                currentTab === 'teacher'
                  ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/35 font-bold scale-[1.03]'
                  : 'text-slate-500 hover:text-sky-600 dark:hover:text-sky-400'
              }`}
            >
              <Video className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">Studio</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[54px] ${
                currentTab === 'admin'
                  ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/35 font-bold scale-[1.03]'
                  : 'text-slate-500 hover:text-sky-600 dark:hover:text-sky-400'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">Admin</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[54px] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
            title="Setting"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Setting</span>
          </button>
        </nav>
      </div>
    </>
  );
};
