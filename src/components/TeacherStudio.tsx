import React, { useState, useRef } from 'react';
import {
  Upload,
  Video,
  FileText,
  AlertCircle,
  Folder,
  Loader2,
  Trash2,
  Play,
  HardDrive,
  CheckCircle2,
  ShieldAlert,
  Image as ImageIcon,
  Zap,
  Check
} from 'lucide-react';
import { OAuthConfig, LessonRecord, AppUser } from '../types.ts';

interface TeacherStudioProps {
  config: OAuthConfig | null;
  currentUser: AppUser | null;
  lessons: LessonRecord[];
  onLessonUploaded: () => void;
  onSelectLesson: (lesson: LessonRecord) => void;
  onDeleteLesson: (id: string) => void;
  onNavigateToSettings: () => void;
}

export const TeacherStudio: React.FC<TeacherStudioProps> = ({
  config,
  currentUser,
  lessons,
  onLessonUploaded,
  onSelectLesson,
  onDeleteLesson,
  onNavigateToSettings,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Mathematics');
  const [subjects, setSubjects] = useState<string[]>([
    'Mathematics',
    'Science',
    'English',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Other',
  ]);
  const [gradeLevel, setGradeLevel] = useState('Grade 10');
  const [description, setDescription] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConnected = Boolean(config?.connected);
  const isAuthorized = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  React.useEffect(() => {
    fetch('/api/subjects')
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects && d.subjects.length > 0) {
          setSubjects(d.subjects);
        }
      })
      .catch(() => {});
  }, []);

  // Permission Check
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4 ios-glass rounded-2xl border border-black/10 dark:border-white/10 p-6 mt-6">
        <div className="w-12 h-12 bg-black/5 dark:bg-white/10 text-neutral-700 dark:text-neutral-300 rounded-xl flex items-center justify-center mx-auto border border-black/10 dark:border-white/10">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-black dark:text-white">Teacher Permission Required</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Your current account role is <span className="font-bold text-neutral-800 dark:text-neutral-200">{currentUser?.role || 'Student'}</span>. Only authorized teachers and administrators can upload lesson videos, photos, and PDF notes.
        </p>
        <p className="text-[11px] text-neutral-400">
          Please contact the administrator to receive Teacher upload permissions.
        </p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    // 10 GB limit check (10 * 1024 * 1024 * 1024 bytes)
    const MAX_SIZE = 10 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg(`File exceeds the 10 GB limit. Selected file size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB.`);
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const isSelectedPhoto = selectedFile?.type.startsWith('image/');
  const isSelectedPdf =
    selectedFile?.type === 'application/pdf' ||
    selectedFile?.name.toLowerCase().endsWith('.pdf') ||
    selectedFile?.type.startsWith('text/') ||
    selectedFile?.name.toLowerCase().endsWith('.txt');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a lesson video, photo, or PDF note to upload.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a lesson title.');
      return;
    }

    if (!isConnected) {
      setErrorMsg('Google Drive is not connected. The administrator must connect Google Drive first.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('gradeLevel', gradeLevel);
    formData.append('description', description.trim());

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 7 : p));
      }, 400);

      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: {
          'x-user-email': currentUser?.email || '',
        },
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload lesson material.');
      }

      setSuccessMsg(
        `${isSelectedPdf ? 'PDF Note' : isSelectedPhoto ? 'Lesson photo' : 'Lesson video'} uploaded successfully to Google Drive: PrivateTeacherVideos/${category}/`
      );
      setSelectedFile(null);
      setFilePreview(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      onLessonUploaded();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload lesson.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    onDeleteLesson(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 pt-2">
      {/* Studio Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto px-2">
        <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
          Teacher Upload Studio
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Publish video lectures, whiteboard photos, or PDF study notes directly into your 2 TB Google Drive.
        </p>

        {/* 10 GB CAPACITY PROMINENT BANNER (LIGHT BLUE PRIMARY IOS GLASS) */}
        <div className="p-4 rounded-2xl ios-glass border border-sky-400/20 shadow-xs flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-blue-600 text-white rounded-xl shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                10 GB MAXIMUM UPLOAD CAPACITY
              </div>
              <div className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                High-definition multi-gigabyte video lectures, photos, and PDF documents supported
              </div>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider border border-sky-400/20">
            Up to 10 GB
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="p-4 rounded-xl ios-glass border border-sky-400/20 flex items-center justify-between gap-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold">Google Drive not connected:</span> Connect your 2 TB Drive account in Admin Settings before uploading.
            </div>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="px-3.5 py-1.5 rounded-xl btn-primary-blue text-xs font-bold shrink-0 cursor-pointer shadow-sm"
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Upload Form */}
      <form
        onSubmit={handleSubmit}
        className="ios-glass-elevated rounded-2xl border border-sky-400/20 shadow-sm p-5 sm:p-7 space-y-5"
      >
        {errorMsg && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-900 dark:text-sky-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-900 dark:text-sky-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dropzone File Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Select Lesson File (Videos up to 10 GB, Whiteboard Photos, or PDF Notes)
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              selectedFile
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-sky-400/30 hover:border-sky-500 bg-white/40 dark:bg-sky-950/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,application/pdf,.pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-3">
                {filePreview ? (
                  <div className="w-32 h-20 mx-auto rounded-xl overflow-hidden border border-sky-400/30 bg-black flex items-center justify-center">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center mx-auto border border-sky-400/25">
                    {isSelectedPdf ? (
                      <FileText className="w-6 h-6" />
                    ) : (
                      <Video className="w-6 h-6" />
                    )}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-black dark:text-white truncate max-w-sm mx-auto">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {selectedFile.size > 1024 * 1024 * 1024
                      ? `${(selectedFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                      : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
                    {' · '}
                    {isSelectedPdf ? 'PDF Note' : isSelectedPhoto ? 'Photo' : 'Video Recording'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="text-xs text-neutral-500 hover:text-black dark:hover:text-white underline font-medium"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-11 h-11 bg-black/5 dark:bg-white/10 text-black dark:text-white rounded-xl flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-black dark:text-white">
                  Click to select or drag &amp; drop lesson file
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  MP4, WebM, MKV, QuickTime (up to 10 GB), PNG, JPEG, or PDF documents
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Title, Category & Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Lesson Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calculus: Derivatives Lecture Part 1"
              required
              className="w-full text-xs px-3.5 py-2.5 rounded-xl ios-input text-black dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Subject Category (Auto-sorted in Drive)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl ios-input text-black dark:text-white focus:outline-none cursor-pointer"
            >
              {subjects.map((sub) => (
                <option key={sub} value={sub} className="bg-white dark:bg-black text-black dark:text-white">
                  {sub} (Drive: /{sub})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Grade / Class Level
            </label>
            <input
              type="text"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="e.g. Grade 10, Advanced Placement"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl ios-input text-black dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Lesson Description / Study Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional overview of the lecture or homework instructions..."
              className="w-full text-xs px-3.5 py-2 rounded-xl ios-input text-black dark:text-white focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-black dark:text-white" />
                Streaming to Google Drive ({category})...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-black dark:bg-white transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={uploading || !selectedFile || !isConnected}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs btn-primary-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading (Up to 10 GB)...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Upload to Google Drive</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Published Lessons Table */}
      <div className="ios-glass-elevated rounded-2xl border border-black/8 dark:border-white/10 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-black dark:text-white">
            Your Published Lessons in Google Drive
          </h2>
          <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/10">
            {lessons.length} lessons
          </span>
        </div>

        {lessons.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-xs">
            No lessons published yet. Use the upload box above to publish your first video, photo, or PDF notes.
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    onClick={() => onSelectLesson(lesson)}
                    className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                  >
                    {lesson.type === 'pdf' ? (
                      <FileText className="w-4 h-4" />
                    ) : lesson.type === 'photo' ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      onClick={() => onSelectLesson(lesson)}
                      className="text-xs font-bold text-black dark:text-white truncate hover:opacity-80 cursor-pointer"
                    >
                      {lesson.title}
                    </div>
                    <div className="text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{lesson.category}</span>
                      <span>·</span>
                      <span className="capitalize">{lesson.type === 'pdf' ? 'PDF Note' : lesson.type}</span>
                      <span>·</span>
                      <span>
                        {lesson.size > 1024 * 1024 * 1024
                          ? `${(lesson.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : `${(lesson.size / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    </div>

                    {lesson.processingStatus === 'processing' && (
                      <div className="mt-1.5 space-y-1 max-w-xs">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            {lesson.processingStage || 'Optimizing stream...'}
                          </span>
                          <span className="font-mono text-slate-500 font-bold">{lesson.processingProgress ?? 15}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${lesson.processingProgress ?? 15}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectLesson(lesson)}
                    className="px-2.5 py-1 text-xs font-semibold btn-secondary-glass rounded-lg cursor-pointer"
                  >
                    View
                  </button>

                  {/* Working Delete Button with Inline Confirmation */}
                  {confirmDeleteId === lesson.id ? (
                    <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-0.5 rounded-lg">
                      <button
                        onClick={() => handleDelete(lesson.id)}
                        disabled={deletingId === lesson.id}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {deletingId === lesson.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(lesson.id)}
                      disabled={deletingId === lesson.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete permanently from Google Drive"
                      aria-label="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
