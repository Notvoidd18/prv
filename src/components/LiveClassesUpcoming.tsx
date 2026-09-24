import React, { useState } from 'react';
import {
  Video,
  PhoneCall,
  Users,
  Presentation,
  Bell,
  Sparkles,
  CheckCircle2,
  Calendar,
  Shield,
  Laptop
} from 'lucide-react';

export const LiveClassesUpcoming: React.FC = () => {
  const [subscribed, setSubscribed] = useState(false);

  const handleNotifyMe = () => {
    setSubscribed(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 pt-2">
      {/* Centered Hero */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full ios-glass border border-sky-400/25 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-sky-500" />
          <span>Upcoming Platform Capabilities</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Live Video Calls &amp; Online Classes
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Direct real-time interactive teaching. Connect with teachers for 1-on-1 mentoring sessions, participate in scheduled live webinars, and brainstorm on collaborative whiteboards.
        </p>
      </div>

      {/* Feature Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: 1-on-1 Video Calls */}
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-6 space-y-3 shadow-xs hover:border-sky-400/40 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20 mb-1.5 uppercase">
              COMING SOON
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              1-on-1 Teacher Video Calls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Instant and scheduled high-definition private video calls between students and instructors for doubt clearing and personalized coaching.
            </p>
          </div>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-sky-500" />
            <span>Encrypted WebRTC Audio &amp; Video Streams</span>
          </div>
        </div>

        {/* Card 2: Interactive Online Classes */}
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-6 space-y-3 shadow-xs hover:border-sky-400/40 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
            <Presentation className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20 mb-1.5 uppercase">
              SCHEDULED STREAMING
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Broadcast Online Classrooms
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Broadcast live lectures to entire classrooms with screen sharing, slide presentation controls, and live Q&amp;A chat.
            </p>
          </div>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <Laptop className="w-3.5 h-3.5 text-sky-500" />
            <span>Full-Screen 1080p Screen &amp; Audio Broadcast</span>
          </div>
        </div>

        {/* Card 3: Interactive Shared Whiteboard */}
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-6 space-y-3 shadow-xs hover:border-sky-400/40 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20 mb-1.5 uppercase">
              COLLABORATION
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Live Interactive Whiteboard
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Collaborative canvas for writing equations, sketching diagrams, and explaining complex concepts during live calls in real time.
            </p>
          </div>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Multi-user real-time ink &amp; geometry tools</span>
          </div>
        </div>

        {/* Card 4: Automated Drive Cloud Recording */}
        <div className="ios-glass-elevated rounded-2xl border border-sky-400/20 p-5 sm:p-6 space-y-3 shadow-xs hover:border-sky-400/40 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20 mb-1.5 uppercase">
              AUTO-ARCHIVE
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Instant 2 TB Cloud Archiving
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Every live class session can be auto-recorded and archived straight into the designated category folder in your 2 TB Google Drive.
            </p>
          </div>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Automatic indexing in the Lessons Library</span>
          </div>
        </div>
      </div>

      {/* Early Access Notification Callout */}
      <div className="ios-glass-elevated rounded-2xl border border-sky-400/25 p-6 sm:p-8 text-center space-y-4 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
        <div className="max-w-md mx-auto space-y-1.5">
          <div className="w-10 h-10 bg-sky-500/15 rounded-xl flex items-center justify-center mx-auto mb-2 text-sky-600 dark:text-sky-400 border border-sky-400/20">
            <Bell className="w-5 h-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Be the First to Access Live Calls
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Live classes and teacher calls are entering final integration. Click below to receive priority access as soon as the live call engine goes live.
          </p>
        </div>

        <div>
          {subscribed ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-800 dark:text-sky-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>You are registered for Early Access! We will notify your Google account.</span>
            </div>
          ) : (
            <button
              onClick={handleNotifyMe}
              className="btn-primary-blue inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-md"
            >
              <Bell className="w-4 h-4" />
              <span>Notify Me for Live Classes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
