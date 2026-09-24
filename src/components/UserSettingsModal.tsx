import React, { useState, useEffect } from 'react';
import {
  X,
  Moon,
  Sun,
  Settings,
  Shield,
  User,
  Check,
  Sparkles,
  Zap,
  Volume2,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Bot,
  Loader2
} from 'lucide-react';
import { AppUser } from '../types.ts';

interface UserSettingsModalProps {
  currentUser: AppUser | null;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  onClose: () => void;
  onApiKeyUpdated?: (apiKey: string) => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  currentUser,
  darkMode,
  setDarkMode,
  onClose,
  onApiKeyUpdated,
}) => {
  const [defaultQuality, setDefaultQuality] = useState<string>(() => {
    return localStorage.getItem('10prv_default_quality') || '1080p';
  });
  const [autoplay, setAutoplay] = useState<boolean>(() => {
    return localStorage.getItem('10prv_autoplay') !== 'false';
  });
  const [volumeLevel, setVolumeLevel] = useState<number>(() => {
    return parseFloat(localStorage.getItem('10prv_volume') || '1');
  });

  // Gemini API Key state
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return (
      currentUser?.geminiApiKey ||
      localStorage.getItem(`10prv_gemini_key_${currentUser?.email || 'default'}`) ||
      ''
    );
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaveSuccess, setKeySaveSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentUser?.email) {
      // Fetch fresh key status from backend
      fetch('/api/user/gemini-key', {
        headers: { 'x-user-email': currentUser.email },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.hasKey && !geminiApiKey) {
            // Key is present on server
            const stored = localStorage.getItem(`10prv_gemini_key_${currentUser.email}`);
            if (stored) setGeminiApiKey(stored);
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.email]);

  const handleSaveSettings = () => {
    localStorage.setItem('10prv_default_quality', defaultQuality);
    localStorage.setItem('10prv_autoplay', String(autoplay));
    localStorage.setItem('10prv_volume', String(volumeLevel));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSaveGeminiKey = async () => {
    if (!currentUser) return;
    setSavingKey(true);
    try {
      const cleanKey = geminiApiKey.trim();
      const res = await fetch('/api/user/gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ apiKey: cleanKey }),
      });

      if (res.ok) {
        localStorage.setItem(`10prv_gemini_key_${currentUser.email}`, cleanKey);
        setKeySaveSuccess(true);
        if (onApiKeyUpdated) onApiKeyUpdated(cleanKey);
        setTimeout(() => setKeySaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving Gemini key:', err);
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      {/* Glassmorphic Container */}
      <div className="relative w-full max-w-lg ios-glass-elevated rounded-3xl border border-sky-400/20 shadow-2xl p-5 sm:p-7 space-y-5 text-slate-900 dark:text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-sky-400/15">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Setting
              </h2>
              <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                Preferences &amp; Gemini AI Configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-sky-500/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Account Card */}
        {currentUser && (
          <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-400/15 flex items-center gap-3">
            {currentUser.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full border border-sky-400/30 shadow-2xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20">
                  {currentUser.role}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
            </div>
          </div>
        )}

        {/* GEMINI AI FAST SEARCH UNLOCK SECTION */}
        <div className="p-4 sm:p-5 rounded-2xl bg-sky-500/5 border border-sky-400/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Gemini AI Study &amp; OCR
                </h3>
                <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                  Powers homework handwritten OCR &amp; lesson AI study modal
                </p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                geminiApiKey.trim()
                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-400/20'
              }`}
            >
              {geminiApiKey.trim() ? 'Configured' : 'Key Needed'}
            </span>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Enter your personal Gemini API Key below to power instant handwriting OCR on homework photos and interactive AI study assistance on every lecture note.
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Personal Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono pl-3.5 pr-20 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                title={showApiKey ? 'Hide' : 'Show'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-bold"
              >
                <span>Get a free key from Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={handleSaveGeminiKey}
                disabled={savingKey}
                className="btn-primary-blue px-3.5 py-1.5 rounded-xl font-bold cursor-pointer disabled:opacity-50 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Save Key</span>
                  </>
                )}
              </button>
            </div>

            {keySaveSuccess && (
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-400/25 text-sky-900 dark:text-sky-200 text-[11px] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Gemini API Key saved. AI Fast Search is now unlocked.</span>
              </div>
            )}
          </div>
        </div>

        {/* Theme Settings (Light / Dark Mode) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Interface Theme
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setDarkMode(false)}
              className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                !darkMode
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400/40 shadow-sm'
                  : 'btn-secondary-glass text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Light Glass</span>
            </button>

            <button
              onClick={() => setDarkMode(true)}
              className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                darkMode
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400/40 shadow-sm'
                  : 'btn-secondary-glass text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Dark Glass</span>
            </button>
          </div>
        </div>

        {/* Video Player Preferences */}
        <div className="space-y-3 pt-2 border-t border-sky-400/15">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Player Defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Default Stream Quality
              </label>
              <select
                value={defaultQuality}
                onChange={(e) => setDefaultQuality(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl ios-input text-slate-900 dark:text-white"
              >
                <option value="Auto">Auto (Source)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
                <option value="480p">480p SD</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Autoplay Next
              </label>
              <button
                onClick={() => setAutoplay(!autoplay)}
                className={`w-full text-xs px-3 py-2 rounded-xl border text-left font-bold cursor-pointer transition-colors ${
                  autoplay
                    ? 'bg-sky-500 text-white border-sky-400/30'
                    : 'btn-secondary-glass text-slate-400'
                }`}
              >
                {autoplay ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/25 text-sky-900 dark:text-sky-200 text-xs font-semibold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Preferences saved.</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-between border-t border-sky-400/15">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleSaveSettings}
            className="btn-primary-blue px-4 py-2 text-xs font-bold rounded-xl cursor-pointer shadow-sm"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
