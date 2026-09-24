import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  BookOpen,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Layers,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Edit2,
  Save,
  X,
  Camera,
  RotateCcw,
  Loader2,
  Key,
  ExternalLink,
  SwitchCamera,
} from 'lucide-react';
import { AppUser, HomeworkRecord } from '../types.ts';

interface StudentHubProps {
  currentUser: AppUser | null;
  onOpenPreview?: (hw: HomeworkRecord) => void;
  onNavigateToLibrary?: () => void;
}

export const StudentHub: React.FC<StudentHubProps> = ({
  currentUser,
  onOpenPreview,
  onNavigateToLibrary,
}) => {
  const [homeworkList, setHomeworkList] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Mathematics');
  const [gradeLevel, setGradeLevel] = useState('Class 10');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [autoExtractOnUpload, setAutoExtractOnUpload] = useState(true);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteHwId, setConfirmDeleteHwId] = useState<string | null>(null);

  // Dynamic subjects from backend
  const [subjects, setSubjects] = useState<string[]>([
    'Mathematics',
    'Science',
    'English',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Other',
  ]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Extraction State
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractErrorMap, setExtractErrorMap] = useState<Record<string, string>>({});
  const [editingAiId, setEditingAiId] = useState<string | null>(null);
  const [aiDraftText, setAiDraftText] = useState('');
  const [savingAiText, setSavingAiText] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Gemini API Key State for Students & Teachers
  const [studentApiKey, setStudentApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalHw, setKeyModalHw] = useState<HomeworkRecord | null>(null);
  const [keyInputVal, setKeyInputVal] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Live Camera State
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'naveen.an.18.an@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  const isTeacherOrAdmin = currentUser?.role === 'teacher' || isAdmin;

  useEffect(() => {
    fetchSubjects();
    fetchHomework();

    // Load saved Gemini API Key
    if (currentUser?.email) {
      const savedKey =
        currentUser.geminiApiKey ||
        localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) ||
        '';
      setStudentApiKey(savedKey);
      setKeyInputVal(savedKey);
    }
  }, [currentUser]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          if (!data.subjects.includes(category)) {
            setCategory(data.subjects[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchHomework = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (currentUser?.email) {
        headers['x-user-email'] = currentUser.email;
      }
      const res = await fetch('/api/homework', { headers });
      if (res.ok) {
        const data = await res.json();
        setHomeworkList(data.homework || []);
      }
    } catch (err) {
      console.error('Failed to load shared notes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start Live Camera
  const handleStartCamera = async () => {
    setCameraError(null);
    setShowLiveCamera(true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('getUserMedia error, falling back to native file picker:', err);
        setCameraError('Camera access unavailable. You can choose a photo from your gallery/camera roll.');
      }
    } else {
      setCameraError('In-browser camera access not supported on this browser.');
    }
  };

  // Flip Camera between front and back
  const handleFlipCamera = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);

    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Could not switch camera facing:', err);
    }
  };

  // Snap photo from Live Camera
  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const newFile = new File([blob], `notebook_photo_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        handleFilesSelected([newFile]);
        handleCloseCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  // Close Live Camera
  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setShowLiveCamera(false);
    setCameraError(null);
  };

  // File selection handling
  const handleFilesSelected = (files: FileList | File[] | null) => {
    if (!files) return;
    const newFiles = Array.from(files);

    const combined = [...selectedFiles, ...newFiles].slice(0, 10);
    setSelectedFiles(combined);
    setErrorMsg(null);

    if (!title && combined[0]) {
      const clean = combined[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(clean);
    }

    // Generate previews
    const previews: string[] = [];
    combined.forEach((file) => {
      if (file.type.startsWith('image/')) {
        previews.push(URL.createObjectURL(file));
      } else {
        previews.push('');
      }
    });
    setFilePreviews(previews);
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
  };

  // Save student API key
  const handleSaveStudentKey = async (keyToSave: string) => {
    if (!currentUser || !keyToSave.trim()) return;
    setSavingKey(true);
    const cleanKey = keyToSave.trim();
    try {
      await fetch('/api/user/gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ apiKey: cleanKey }),
      });
      localStorage.setItem(`10prv_gemini_key_${currentUser.email}`, cleanKey);
      setStudentApiKey(cleanKey);
      setShowKeyModal(false);

      // If triggered from a specific homework card, run extraction immediately!
      if (keyModalHw) {
        handleTriggerAiExtract(keyModalHw, cleanKey);
        setKeyModalHw(null);
      }
    } catch (err) {
      console.error('Error saving API key:', err);
    } finally {
      setSavingKey(false);
    }
  };

  // Submit Homework Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMsg('Please select or capture at least one homework photo or document.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a descriptive title for your homework note.');
      return;
    }
    if (!currentUser) {
      setErrorMsg('Please sign in to share notes.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('gradeLevel', gradeLevel);
    formData.append('description', description.trim());

    try {
      const res = await fetch('/api/homework/upload', {
        method: 'POST',
        headers: {
          'x-user-email': currentUser.email,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccessMsg('Homework note shared successfully!');
      setSelectedFiles([]);
      setFilePreviews([]);
      setTitle('');
      setDescription('');

      await fetchHomework();

      // If auto-extract is checked, run Gemini OCR extraction automatically!
      if (autoExtractOnUpload && data.homework) {
        handleTriggerAiExtract(data.homework);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload homework notes.');
    } finally {
      setUploading(false);
    }
  };

  // Trigger Gemini AI OCR & Note Extraction (ALL Students & Teachers)
  const handleTriggerAiExtract = async (hw: HomeworkRecord, keyOverride?: string) => {
    if (!currentUser) return;

    const keyToUse =
      keyOverride ||
      studentApiKey ||
      localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) ||
      '';

    if (!keyToUse) {
      setKeyModalHw(hw);
      setShowKeyModal(true);
      return;
    }

    setExtractingId(hw.id);
    setExtractErrorMap((prev) => {
      const copy = { ...prev };
      delete copy[hw.id];
      return copy;
    });

    try {
      const res = await fetch(`/api/homework/${hw.id}/ai-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
          'x-gemini-api-key': keyToUse,
        },
        body: JSON.stringify({ customApiKey: keyToUse }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'AI extraction failed.');
      }

      setHomeworkList((prev) =>
        prev.map((item) => (item.id === hw.id ? data.homework : item))
      );
    } catch (err: any) {
      setExtractErrorMap((prev) => ({
        ...prev,
        [hw.id]: err.message || 'AI extraction failed. Please try again.',
      }));
    } finally {
      setExtractingId(null);
    }
  };

  // Save edited AI text (Teacher or Admin)
  const handleSaveAiDraft = async (id: string) => {
    if (!currentUser) return;
    setSavingAiText(true);
    try {
      const res = await fetch(`/api/homework/${id}/ai-info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email,
        },
        body: JSON.stringify({ aiExtractedText: aiDraftText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update notes');

      setHomeworkList((prev) =>
        prev.map((item) => (item.id === id ? data.homework : item))
      );
      setEditingAiId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save edits');
    } finally {
      setSavingAiText(false);
    }
  };

  const handleCopyNotes = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Delete Homework Note (Optimistic Removal)
  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    setDeletingId(id);
    // Optimistically remove so UI responds instantly
    setHomeworkList((prev) => prev.filter((h) => h.id !== id));
    setConfirmDeleteHwId(null);

    try {
      const res = await fetch(`/api/homework/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-email': currentUser.email },
      });
      if (res.ok) {
        setSuccessMsg('Homework note removed successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete homework.');
        fetchHomework();
      }
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMsg('Network error while deleting homework.');
      fetchHomework();
    } finally {
      setDeletingId(null);
    }
  };

  // Filter homework list
  const filteredList = homeworkList.filter((item) => {
    const matchesSubject =
      selectedSubjectFilter === 'All' || item.category === selectedSubjectFilter;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aiExtractedText?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-24 pt-2">
      {/* iOS Liquid Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto px-2">
        <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
          Student Homework &amp; Notebook Hub
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Click photos of handwritten notebooks, upload multi-page assignments, and extract formulas &amp; study summaries with Gemini AI.
        </p>

        {/* Gemini API Key Bar for Students */}
        <div className="p-3 rounded-2xl ios-glass border border-sky-400/25 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Gemini OCR AI Processing</span>
                {studentApiKey ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Key Required
                  </span>
                )}
              </div>
              <div className="text-[11px] text-sky-700 dark:text-sky-400">
                {studentApiKey ? 'Personal API key active for OCR extraction' : 'Add your Gemini API key to auto-extract notebook text'}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowKeyModal(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-700 dark:text-sky-300 hover:text-white font-bold text-xs border border-sky-400/30 transition-all cursor-pointer shrink-0"
          >
            {studentApiKey ? 'Manage Key' : 'Add Gemini Key'}
          </button>
        </div>
      </div>

      {/* UPLOAD / SNAP CARD */}
      <div className="p-5 sm:p-7 rounded-3xl ios-glass border border-sky-400/20 shadow-lg space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-sky-400/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Share Homework or Notebook Photos
              </h2>
              <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                Click photos directly with camera or upload multiple pages
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-400/20">
            Up to 10 Photos / PDF
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dual Action: Live Camera Capture or File Browser */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct Camera Capture */}
            <button
              type="button"
              onClick={handleStartCamera}
              className="ios-btn p-4 rounded-xl ios-glass border border-dashed border-sky-400/30 hover:border-sky-500 flex flex-col items-center justify-center gap-1.5 cursor-pointer group text-slate-700 dark:text-slate-300 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block text-slate-900 dark:text-white">
                  Click Photo with Camera
                </span>
                <span className="text-[10px] text-sky-700 dark:text-sky-400">
                  Open viewfinder &amp; snap page directly
                </span>
              </div>
            </button>

            {/* Hidden native camera input for direct fallbacks */}
            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />

            {/* Multiple Photos / File Browser */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ios-btn p-4 rounded-xl ios-glass border border-dashed border-sky-400/30 hover:border-sky-500 flex flex-col items-center justify-center gap-1.5 cursor-pointer group text-slate-700 dark:text-slate-300 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block text-slate-900 dark:text-white">
                  Select Multiple Photos / PDF
                </span>
                <span className="text-[10px] text-sky-700 dark:text-sky-400">
                  Choose from gallery or documents
                </span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Selected Photos Carousel / Thumbnail List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Selected Pages &amp; Files ({selectedFiles.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles([]);
                    setFilePreviews([]);
                  }}
                  className="text-[11px] text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative shrink-0 w-20 h-20 rounded-xl ios-glass overflow-hidden border border-sky-400/20 group shadow-xs"
                  >
                    {filePreviews[idx] ? (
                      <img
                        src={filePreviews[idx]}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-sky-500/5">
                        <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        <span className="text-[9px] truncate max-w-full font-mono mt-1 text-slate-600 dark:text-slate-300">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[8px] font-mono bg-black/60 text-white font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Title / Topic Name *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Chapter 4 Quadratic Equations HW"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subject *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white focus:outline-none"
                >
                  {subjects.map((sub) => (
                    <option key={sub} value={sub} className="dark:bg-slate-900">
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Grade / Class
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Class 9" className="dark:bg-slate-900">Class 9</option>
                  <option value="Class 10" className="dark:bg-slate-900">Class 10</option>
                  <option value="Class 11" className="dark:bg-slate-900">Class 11</option>
                  <option value="Class 12" className="dark:bg-slate-900">Class 12</option>
                  <option value="College" className="dark:bg-slate-900">College</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Optional Note / Question Details
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any specific questions or instructions for your classmates or teacher..."
              className="w-full text-xs px-3.5 py-2 rounded-xl ios-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none"
            />
          </div>

          {/* AI Auto-Extract Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-400/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Auto-run Gemini OCR upon upload
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                  Extracts all handwritten text, formulas &amp; step-by-step solutions
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoExtractOnUpload}
                onChange={(e) => setAutoExtractOnUpload(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading || selectedFiles.length === 0}
            className="w-full py-3 rounded-2xl btn-primary-blue text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md transition-all"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading Homework Notes...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Publish Notes to Classroom ({selectedFiles.length} files)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* FILTER & SEARCH HUB */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider mr-1 shrink-0">
              Filter:
            </span>
            {['All', ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSubjectFilter(s)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSubjectFilter === s
                    ? 'btn-primary-blue shadow-xs font-bold'
                    : 'ios-glass text-slate-700 dark:text-slate-300 hover:bg-sky-500/10 border border-sky-400/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shared homework notes..."
              className="w-full text-xs px-3 py-1.5 rounded-xl ios-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* HOMEWORK NOTES GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            <p className="text-xs text-slate-500">Loading homework submissions...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl ios-glass border border-sky-400/15 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No homework notes found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No notes matching "${searchQuery}".`
                : 'Be the first to click a photo of your notebook and share it!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredList.map((hw) => {
              const isOwner =
                Boolean(hw.studentEmail && hw.studentEmail.toLowerCase() === currentUser?.email?.toLowerCase());
              const canDelete = isAdmin || isTeacherOrAdmin || isOwner;
              const photoCount = hw.fileNames?.length || 1;

              return (
                <div
                  key={hw.id}
                  className="ios-glass rounded-3xl p-5 space-y-4 hover:border-sky-400/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.12)] transition-all flex flex-col justify-between border border-sky-400/20 shadow-xs"
                >
                  <div className="space-y-3">
                    {/* Top Bar: Subject Badge & Owner info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20">
                          {hw.category}
                        </span>
                        {photoCount > 1 && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/20">
                            {photoCount} Pages
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* AI Extraction Trigger for ALL Students & Teachers */}
                        <button
                          onClick={() => handleTriggerAiExtract(hw)}
                          disabled={extractingId === hw.id}
                          className="ios-btn px-2.5 py-1 rounded-lg btn-primary-blue text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                          title="Extract handwritten text & solutions with Gemini OCR"
                        >
                          {extractingId === hw.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Extracting...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>{hw.aiExtractedText ? 'Re-Run OCR' : 'AI OCR Extract'}</span>
                            </>
                          )}
                        </button>

                        {/* Working Delete Button */}
                        {canDelete && (
                          confirmDeleteHwId === hw.id ? (
                            <div className="flex items-center gap-1 bg-rose-500/15 border border-rose-500/30 p-0.5 rounded-lg">
                              <button
                                onClick={() => handleDelete(hw.id)}
                                disabled={deletingId === hw.id}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {deletingId === hw.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteHwId(null)}
                                className="px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteHwId(hw.id)}
                              disabled={deletingId === hw.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors"
                              title="Delete note"
                              aria-label="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div
                      onClick={() => onOpenPreview?.(hw)}
                      className="cursor-pointer group/title"
                    >
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover/title:text-sky-600 dark:group-hover/title:text-sky-400 transition-colors flex items-center justify-between">
                        <span>{hw.title}</span>
                        <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 opacity-0 group-hover/title:opacity-100 transition-opacity">
                          Click to View →
                        </span>
                      </h3>
                      {hw.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {hw.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <User className="w-3 h-3 text-sky-500" />
                        <span>{hw.studentName}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(hw.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>

                    {/* AI Extraction Error Notice */}
                    {extractErrorMap[hw.id] && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1.5 flex-1">
                          <p className="leading-snug">{extractErrorMap[hw.id]}</p>
                          <button
                            type="button"
                            onClick={() => handleTriggerAiExtract(hw)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-bold text-[10px] cursor-pointer transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Retry AI OCR</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* AI OCR EXTRACTED TEXT & SUMMARY */}
                    {hw.aiExtractedText && (
                      <div className="p-3.5 rounded-2xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-400/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Gemini OCR Study Notes &amp; Solutions
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyNotes(hw.aiExtractedText || '', hw.id)}
                              className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === hw.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {isTeacherOrAdmin && (
                              <button
                                onClick={() => {
                                  setEditingAiId(hw.id);
                                  setAiDraftText(hw.aiExtractedText || '');
                                }}
                                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {editingAiId === hw.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={6}
                              value={aiDraftText}
                              onChange={(e) => setAiDraftText(e.target.value)}
                              className="w-full text-xs p-2.5 rounded-xl ios-input text-slate-900 dark:text-white focus:outline-none resize-y"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingAiId(null)}
                                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveAiDraft(hw.id)}
                                disabled={savingAiText}
                                className="px-3 py-1 rounded-lg btn-primary-blue text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                {savingAiText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-sky-400/15 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {hw.aiExtractedText}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Photos Preview Gallery */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
                      {(hw.fileNames && hw.fileNames.length > 0 ? hw.fileNames : [hw.fileName]).map(
                        (fn, i) => (
                          <a
                            key={i}
                            href={`/api/homework/${hw.id}/file/${i}?auth=${encodeURIComponent(currentUser?.email || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-sky-400/20 group hover:opacity-90 transition-opacity"
                          >
                            {hw.type === 'pdf' ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400 p-1 text-center">
                                <FileText className="w-5 h-5" />
                                <span className="text-[8px] font-bold">PDF</span>
                              </div>
                            ) : (
                              <img
                                src={`/api/homework/${hw.id}/file/${i}?auth=${encodeURIComponent(currentUser?.email || '')}`}
                                alt={`${hw.title} page ${i + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[7px] font-mono font-bold bg-black/60 text-white">
                              P.{i + 1}
                            </span>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LIVE CAMERA VIEWFINDER MODAL */}
      {showLiveCamera && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-xl bg-slate-950 rounded-3xl overflow-hidden border border-sky-400/30 flex flex-col shadow-2xl">
            {/* Viewfinder Header */}
            <div className="p-4 bg-black/60 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Camera className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold">Notebook Live Viewfinder</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Flip Camera"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span className="hidden sm:inline">Flip</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-[4/3] sm:aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Grid overlay for lining up notebooks */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/15">
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-r border-b border-white/10"></div>
                <div className="border-b border-white/10"></div>
                <div className="border-r border-white/10"></div>
                <div className="border-r border-white/10"></div>
                <div></div>
              </div>

              {/* Error fallback banner */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-xs text-white/90 max-w-sm">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseCamera();
                      nativeCameraInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl btn-primary-blue text-xs font-bold cursor-pointer"
                  >
                    Open System Photo Picker
                  </button>
                </div>
              )}
            </div>

            {/* Viewfinder Controls / Shutter Bar */}
            <div className="p-5 bg-black/80 flex items-center justify-center gap-6 border-t border-white/10">
              <button
                type="button"
                onClick={handleSnapPhoto}
                className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 flex items-center justify-center cursor-pointer transition-transform active:scale-90 shadow-xl"
                title="Click photo"
              >
                <div className="w-11 h-11 rounded-full bg-white shadow-inner"></div>
              </button>
            </div>

            {/* Hidden canvas for grabbing frames */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* GEMINI API KEY MODAL FOR STUDENTS & TEACHERS */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md rounded-3xl ios-glass-elevated border border-sky-400/30 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Gemini API Key
                  </h3>
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                    Powers OCR text extraction &amp; homework solutions
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setKeyModalHw(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Gemini AI OCR scans handwritten notebooks, mathematical formulas, and questions with precision to give you structured notes and step-by-step solutions.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Gemini API Key
              </label>
              <input
                type="password"
                value={keyInputVal}
                onChange={(e) => setKeyInputVal(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white focus:outline-none"
              />
              <div className="pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                >
                  <span>Get a free Gemini API Key from Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-sky-400/15">
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setKeyModalHw(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveStudentKey(keyInputVal)}
                disabled={savingKey || !keyInputVal.trim()}
                className="px-5 py-2 rounded-xl btn-primary-blue text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save &amp; Extract</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
