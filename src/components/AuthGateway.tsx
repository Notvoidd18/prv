import React, { useState } from 'react';
import {
  HardDrive,
  ShieldCheck,
  Video,
  FileImage,
  Sparkles,
  AlertCircle,
  Loader2,
  Lock,
  Zap
} from 'lucide-react';
import { signInWithGoogle } from '../lib/firebaseAuth.ts';
import { AppUser } from '../types.ts';

interface AuthGatewayProps {
  onSignInSuccess: (appUser: AppUser) => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { appUser } = await signInWithGoogle();
      onSignInSuccess(appUser);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full ios-glass-elevated rounded-3xl border border-sky-400/25 shadow-2xl p-7 sm:p-9 space-y-7 text-center">
        {/* App Logo & Badge */}
        <div className="space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-sky-500/30">
            <HardDrive className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ios-glass text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider border border-sky-400/25">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>2 TB Google Drive Cloud Platform</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            10PrvDriver
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Sign in with your Google account to stream video lessons, examine whiteboard photos, and access verified study notes.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Sign-in Button */}
        <div className="space-y-3">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-bold text-xs text-slate-900 dark:text-white bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 border border-sky-400/30 active:scale-98 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <Lock className="w-3 h-3 text-sky-500" />
            <span>Strict role protection • Encrypted streaming</span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="pt-3 border-t border-sky-400/15 grid grid-cols-3 gap-2 text-left">
          <div className="p-2.5 bg-sky-500/5 border border-sky-400/15 rounded-xl space-y-1">
            <Video className="w-3.5 h-3.5 text-sky-500" />
            <div className="text-[10px] font-bold text-slate-900 dark:text-white">10 GB Videos</div>
            <div className="text-[9px] text-slate-400">Full HD playback</div>
          </div>
          <div className="p-2.5 bg-sky-500/5 border border-sky-400/15 rounded-xl space-y-1">
            <FileImage className="w-3.5 h-3.5 text-sky-500" />
            <div className="text-[10px] font-bold text-slate-900 dark:text-white">Photos &amp; Notes</div>
            <div className="text-[9px] text-slate-400">Board snapshots</div>
          </div>
          <div className="p-2.5 bg-sky-500/5 border border-sky-400/15 rounded-xl space-y-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
            <div className="text-[10px] font-bold text-slate-900 dark:text-white">Anti-Download</div>
            <div className="text-[9px] text-slate-400">Secure stream</div>
          </div>
        </div>
      </div>
    </div>
  );
};
