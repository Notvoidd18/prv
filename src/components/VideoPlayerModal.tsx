import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  X,
  HardDrive,
  Folder,
  ShieldCheck,
  Calendar,
  User,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Lock,
  Check,
  RotateCcw,
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink,
  BookOpen,
  Sparkles,
  Copy,
  ChevronLeft,
  ChevronRight,
  Download,
  Repeat,
  Tv,
  Bookmark,
  Plus,
  HelpCircle,
  Clock,
  FastForward,
  Rewind,
  Sun,
  Share2,
  Send,
  MessageSquare,
  Info,
} from 'lucide-react';
import { LessonRecord, HomeworkRecord, AppUser } from '../types.ts';

export type PreviewItem =
  | LessonRecord
  | (HomeworkRecord & { isHomework?: boolean; uploader?: string; uploaderEmail?: string });

interface VideoPlayerModalProps {
  lesson: PreviewItem | null;
  currentUser: AppUser | null;
  onClose: () => void;
  onDeleteLesson?: (id: string) => Promise<void> | void;
  lessons?: PreviewItem[];
  onSelectLesson?: (lesson: PreviewItem) => void;
}

export type QualityOption = 'Auto' | '1080p' | '720p' | '480p' | '360p';
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

interface TimestampBookmark {
  id: string;
  time: number;
  label: string;
  createdAt: string;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  lesson,
  currentUser,
  onClose,
  onDeleteLesson,
  lessons = [],
  onSelectLesson,
}) => {
  if (!lesson) return null;

  const isHomework = (lesson as any).studentEmail !== undefined || (lesson as any).isHomework;
  const isPhoto = lesson.type === 'photo';
  const isPdf = lesson.type === 'pdf';
  const isDoc = lesson.type === 'doc';
  const isVideo = !isPhoto && !isPdf && !isDoc;
  const masterPlaylistUrl = (lesson as any).masterPlaylistUrl;

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showAiDoubtModal, setShowAiDoubtModal] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('Auto');
  const [selectedSpeed, setSelectedSpeed] = useState<PlaybackSpeed>(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qualitySwitchNotice, setQualitySwitchNotice] = useState<string | null>(null);
  const [volumeHudNotice, setVolumeHudNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAiNotes, setCopiedAiNotes] = useState(false);

  // AI Doubt Solver State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Double click ripple animation feedback
  const [seekRipple, setSeekRipple] = useState<{ direction: 'forward' | 'backward'; count: number } | null>(null);

  // Timeline hover scrub tooltip
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionX, setHoverPositionX] = useState<number>(0);

  // Touch Swipe Gesture State
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwiping = useRef(false);

  // Bookmarks / Lecture Timestamps
  const bookmarkStorageKey = `10prv_bookmarks_${lesson.id}`;
  const [bookmarks, setBookmarks] = useState<TimestampBookmark[]>(() => {
    try {
      const saved = localStorage.getItem(bookmarkStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newNoteText, setNewNoteText] = useState('');

  // Resolution detection
  const [availableQualities, setAvailableQualities] = useState<QualityOption[]>([
    'Auto',
    '1080p',
    '720p',
    '480p',
    '360p',
  ]);

  // Periodic watermark position shift
  const [watermarkPos, setWatermarkPos] = useState({ top: '18%', left: '15%' });

  // Multi-photo state
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Progressive buffer loading state
  const [bufferedEnd, setBufferedEnd] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);
  const hudTimeoutRef = useRef<any>(null);

  // Playlist index tracking for Next / Previous buttons
  const currentIndex = lessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const isTeacherOrAdmin = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  // Save bookmarks
  const saveBookmarks = (list: TimestampBookmark[]) => {
    setBookmarks(list);
    try {
      localStorage.setItem(bookmarkStorageKey, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save bookmark:', e);
    }
  };

  const addBookmark = () => {
    if (!videoRef.current) return;
    const time = Math.floor(videoRef.current.currentTime);
    const label = newNoteText.trim() || `Lecture note at ${formatTime(time)}`;
    const newEntry: TimestampBookmark = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time,
      label,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    saveBookmarks([...bookmarks, newEntry]);
    setNewNoteText('');
  };

  const removeBookmark = (id: string) => {
    saveBookmarks(bookmarks.filter((b) => b.id !== id));
  };

  const jumpToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  // Trigger on-screen HUD for volume/actions
  const showHud = (text: string) => {
    setVolumeHudNotice(text);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setVolumeHudNotice(null);
    }, 1500);
  };

  // Copy Timestamped Link
  const handleCopyLink = () => {
    const timeSec = Math.floor(currentTime);
    const url = `${window.location.origin}/?lesson=${lesson.id}&t=${timeSec}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      showHud(`Link copied at ${formatTime(timeSec)}`);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Ask AI Doubt Solver
  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/ask-lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          prompt: aiQuestion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to get answer from AI tutor.');
      }
      setAiAnswer(data.answer);
    } catch (err: any) {
      setAiError(err.message || 'AI request failed.');
    } finally {
      setAiLoading(false);
    }
  };

  // Touch Gesture Handlers (Swipe Left/Right for Seek/Pages, Swipe Up/Down for Volume/Brightness)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isSwiping.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPos.current || !isSwiping.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.current.x;
    const deltaY = touch.clientY - touchStartPos.current.y;

    // Check if vertical swipe on left vs right side
    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isRightSide = touchStartPos.current.x > rect.left + rect.width / 2;

      if (isRightSide) {
        // Adjust Volume
        const step = deltaY < 0 ? 0.02 : -0.02;
        adjustVolume(step);
      } else {
        // Adjust Brightness
        const step = deltaY < 0 ? 0.02 : -0.02;
        setBrightness((prev) => {
          const next = Math.max(0.5, Math.min(1.5, prev + step));
          showHud(`Brightness: ${Math.round(next * 100)}%`);
          return next;
        });
      }
      touchStartPos.current.y = touch.clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPos.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartPos.current.x;
    const deltaY = touch.clientY - touchStartPos.current.y;
    const durationMs = Date.now() - touchStartPos.current.time;

    // Horizontal Swipe detection
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) && durationMs < 500) {
      if (isVideo) {
        if (deltaX > 0) {
          seekDelta(10);
        } else {
          seekDelta(-10);
        }
      } else if (isPhoto) {
        const totalPhotos = (lesson as any).fileNames?.length || 1;
        if (deltaX < 0 && currentPhotoIndex < totalPhotos - 1) {
          setCurrentPhotoIndex((prev) => prev + 1);
          showHud(`Page ${currentPhotoIndex + 2} of ${totalPhotos}`);
        } else if (deltaX > 0 && currentPhotoIndex > 0) {
          setCurrentPhotoIndex((prev) => prev - 1);
          showHud(`Page ${currentPhotoIndex} of ${totalPhotos}`);
        }
      }
    }

    touchStartPos.current = null;
    isSwiping.current = false;
  };

  // Initialize HLS / Native Progressive Stream
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const video = videoRef.current;
    const fallbackUrl = `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(currentUser?.email || '')}`;

    let hlsInstance: any = null;

    if (masterPlaylistUrl && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: false,
        autoStartLoad: true,
        startLevel: -1,
        startFragPrefetch: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 30,
        progressive: true,
        abrEwmaDefaultEstimate: 4000000,
      });
      hlsRef.current = hlsInstance;
      hlsInstance.loadSource(masterPlaylistUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
        const levels = (data.levels || []).map((lvl: any) => `${lvl.height}p` as any as QualityOption);
        if (levels.length > 0) {
          setAvailableQualities(['Auto', ...(Array.from(new Set(levels)) as QualityOption[])]);
        }
        video.play().catch(() => {});
      });

      hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
        const lvl = hlsInstance?.levels[data.level];
        if (lvl) {
          setQualitySwitchNotice(`Quality: ${lvl.height}p`);
          setTimeout(() => setQualitySwitchNotice(null), 2000);
        }
      });

      hlsInstance.on(Hls.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          console.warn('HLS fallback to progressive stream:', data.details);
          hlsInstance?.destroy();
          hlsRef.current = null;
          video.src = fallbackUrl;
          video.load();
          video.play().catch(() => {});
        }
      });
    } else if (masterPlaylistUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = masterPlaylistUrl;
      video.play().catch(() => {});
    } else {
      video.src = fallbackUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsRef.current = null;
      }
    };
  }, [lesson.id, isVideo, masterPlaylistUrl, currentUser?.email]);

  // Watermark drifting animation
  useEffect(() => {
    const timer = setInterval(() => {
      const top = `${12 + Math.floor(Math.random() * 65)}%`;
      const left = `${12 + Math.floor(Math.random() * 55)}%`;
      setWatermarkPos({ top, left });
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Controls auto-hide timer
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setShowSettings(false);
        setShowSpeedMenu(false);
      }
    }, 3200);
  }, [isPlaying]);

  // Comprehensive Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (!isVideo) {
        if (e.key === 'Escape') onClose();
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
          e.preventDefault();
          setIsTheaterMode((prev) => !prev);
          showHud(isTheaterMode ? 'Default View' : 'Theater Mode');
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'arrowup':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'r':
          e.preventDefault();
          setIsLooping((l) => {
            const next = !l;
            if (videoRef.current) videoRef.current.loop = next;
            showHud(next ? 'Loop: On' : 'Loop: Off');
            return next;
          });
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case '?':
        case 'h':
          e.preventDefault();
          setShowShortcutsModal((prev) => !prev);
          break;
        case 'escape':
          if (showShortcutsModal) {
            setShowShortcutsModal(false);
          } else if (showAiDoubtModal) {
            setShowAiDoubtModal(false);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (videoRef.current && duration > 0) {
            e.preventDefault();
            const pct = parseInt(e.key, 10) * 0.1;
            const target = duration * pct;
            videoRef.current.currentTime = target;
            setCurrentTime(target);
            showHud(`${parseInt(e.key, 10) * 10}%`);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideo, isPlaying, isFullscreen, isTheaterMode, duration, showShortcutsModal, showAiDoubtModal]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setControlsVisible(true);
      showHud('Paused');
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      resetControlsTimeout();
      showHud('Playing');
    }
  };

  const seekDelta = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    showHud(`${seconds > 0 ? '+' : ''}${seconds}s`);
    resetControlsTimeout();
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftSide = clickX < rect.width / 2;

    if (isLeftSide) {
      seekDelta(-10);
      setSeekRipple({ direction: 'backward', count: 10 });
    } else {
      seekDelta(10);
      setSeekRipple({ direction: 'forward', count: 10 });
    }

    setTimeout(() => {
      setSeekRipple(null);
    }, 650);
  };

  const adjustVolume = (delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    videoRef.current.volume = newVol;
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    showHud(`Volume: ${Math.round(newVol * 100)}%`);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
    showHud(next ? 'Muted' : `Volume: ${Math.round(volume * 100)}%`);
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const buff = videoRef.current.buffered;
      const curTime = videoRef.current.currentTime;
      for (let i = 0; i < buff.length; i++) {
        if (buff.start(i) <= curTime && curTime <= buff.end(i)) {
          setBufferedEnd(buff.end(i));
          return;
        }
      }
      setBufferedEnd(buff.end(buff.length - 1));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      handleProgress();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    setCurrentTime(target);
  };

  const handleSeekBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = offsetX / rect.width;
    setHoverTime(pct * duration);
    setHoverPositionX(offsetX);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setIsBuffering(false);
  };

  const handleSpeedChange = (speed: PlaybackSpeed) => {
    setSelectedSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    showHud(`Speed: ${speed}x`);
  };

  const handleQualityChange = (quality: QualityOption) => {
    if (quality === selectedQuality) {
      setShowSettings(false);
      return;
    }

    setSelectedQuality(quality);
    setShowSettings(false);

    setQualitySwitchNotice(`Quality: ${quality}`);
    setTimeout(() => {
      setQualitySwitchNotice(null);
    }, 2000);

    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      if (quality === 'Auto') {
        hlsRef.current.nextLevel = -1;
        hlsRef.current.currentLevel = -1;
      } else {
        const targetHeight = parseInt(quality.replace('p', ''), 10);
        const levelIndex = hlsRef.current.levels.findIndex((l: any) => l.height === targetHeight);
        if (levelIndex !== -1) {
          hlsRef.current.nextLevel = levelIndex;
        }
      }
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      } catch (e) {
        console.warn('Fullscreen error:', e);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (e) {
        console.warn('Exit fullscreen error:', e);
      }
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        showHud('Exited PiP');
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        showHud('Picture-in-Picture Active');
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDelete = async () => {
    if (!onDeleteLesson) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteLesson(lesson.id);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete lesson.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        onMouseMove={resetControlsTimeout}
        className={`relative w-full ${
          isTheaterMode ? 'max-w-[98vw] h-[92vh]' : 'max-w-5xl max-h-[92vh]'
        } bg-slate-950 rounded-2xl sm:rounded-3xl border border-sky-400/20 shadow-2xl overflow-hidden flex flex-col transition-all duration-300`}
      >
        {/* Top Header Bar */}
        <div className="relative z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-400/30 shrink-0">
              {isPhoto ? (
                <ImageIcon className="w-4 h-4" />
              ) : isPdf || isDoc ? (
                <FileText className="w-4 h-4" />
              ) : (
                <VideoIcon className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">{lesson.title}</h3>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>{lesson.category}</span>
                <span aria-hidden="true">·</span>
                <span>{lesson.uploader || 'Instructor'}</span>
                {lesson.size > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {lesson.size > 1024 * 1024 * 1024
                        ? `${(lesson.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                        : `${(lesson.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Previous Lesson Button */}
            {prevLesson && onSelectLesson && (
              <button
                onClick={() => onSelectLesson(prevLesson)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title={`Previous: ${prevLesson.title}`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>
            )}

            {/* Next Lesson Button */}
            {nextLesson && onSelectLesson && (
              <button
                onClick={() => onSelectLesson(nextLesson)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title={`Next: ${nextLesson.title}`}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* AI Doubt Solver Button */}
            <button
              onClick={() => setShowAiDoubtModal((p) => !p)}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                showAiDoubtModal
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400 shadow-md shadow-sky-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-sky-400 hover:text-white border-sky-400/30'
              }`}
              title="Ask AI Doubt Solver"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* Bookmarks Toggle Button */}
            {isVideo && (
              <button
                onClick={() => setShowNotesPanel((p) => !p)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  showNotesPanel
                    ? 'bg-sky-500 text-white border-sky-400'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                }`}
                title="Lecture Notes & Bookmarks"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            )}

            {/* Info & Share Drawer Toggle */}
            <button
              onClick={() => setShowInfoDrawer((p) => !p)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showInfoDrawer
                  ? 'bg-sky-500 text-white border-sky-400'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Lesson Info & Share"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Keyboard Shortcuts Button */}
            {isVideo && (
              <button
                onClick={() => setShowShortcutsModal((p) => !p)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Keyboard Shortcuts (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 border border-white/10 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area (Video, Photo, or PDF) with Touch Swipe Gestures */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[480px]"
          style={{ filter: `brightness(${brightness})` }}
        >
          {isVideo ? (
            <>
              {/* Dynamic Double Tap / Click Gesture Area */}
              <div
                onDoubleClick={handleDoubleTap}
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={togglePlay}
              />

              {/* Video Element */}
              <video
                ref={videoRef}
                preload="auto"
                autoPlay
                playsInline
                controlsList="nodownload nofullscreen"
                onProgress={handleProgress}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={() => {
                  setIsBuffering(false);
                  videoRef.current?.play().catch(() => {});
                }}
                onCanPlay={() => {
                  setIsBuffering(false);
                  videoRef.current?.play().catch(() => {});
                }}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setLoadError('Unable to stream video. Please check your connection.')}
                className="w-full h-full object-contain max-h-[78vh]"
              />

              {/* Security Floating DRM Dynamic Watermark */}
              <div
                className="absolute z-20 pointer-events-none select-none text-[10px] font-mono text-white/20 font-bold px-2 py-0.5 rounded bg-black/20 backdrop-blur-[1px] transition-all duration-1000 ease-in-out"
                style={{ top: watermarkPos.top, left: watermarkPos.left }}
              >
                10Prv · {currentUser?.email || 'Student View'}
              </div>

              {/* On-Screen HUD Action Feedback (Volume, Seek, Speed, Brightness) */}
              {volumeHudNotice && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-2xl bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide pointer-events-none shadow-xl transition-all animate-fade-in">
                  {volumeHudNotice}
                </div>
              )}

              {/* Quality Switch Instant Notice */}
              {qualitySwitchNotice && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-2xl bg-sky-600/90 backdrop-blur-md border border-sky-400/40 text-white text-xs font-bold tracking-wide pointer-events-none shadow-xl transition-all animate-fade-in">
                  {qualitySwitchNotice}
                </div>
              )}

              {/* Double-Tap Skip Ripple Feedback */}
              {seekRipple && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center p-6 rounded-full bg-white/20 backdrop-blur-md text-white font-bold text-sm pointer-events-none shadow-2xl animate-ping ${
                    seekRipple.direction === 'backward' ? 'left-16' : 'right-16'
                  }`}
                >
                  {seekRipple.direction === 'backward' ? (
                    <>
                      <Rewind className="w-8 h-8 mb-1" />
                      <span>-10s</span>
                    </>
                  ) : (
                    <>
                      <FastForward className="w-8 h-8 mb-1" />
                      <span>+10s</span>
                    </>
                  )}
                </div>
              )}

              {/* Buffering Spinner */}
              {isBuffering && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
                  <div className="p-4 rounded-3xl bg-black/70 border border-white/20 flex flex-col items-center gap-2 shadow-2xl">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                    <span className="text-xs font-semibold text-white">Streaming lecture...</span>
                  </div>
                </div>
              )}

              {/* Controls Overlay */}
              <div
                className={`absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
                  controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {/* Dual-Layer Precision Seek Bar with Hover Timecard Tooltip */}
                <div
                  ref={seekBarRef}
                  onMouseMove={handleSeekBarMouseMove}
                  onMouseLeave={() => setHoverTime(null)}
                  className="relative w-full h-2 hover:h-3 bg-white/20 rounded-full transition-all flex items-center group cursor-pointer mb-3"
                >
                  {/* Floating Hover Timecard Tooltip */}
                  {hoverTime !== null && (
                    <div
                      className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-950 border border-white/20 text-white font-mono text-[10px] font-bold shadow-lg pointer-events-none z-30"
                      style={{ left: `${hoverPositionX}px` }}
                    >
                      {formatTime(hoverTime)}
                    </div>
                  )}

                  {/* Progressive Background Download Buffer Fill */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full transition-all duration-200 pointer-events-none"
                    style={{
                      width: `${Math.min(100, (bufferedEnd / (duration || 1)) * 100)}%`,
                    }}
                  />

                  {/* Active Playback Fill */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-400 to-blue-500 rounded-full pointer-events-none shadow-sm"
                    style={{
                      width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%`,
                    }}
                  />

                  {/* Scrubber Knob */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform pointer-events-none"
                    style={{
                      left: `calc(${Math.min(100, (currentTime / (duration || 1)) * 100)}% - 7px)`,
                    }}
                  />

                  {/* Native Range Input Scrub Control */}
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    aria-label="Seek video position"
                  />
                </div>

                {/* Bottom Control Buttons Row */}
                <div className="flex items-center justify-between text-white text-xs">
                  {/* Left Controls (Play, Skip, Volume, Timestamp) */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Play/Pause */}
                    <button
                      onClick={togglePlay}
                      className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                      title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>

                    {/* Rewind 10s */}
                    <button
                      onClick={() => seekDelta(-10)}
                      className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer hidden sm:flex"
                      title="Rewind 10s (J)"
                    >
                      <Rewind className="w-4 h-4" />
                    </button>

                    {/* Fast Forward 10s */}
                    <button
                      onClick={() => seekDelta(10)}
                      className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer hidden sm:flex"
                      title="Forward 10s (L)"
                    >
                      <FastForward className="w-4 h-4" />
                    </button>

                    {/* Volume Controls & Expandable Slider */}
                    <div className="flex items-center gap-1.5 group/vol">
                      <button
                        onClick={toggleMute}
                        className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                        title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : volume < 0.5 ? (
                          <Volume1 className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 sm:w-20 h-1 bg-white/30 rounded appearance-none cursor-pointer accent-sky-400 hover:h-1.5 transition-all"
                        aria-label="Volume slider"
                      />
                    </div>

                    {/* Timestamp Display */}
                    <div className="font-mono text-[11px] text-slate-300 ml-1">
                      <span>{formatTime(currentTime)}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Right Controls (Loop, Speed, Quality, PiP, Theater, Fullscreen) */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Loop Toggle */}
                    <button
                      onClick={() => {
                        setIsLooping((l) => {
                          const next = !l;
                          if (videoRef.current) videoRef.current.loop = next;
                          showHud(next ? 'Loop: On' : 'Loop: Off');
                          return next;
                        });
                      }}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer hidden sm:block ${
                        isLooping ? 'bg-sky-500 text-white' : 'hover:bg-white/20 text-slate-300'
                      }`}
                      title="Toggle Loop (R)"
                    >
                      <Repeat className="w-4 h-4" />
                    </button>

                    {/* Playback Speed Popover Menu */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowSpeedMenu((p) => !p);
                          setShowSettings(false);
                        }}
                        className="px-2 py-1 rounded-lg hover:bg-white/20 transition-colors font-mono text-xs font-bold cursor-pointer"
                        title="Playback Speed"
                      >
                        {selectedSpeed}x
                      </button>

                      {showSpeedMenu && (
                        <div className="absolute bottom-9 right-0 w-32 bg-slate-900 border border-white/15 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-40 space-y-0.5">
                          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                            Speed
                          </div>
                          {([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as PlaybackSpeed[]).map((spd) => (
                            <button
                              key={spd}
                              onClick={() => handleSpeedChange(spd)}
                              className={`w-full text-left px-2.5 py-1 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                selectedSpeed === spd
                                  ? 'bg-sky-500 text-white font-bold'
                                  : 'text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <span>{spd === 1 ? '1.0x (Normal)' : `${spd}x`}</span>
                              {selectedSpeed === spd && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quality Selector Popover Menu */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowSettings((p) => !p);
                          setShowSpeedMenu(false);
                        }}
                        className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                        title="Video Quality"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      {showSettings && (
                        <div className="absolute bottom-9 right-0 w-36 bg-slate-900 border border-white/15 rounded-xl p-1 shadow-2xl backdrop-blur-xl z-40 space-y-0.5">
                          <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                            Quality
                          </div>
                          {availableQualities.map((q) => (
                            <button
                              key={q}
                              onClick={() => handleQualityChange(q)}
                              className={`w-full text-left px-2.5 py-1 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                selectedQuality === q
                                  ? 'bg-sky-500 text-white font-bold'
                                  : 'text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <span>{q}</span>
                              {selectedQuality === q && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Picture-in-Picture */}
                    <button
                      onClick={togglePiP}
                      className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer hidden sm:block"
                      title="Picture-in-Picture (P)"
                    >
                      <Tv className="w-4 h-4" />
                    </button>

                    {/* Theater Mode Toggle */}
                    <button
                      onClick={() => setIsTheaterMode((p) => !p)}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer hidden sm:block ${
                        isTheaterMode ? 'bg-sky-500 text-white' : 'hover:bg-white/20 text-slate-300'
                      }`}
                      title="Theater Mode (T)"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                      title="Fullscreen (F)"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : isPhoto ? (
            /* Photo Viewer with Multi-page Pagination and Swipe */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              {(() => {
                const totalPhotos = (lesson as any).fileNames?.length || 1;
                const photoSrc = isHomework
                  ? `/api/homework/${lesson.id}/file/${currentPhotoIndex}?auth=${encodeURIComponent(
                      currentUser?.email || ''
                    )}`
                  : `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(currentUser?.email || '')}`;

                return (
                  <div className="relative flex items-center justify-center w-full max-h-[75vh]">
                    <img
                      src={photoSrc}
                      alt={`${lesson.title} page ${currentPhotoIndex + 1}`}
                      className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl transition-all duration-200"
                    />

                    {/* Pagination Controls for Multi-Photo Submissions */}
                    {totalPhotos > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentPhotoIndex === 0}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-black/70 hover:bg-black/90 text-white disabled:opacity-30 backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                          title="Previous Page (Swipe Right)"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPhotoIndex((prev) => Math.min(totalPhotos - 1, prev + 1))
                          }
                          disabled={currentPhotoIndex === totalPhotos - 1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-black/70 hover:bg-black/90 text-white disabled:opacity-30 backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                          title="Next Page (Swipe Left)"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/20 shadow-lg">
                          Page {currentPhotoIndex + 1} of {totalPhotos}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : isPdf ? (
            /* PDF Document Viewer */
            <div className="w-full h-[75vh]">
              <iframe
                src={
                  isHomework
                    ? `/api/homework/${lesson.id}/file/0?auth=${encodeURIComponent(currentUser?.email || '')}#toolbar=1`
                    : `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(currentUser?.email || '')}#toolbar=1`
                }
                title={lesson.title}
                className="w-full h-full border-0 rounded-b-2xl bg-white"
              />
            </div>
          ) : (
            /* Word Doc or File fallback */
            <div className="flex flex-col items-center justify-center p-12 text-center text-white space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg">{lesson.title}</h4>
              <p className="text-xs text-slate-400 max-w-md">
                This document is stored securely in your private cloud. You can view it directly or download it below.
              </p>
              <a
                href={
                  isHomework
                    ? `/api/homework/${lesson.id}/file/0?auth=${encodeURIComponent(currentUser?.email || '')}`
                    : `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(currentUser?.email || '')}`
                }
                download={lesson.fileName}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </a>
            </div>
          )}
        </div>

        {/* Lesson Info, Share & Actions Bottom Bar Drawer */}
        {showInfoDrawer && (
          <div className="border-t border-white/10 bg-slate-900/95 p-4 space-y-3 animate-fade-in max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Info className="w-4 h-4 text-sky-400" />
                <span>Lesson Material Overview</span>
              </div>
              <button onClick={() => setShowInfoDrawer(false)} className="text-[11px] text-slate-400 hover:text-white">
                Close
              </button>
            </div>

            <p className="text-xs text-slate-300">{lesson.description || 'No specific description provided.'}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Copy Timestamped Link */}
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{copiedLink ? 'Copied Timestamped Link!' : 'Share with Current Time'}</span>
              </button>

              {/* Direct Download */}
              <a
                href={
                  isHomework
                    ? `/api/homework/${lesson.id}/file/0?auth=${encodeURIComponent(currentUser?.email || '')}`
                    : `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(currentUser?.email || '')}`
                }
                download={lesson.fileName}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 transition-colors border border-white/10"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download File</span>
              </a>

              {/* Delete Button for Teachers / Admins */}
              {isTeacherOrAdmin && onDeleteLesson && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold flex items-center gap-1.5 transition-colors border border-rose-500/30 cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Lesson</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* AI Doubt Solver & Lecture Assistant Sheet */}
        {showAiDoubtModal && (
          <div className="border-t border-white/10 bg-slate-900/98 p-4 space-y-3 animate-fade-in max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Sparkles className="w-4 h-4" />
                <span>Gemini AI Tutor · Instant Doubt Solver</span>
              </div>
              <button
                onClick={() => setShowAiDoubtModal(false)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask any question about this lecture, formula, or concept..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskAi();
                }}
                className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <button
                onClick={handleAskAi}
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Solve</span>
              </button>
            </div>

            {aiError && (
              <div className="text-xs text-rose-400 bg-rose-500/15 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiAnswer && (
              <div className="p-3 bg-black/50 border border-sky-400/30 rounded-xl space-y-2 text-xs text-slate-200">
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="font-bold text-sky-400">AI Tutor Explanation</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiAnswer);
                      setCopiedAiNotes(true);
                      setTimeout(() => setCopiedAiNotes(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedAiNotes ? 'Copied!' : 'Copy Explanation'}</span>
                  </button>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-slate-300 font-sans">{aiAnswer}</div>
              </div>
            )}
          </div>
        )}

        {/* Integrated Lecture Bookmarks / Timestamp Study Notes Panel */}
        {showNotesPanel && isVideo && (
          <div className="border-t border-white/10 bg-slate-900/95 p-4 space-y-3 animate-fade-in max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Bookmark className="w-4 h-4 text-sky-400" />
                <span>Lecture Timestamps & Study Notes</span>
                <span className="text-[10px] text-slate-400 font-normal">({bookmarks.length} saved)</span>
              </div>
              <button
                onClick={() => setShowNotesPanel(false)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Hide
              </button>
            </div>

            {/* Quick Add Bookmark Input */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/15 border border-sky-400/30 px-2 py-1 rounded-lg">
                {formatTime(currentTime)}
              </span>
              <input
                type="text"
                placeholder="Add study note or formula label at current time..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addBookmark();
                }}
                className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <button
                onClick={addBookmark}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bookmark</span>
              </button>
            </div>

            {/* Bookmarks List */}
            {bookmarks.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-1 italic">
                No timestamps bookmarked yet. Add a note to jump quickly to key lecture moments!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => jumpToTime(bm.time)}
                    className="flex items-center justify-between p-2 rounded-xl bg-black/40 hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] font-bold text-sky-400 bg-sky-500/20 px-1.5 py-0.5 rounded">
                        {formatTime(bm.time)}
                      </span>
                      <span className="text-xs text-slate-200 truncate group-hover:text-white">{bm.label}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBookmark(bm.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove bookmark"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDelete && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-6 h-6" />
                <h4 className="font-bold text-base text-white">Delete Lesson?</h4>
              </div>
              <p className="text-xs text-slate-300">
                Are you sure you want to permanently delete <strong className="text-white">{lesson.title}</strong>? This
                removes the file and HLS stream caches from the server.
              </p>
              {deleteError && <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg">{deleteError}</div>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Sheet Modal Overlay */}
        {showShortcutsModal && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/15 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  <span>Keyboard Shortcuts</span>
                </div>
                <button onClick={() => setShowShortcutsModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-300 font-medium">
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Play / Pause</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">Space / K</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Fullscreen</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">F</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Theater Mode</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">T</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Mute / Unmute</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">M</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Rewind 10s</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">J / ←</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Forward 10s</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">L / →</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Volume Up/Down</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">↑ / ↓</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Toggle Loop</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">R</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Jump to 0%-90%</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">0 - 9</kbd>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span>Picture in Picture</span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">P</kbd>
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400 pt-1">
                Tip: Swipe left/right on mobile to seek or flip photos. Swipe right/left edge up/down for volume & brightness.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
