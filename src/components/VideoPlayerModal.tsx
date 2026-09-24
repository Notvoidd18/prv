import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Download
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
}

export type QualityOption = 'Auto' | '1080p' | '720p' | '480p' | '360p';
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  lesson,
  currentUser,
  onClose,
  onDeleteLesson,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('Auto');
  const [selectedSpeed, setSelectedSpeed] = useState<PlaybackSpeed>(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qualitySwitchNotice, setQualitySwitchNotice] = useState<string | null>(null);

  // Resolution detection
  const [nativeResolution, setNativeResolution] = useState<{
    width: number;
    height: number;
    label: string;
  } | null>(null);
  const [availableQualities, setAvailableQualities] = useState<QualityOption[]>([
    'Auto',
    '1080p',
    '720p',
    '480p',
    '360p',
  ]);

  // Periodic watermark position shift
  const [watermarkPos, setWatermarkPos] = useState({ top: '18%', left: '15%' });

  // Multi-photo and AI study notes state
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [copiedAi, setCopiedAi] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const pendingSeekTime = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const top = `${12 + Math.floor(Math.random() * 65)}%`;
      const left = `${12 + Math.floor(Math.random() * 55)}%`;
      setWatermarkPos({ top, left });
    }, 12000);
    return () => clearInterval(timer);
  }, []);

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
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleMouseMove = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isFullscreen && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowSettings(false);
      }, 2500);
    }
  }, [isFullscreen, isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekDelta(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekDelta(5);
      }

      // Anti-Download interceptor
      if (
        (e.ctrlKey || e.metaKey) &&
        ['s', 'u', 'p', 'c'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isPlaying, onClose]);

  if (!lesson) return null;

  const hasApiKey = Boolean(
    currentUser?.geminiApiKey ||
    (currentUser?.email ? localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) : '') ||
    localStorage.getItem('10prv_global_gemini_key')
  );

  const isHomework = (lesson as any).studentEmail !== undefined || (lesson as any).isHomework;
  const isPhoto = lesson.type === 'photo';
  const isPdf = lesson.type === 'pdf';
  const isDoc = lesson.type === 'doc';
  const isVideo = !isPhoto && !isPdf && !isDoc;

  const photoFiles = (lesson as HomeworkRecord)?.fileNames || [];
  const hasMultiplePhotos = photoFiles.length > 1;

  // Stream URL based on item type
  const streamUrl = isHomework
    ? `/api/homework/${lesson.id}/stream?auth=${encodeURIComponent(
        currentUser?.email || ''
      )}&fileIndex=${currentPhotoIndex}`
    : `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(
        currentUser?.email || ''
      )}&quality=${selectedQuality.toLowerCase()}`;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const seekDelta = (delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeedChange = (speed: PlaybackSpeed) => {
    setSelectedSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setLoadError(null);
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;

    let resLabel = `${width}×${height}`;
    if (height >= 1080) {
      resLabel = `${width}×${height} (1080p Full HD)`;
      setAvailableQualities(['Auto', '1080p', '720p', '480p', '360p']);
    } else if (height >= 720) {
      resLabel = `${width}×${height} (720p HD)`;
      setAvailableQualities(['Auto', '720p', '480p', '360p']);
    } else if (height >= 480) {
      resLabel = `${width}×${height} (480p SD)`;
      setAvailableQualities(['Auto', '480p', '360p']);
    } else if (height > 0) {
      resLabel = `${width}×${height} (360p)`;
      setAvailableQualities(['Auto', '360p']);
    }

    setNativeResolution({ width, height, label: resLabel });

    if (pendingSeekTime.current !== null) {
      videoRef.current.currentTime = pendingSeekTime.current;
      pendingSeekTime.current = null;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleQualityChange = (quality: QualityOption) => {
    if (quality === selectedQuality) {
      setShowSettings(false);
      return;
    }

    const prevTime = videoRef.current ? videoRef.current.currentTime : 0;
    pendingSeekTime.current = prevTime;
    setSelectedQuality(quality);
    setShowSettings(false);

    setQualitySwitchNotice(`Switching to ${quality === 'Auto' ? 'Auto (Source)' : quality}...`);
    setTimeout(() => {
      setQualitySwitchNotice(null);
    }, 2200);

    if (videoRef.current) {
      const wasPaused = videoRef.current.paused;
      videoRef.current.src = `/api/videos/${lesson.id}/stream?auth=${encodeURIComponent(
        currentUser?.email || ''
      )}&quality=${quality.toLowerCase()}`;
      videoRef.current.load();
      videoRef.current.currentTime = prevTime;
      if (!wasPaused) {
        videoRef.current.play().catch(() => {});
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
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen request failed:', err);
      }
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } catch {}
    setIsFullscreen(false);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Delete permission check
  const uploaderEmail = (lesson as any).uploaderEmail || (lesson as any).studentEmail;
  const canDelete =
    Boolean(currentUser?.role === 'admin') ||
    Boolean(uploaderEmail && uploaderEmail.toLowerCase() === currentUser?.email?.toLowerCase()) ||
    Boolean(currentUser?.role === 'teacher');

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      if (onDeleteLesson) {
        await onDeleteLesson(lesson.id);
      } else {
        const endpoint = isHomework ? `/api/homework/${lesson.id}` : `/api/videos/${lesson.id}`;
        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'x-user-email': currentUser?.email || '',
          },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete item.');
        }
      }
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting item.');
      setTimeout(() => setDeleteError(null), 4000);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const creatorName =
    (lesson as any).uploader || (lesson as any).studentName || 'Student';

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        return false;
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto select-none"
    >
      {/* Glassmorphic Modal Window */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`relative w-full transition-all duration-200 overflow-hidden flex flex-col ${
          isFullscreen
            ? 'h-screen max-w-none rounded-none bg-black'
            : 'max-w-5xl ios-glass-elevated rounded-3xl shadow-2xl border border-black/10 dark:border-white/15 max-h-[95vh]'
        }`}
      >
        {/* Top Header Bar */}
        {(!isFullscreen || controlsVisible) && (
          <div
            className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between z-20 transition-opacity duration-200 ${
              isFullscreen
                ? 'absolute top-0 inset-x-0 bg-linear-to-b from-black/90 to-transparent border-transparent'
                : 'bg-white/80 dark:bg-black/80 backdrop-blur-md border-black/5 dark:border-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10 shrink-0">
                {lesson.category}
              </span>

              <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white truncate">
                {isPdf ? (
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                ) : isDoc ? (
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                ) : isPhoto ? (
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <VideoIcon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{lesson.title}</span>
              </div>

              {nativeResolution && isVideo && (
                <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-400">
                  {nativeResolution.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[10px] text-neutral-700 dark:text-neutral-300 font-semibold">
                <Lock className="w-3 h-3" />
                <span>Protected</span>
              </div>

              {/* Working Delete Button */}
              {canDelete && (
                <div>
                  {confirmDelete ? (
                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/10 p-1 rounded-xl border border-black/10 dark:border-white/10">
                      <span className="text-[10px] text-neutral-700 dark:text-neutral-300 font-semibold px-1">
                        Delete?
                      </span>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-2 py-0.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        disabled={isDeleting}
                        className="px-2 py-0.5 rounded-lg btn-secondary-glass text-[10px] font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {deleteError && (
                        <span className="text-[10px] text-rose-500 font-semibold">{deleteError}</span>
                      )}
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Download Button */}
              <a
                href={`${streamUrl}&download=1`}
                download={lesson.fileName || 'download'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                title="Download file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Media Viewing Canvas */}
        <div
          className={`relative bg-neutral-950 flex items-center justify-center overflow-hidden group ${
            isFullscreen
              ? 'flex-1 h-full w-full'
              : isPdf || isDoc || isPhoto
              ? 'w-full h-[75vh] min-h-[520px]'
              : 'aspect-video w-full'
          }`}
        >
          {/* PDF & Word Docs Preview */}
          {isPdf || isDoc ? (
            <div className="w-full h-full bg-slate-900 flex flex-col relative">
              <object
                data={streamUrl}
                type={isPdf ? 'application/pdf' : 'text/plain'}
                className="w-full h-full flex-1 bg-white"
              >
                <iframe
                  src={streamUrl}
                  title={lesson.title}
                  className="w-full h-full border-0 flex-1 bg-white"
                />
              </object>

              {/* Document bar for opening full view and actions */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold border border-white/20 shadow-lg flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Full Document</span>
                </a>
              </div>
            </div>
          ) : isPhoto ? (
            /* Photo Viewer with Multi-page navigation & touch swipe support */
            <div
              className="relative w-full h-full flex items-center justify-center p-3 select-none touch-pan-y"
              onTouchStart={(e) => {
                if (!hasMultiplePhotos) return;
                setTouchEndX(null);
                setTouchStartX(e.targetTouches[0].clientX);
              }}
              onTouchMove={(e) => {
                if (!hasMultiplePhotos) return;
                setTouchEndX(e.targetTouches[0].clientX);
              }}
              onTouchEnd={() => {
                if (!hasMultiplePhotos || touchStartX === null || touchEndX === null) return;
                const distance = touchStartX - touchEndX;
                const minSwipeDistance = 50;
                if (distance > minSwipeDistance) {
                  // Swipe left -> next
                  setCurrentPhotoIndex((prev) => Math.min(photoFiles.length - 1, prev + 1));
                } else if (distance < -minSwipeDistance) {
                  // Swipe right -> prev
                  setCurrentPhotoIndex((prev) => Math.max(0, prev - 1));
                }
                setTouchStartX(null);
                setTouchEndX(null);
              }}
            >
              <img
                key={streamUrl}
                src={streamUrl}
                alt={lesson.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="max-w-full max-h-full object-contain pointer-events-none select-none"
              />

              {hasMultiplePhotos && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md text-white text-xs z-30 border border-white/15 shadow-xl">
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentPhotoIndex === 0}
                    className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Previous Page"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="font-mono text-xs font-bold tracking-tight">
                    Page {currentPhotoIndex + 1} of {photoFiles.length} (Swipe to navigate)
                  </span>

                  <button
                    onClick={() =>
                      setCurrentPhotoIndex((prev) => Math.min(photoFiles.length - 1, prev + 1))
                    }
                    disabled={currentPhotoIndex === photoFiles.length - 1}
                    className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Next Page"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Video Player */
            <>
              <video
                ref={videoRef}
                src={streamUrl}
                preload="metadata"
                autoPlay
                playsInline
                controlsList="nodownload nofullscreen"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onError={() => {
                  setIsBuffering(false);
                  setLoadError('Video failed to stream. Please verify your connection.');
                }}
                onClick={togglePlay}
                onDoubleClick={toggleFullscreen}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full object-contain cursor-pointer"
              >
                Your browser does not support HTML5 video playback.
              </video>

              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                </div>
              )}

              {qualitySwitchNotice && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-xl bg-black/80 text-white text-xs font-semibold shadow-lg border border-white/20 z-30 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  <span>{qualitySwitchNotice}</span>
                </div>
              )}

              {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-center p-6 space-y-3 z-30">
                  <AlertCircle className="w-8 h-8 text-neutral-400" />
                  <div className="text-sm font-bold text-white">{loadError}</div>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold cursor-pointer flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Stream</span>
                  </button>
                </div>
              )}

              {/* Controls Bar */}
              <div
                className={`absolute inset-x-0 bottom-0 bg-linear-to-t from-black/95 via-black/60 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-200 z-30 ${
                  controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/20 rounded appearance-none cursor-pointer accent-white hover:h-2 transition-all"
                />

                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white" />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleMute}
                        className="p-1 rounded-md hover:bg-white/10 cursor-pointer"
                        aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVolume(val);
                          setIsMuted(val === 0);
                          if (videoRef.current) {
                            videoRef.current.volume = val;
                            videoRef.current.muted = val === 0;
                          }
                        }}
                        className="w-14 h-1 bg-white/20 rounded accent-white cursor-pointer"
                      />
                    </div>

                    <div className="text-[11px] font-mono text-neutral-300">
                      <span>{formatTime(currentTime)}</span>
                      <span className="text-neutral-500 mx-1">/</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative">
                    <div className="relative">
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>{selectedQuality}</span>
                        <span className="text-neutral-400">·</span>
                        <span>{selectedSpeed}x</span>
                      </button>

                      {showSettings && (
                        <div className="absolute right-0 bottom-full mb-2 w-56 bg-neutral-900/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-3 space-y-3 text-xs z-50">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 flex items-center justify-between">
                              <span>Streaming Quality</span>
                              {nativeResolution && (
                                <span className="text-[9px] text-sky-400 normal-case font-mono font-bold">
                                  {nativeResolution.height}p Native
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {availableQualities.map((q) => (
                                <button
                                  key={q}
                                  onClick={() => handleQualityChange(q)}
                                  className={`w-full px-2.5 py-1.5 rounded-lg text-left font-medium text-[11px] flex items-center justify-between cursor-pointer transition-colors ${
                                    selectedQuality === q
                                      ? 'bg-white text-black font-bold'
                                      : 'text-neutral-300 hover:bg-white/10'
                                  }`}
                                >
                                  <span>{q}</span>
                                  {selectedQuality === q && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/10">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                              Speed
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {([0.5, 0.75, 1, 1.25, 1.5, 2] as PlaybackSpeed[]).map((spd) => (
                                <button
                                  key={spd}
                                  onClick={() => {
                                    handleSpeedChange(spd);
                                    setShowSettings(false);
                                  }}
                                  className={`py-1 rounded-md text-center font-medium text-[11px] cursor-pointer transition-colors ${
                                    selectedSpeed === spd
                                      ? 'bg-white text-black font-bold'
                                      : 'text-neutral-300 hover:bg-white/10'
                                  }`}
                                >
                                  {spd}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-4 h-4 text-white" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Details Card */}
        {!isFullscreen && (
          <div className="p-4 sm:p-6 bg-white/90 dark:bg-black/80 backdrop-blur-xl border-t border-black/5 dark:border-white/10 space-y-4 overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-black dark:text-white tracking-tight">
                  {lesson.title}
                </h2>
                {lesson.description && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                    {lesson.description}
                  </p>
                )}
              </div>

              {canDelete && (
                <div className="shrink-0 self-start">
                  {!confirmDelete && (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 rounded-xl btn-secondary-glass text-xs font-semibold hover:border-black/20 dark:hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 flex items-center gap-2.5">
                <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">
                    {isHomework ? 'Student' : 'Teacher / Publisher'}
                  </div>
                  <div className="font-bold text-black dark:text-white truncate">
                    {creatorName}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Date</div>
                  <div className="font-bold text-black dark:text-white">
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 flex items-center gap-2.5">
                <HardDrive className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Size</div>
                  <div className="font-bold text-black dark:text-white font-mono">
                    {lesson.size > 1024 * 1024 * 1024
                      ? `${(lesson.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                      : `${(lesson.size / (1024 * 1024)).toFixed(1)} MB`}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Extracted Notes and Study Solutions (Only if API key is configured) */}
            {hasApiKey && Boolean((lesson as HomeworkRecord)?.aiExtractedText) && (
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gemini AI Extracted Study Notes &amp; Solutions</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText((lesson as HomeworkRecord).aiExtractedText || '');
                      setCopiedAi(true);
                      setTimeout(() => setCopiedAi(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg btn-secondary-glass text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedAi ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                    <span>{copiedAi ? 'Copied' : 'Copy Notes'}</span>
                  </button>
                </div>
                <div className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-black/5 dark:border-white/5 font-sans">
                  {(lesson as HomeworkRecord).aiExtractedText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
