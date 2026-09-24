import React, { useState } from 'react';
import {
  Search,
  Play,
  Film,
  Calendar,
  BookOpen,
  Image as ImageIcon,
  FileText,
  Upload,
  Layers,
  Trash2,
  Sparkles,
  Bot,
  ExternalLink,
  Key,
  Loader2,
  X,
  Copy,
  Check,
  Send,
  HelpCircle,
} from 'lucide-react';
import { LessonRecord, AppUser } from '../types.ts';

interface StudentLibraryProps {
  lessons: LessonRecord[];
  currentUser: AppUser | null;
  onSelectLesson: (lesson: LessonRecord) => void;
  onNavigateToUpload: () => void;
  onDeleteLesson?: (id: string) => void;
  onOpenSettings?: () => void;
}

export const StudentLibrary: React.FC<StudentLibraryProps> = ({
  lessons,
  currentUser,
  onSelectLesson,
  onNavigateToUpload,
  onDeleteLesson,
  onOpenSettings,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<'All' | 'video' | 'photo' | 'pdf' | 'doc' | 'homework'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [homeworkList, setHomeworkList] = useState<any[]>([]);

  // Check if Gemini API key is configured (only show AI features if API key is present)
  const hasApiKey = Boolean(
    currentUser?.geminiApiKey ||
    (currentUser?.email ? localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) : '') ||
    localStorage.getItem('10prv_global_gemini_key')
  );

  const [aiModalLesson, setAiModalLesson] = useState<LessonRecord | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [subjectsList, setSubjectsList] = useState<string[]>([
    'Mathematics',
    'Science',
    'English',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Other',
  ]);

  React.useEffect(() => {
    fetch('/api/subjects')
      .then((res) => res.json())
      .then((data) => {
        if (data.subjects && data.subjects.length > 0) {
          setSubjectsList(data.subjects);
        }
      })
      .catch(() => {});

    fetch('/api/homework')
      .then((res) => res.json())
      .then((data) => {
        if (data.homework) {
          setHomeworkList(data.homework);
        }
      })
      .catch(() => {});
  }, []);

  const categories = ['All', ...subjectsList];
  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'naveen.an.18.an@gmail.com';
  const canUpload = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || isSuperAdmin;

  // Filter lessons based on category, format type, and instant search query
  const filteredLessons = lessons.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesType =
      selectedType === 'All' || item.type === selectedType;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.uploader.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onDeleteLesson) return;
    setDeletingId(id);
    onDeleteLesson(id);
    setConfirmDeleteId(null);
  };

  // Open Gemini modal for a lesson
  const handleOpenAiModal = (e: React.MouseEvent, lesson: LessonRecord) => {
    e.stopPropagation();
    setAiModalLesson(lesson);
    setAiPrompt('');
    setAiAnswer(null);
    setAiError(null);
    setCopiedAnswer(false);
    const savedKey =
      currentUser?.geminiApiKey ||
      (currentUser?.email ? localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) : '') ||
      '';
    setCustomApiKey(savedKey);
    setShowKeyInput(!savedKey);
  };

  // Ask Gemini about the lesson
  const handleAskGemini = async (promptToUse?: string) => {
    const q = (promptToUse || aiPrompt).trim();
    if (!q || !aiModalLesson) return;

    const keyToUse =
      customApiKey.trim() ||
      currentUser?.geminiApiKey ||
      (currentUser?.email ? localStorage.getItem(`10prv_gemini_key_${currentUser.email}`) : '') ||
      '';

    if (!keyToUse) {
      setShowKeyInput(true);
      setAiError('Please enter your Gemini API Key to study with AI.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/ask-lesson', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || '',
          'x-gemini-api-key': keyToUse,
        },
        body: JSON.stringify({
          lessonId: aiModalLesson.id,
          prompt: q,
          customApiKey: keyToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to generate study notes');
      }

      setAiAnswer(data.answer);
      if (currentUser?.email && keyToUse) {
        localStorage.setItem(`10prv_gemini_key_${currentUser.email}`, keyToUse);
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to connect with Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyAnswer = () => {
    if (!aiAnswer) return;
    navigator.clipboard.writeText(aiAnswer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 pt-2">
      {/* Editorial Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto px-2">
        <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
          Classroom Learning Library
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Stream lectures, view whiteboard photos, and browse PDF notes protected by 10PrvDriver.
        </p>

        {/* CLEAN, FAST SEARCH BAR */}
        <div className="pt-2 max-w-xl mx-auto w-full">
          <div className="relative flex items-center gap-2 p-1.5 rounded-2xl ios-glass border border-sky-400/25 dark:border-sky-400/25 shadow-[0_4px_20px_rgba(14,165,233,0.08)]">
            <Search className="w-4 h-4 text-sky-600 dark:text-sky-400 ml-3 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lectures, topics, teachers, or notes..."
              className="w-full text-xs sm:text-sm bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none py-1.5"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer mr-2"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS: Categories & Media Types */}
      <div className="space-y-3 px-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          <div className="flex items-center gap-1 text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider mr-1 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span>Subject:</span>
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'btn-primary-blue shadow-xs font-bold'
                  : 'ios-glass text-slate-700 dark:text-slate-300 hover:bg-sky-500/10 border border-sky-400/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Media Type Filter */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-sky-400/10">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider mr-1 shrink-0">
              Format:
            </span>
            {(['All', 'video', 'photo', 'pdf', 'doc', 'homework'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedType === t
                    ? 'bg-sky-500 text-white font-bold'
                    : 'bg-sky-500/5 hover:bg-sky-500/15 text-slate-600 dark:text-slate-400 border border-sky-400/10'
                }`}
              >
                {t === 'All' ? 'All Formats' : t === 'homework' ? 'Homework' : t.toUpperCase()}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium shrink-0">
            {filteredLessons.length} {filteredLessons.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* LESSONS GRID */}
      {filteredLessons.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl ios-glass border border-sky-400/15 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-400/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No lesson materials found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No matching materials for "${searchQuery}". Try a different keyword or filter.`
              : 'No lessons have been published yet.'}
          </p>
          {canUpload && (
            <button
              onClick={onNavigateToUpload}
              className="mt-2 px-4 py-2 rounded-xl btn-primary-blue text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Go to Teacher Studio</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredLessons.map((item) => {
            const isOwner =
              Boolean(item.uploaderEmail && item.uploaderEmail.toLowerCase() === currentUser?.email?.toLowerCase());
            const canDelete = currentUser?.role === 'admin' || isSuperAdmin || currentUser?.role === 'teacher' || isOwner;

            return (
              <div
                key={item.id}
                onClick={() => onSelectLesson(item)}
                className="group relative rounded-2xl ios-glass border border-sky-400/15 dark:border-sky-400/15 hover:border-sky-400/50 dark:hover:border-sky-400/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.15)] transition-all duration-200 overflow-hidden cursor-pointer flex flex-col shadow-xs"
              >
                {/* Media Thumbnail */}
                <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                  {item.type === 'photo' ? (
                    <img
                      src={`/api/videos/${item.id}/thumbnail`}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : item.type === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center space-y-2 p-6 text-center text-white">
                      <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-400/30">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold tracking-tight">PDF Document</span>
                    </div>
                  ) : item.type === 'doc' ? (
                    <div className="flex flex-col items-center justify-center space-y-2 p-6 text-center text-white">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-400/30">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold tracking-tight">Study Document</span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full bg-slate-900 group-hover:bg-slate-800 transition-colors flex items-center justify-center">
                      <img
                        src={item.posterUrl || `/api/videos/${item.id}/poster`}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          // Hide broken poster and show play button fallback
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="relative z-10 w-12 h-12 rounded-2xl bg-sky-500/80 backdrop-blur-md border border-sky-400/40 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 ml-0.5 fill-current" />
                      </div>
                      {item.processingStatus === 'processing' && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-amber-300 font-medium flex items-center gap-1 z-20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Processing...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top Badges: Format Badge & Optional Gemini AI Button */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-bold uppercase tracking-wider border border-white/10">
                      {item.type ? item.type.toUpperCase() : 'VIDEO'}
                    </span>

                    {hasApiKey && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenAiModal(e, item)}
                        className="pointer-events-auto p-1.5 rounded-xl bg-slate-950/80 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-400/30 shadow-md backdrop-blur-md transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer group/gemini"
                        title="Study and ask questions with Gemini"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover/gemini:text-white transition-colors" />
                        <span className="font-sans font-semibold">Gemini</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Working Delete Button */}
                  {canDelete && onDeleteLesson && (
                    confirmDeleteId === item.id ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-slate-950/90 border border-rose-500/50 p-1 rounded-xl shadow-lg backdrop-blur-md z-10"
                      >
                        <button
                          onClick={(e) => handleDelete(e, item.id)}
                          disabled={deletingId === item.id}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-0.5 rounded text-white/80 hover:text-white text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(item.id);
                        }}
                        className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white/70 hover:text-white backdrop-blur-md border border-white/10 opacity-80 hover:opacity-100 transition-all cursor-pointer z-10"
                        title="Delete lesson"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>

                {/* Lesson Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-sky-700 dark:text-sky-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">{item.category}</span>
                      <span>•</span>
                      <span>{item.gradeLevel || 'Standard'}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-sky-400/10 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate max-w-[120px]">By {item.uploader}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span>{formatSize(item.size)}</span>
                      {hasApiKey && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenAiModal(e, item)}
                          className="p-1 rounded-md text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 cursor-pointer"
                          title="Ask Gemini AI"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STUDENT HOMEWORK SECTION ON MAIN PAGE */}
      {(selectedType === 'All' || selectedType === 'homework') && homeworkList.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-sky-400/20 mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                <span>Student Homework &amp; Notes Submissions</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Explore homework solutions and study notes submitted by students.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-400/20">
              {homeworkList.length} Submissions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {homeworkList.map((hw) => (
              <div
                key={hw.id}
                onClick={() => onSelectLesson({
                  ...hw,
                  isHomework: true,
                  uploader: hw.studentName,
                  uploaderEmail: hw.studentEmail,
                  type: 'photo'
                } as any)}
                className="group relative rounded-2xl ios-glass border border-sky-400/15 hover:border-sky-400/50 hover:shadow-[0_8px_30px_rgba(14,165,233,0.15)] transition-all duration-200 overflow-hidden cursor-pointer flex flex-col shadow-xs p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Homework
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(hw.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                    {hw.title}
                  </h4>
                  {hw.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {hw.description}
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-sky-400/10 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate">Student: {hw.studentName}</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold group-hover:underline flex items-center gap-1">
                    <span>Open</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GEMINI STUDY HELPER MODAL (ITEM-LEVEL AI STUDY & SEARCH) */}
      {aiModalLesson && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl rounded-3xl ios-glass-elevated border border-sky-400/30 p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Study with Gemini AI
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-mono font-bold uppercase">
                      {aiModalLesson.type || 'Lesson'}
                    </span>
                  </div>
                  <p className="text-xs text-sky-700 dark:text-sky-400 font-medium truncate max-w-[280px] sm:max-w-md">
                    {aiModalLesson.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAiModalLesson(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                Quick Study Questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Summarize key ideas',
                  'Explain the core concept simply',
                  'Give 3 practice questions with answers',
                  'Extract formulas & definitions',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setAiPrompt(chip);
                      handleAskGemini(chip);
                    }}
                    disabled={aiLoading}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold border border-sky-400/20 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Gemini API Key Entry / Toggle */}
            <div className="p-2.5 rounded-xl bg-sky-500/5 border border-sky-400/15 text-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  <Key className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Gemini API Key</span>
                  {customApiKey && !showKeyInput && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      (Configured)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                >
                  {showKeyInput ? 'Hide Key' : 'Change Key'}
                </button>
              </div>

              {showKeyInput && (
                <div className="pt-1 space-y-1">
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key (AIzaSy...)"
                    className="w-full text-xs font-mono px-3 py-1.5 rounded-lg ios-input text-slate-900 dark:text-white focus:outline-none"
                  />
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Get a free Gemini API key from Google AI Studio</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}
            </div>

            {/* User Question Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !aiLoading) {
                    handleAskGemini();
                  }
                }}
                placeholder="Ask any question about this lesson..."
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl ios-input text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => handleAskGemini()}
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-4 py-2.5 rounded-xl btn-primary-blue text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Display */}
            {aiError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                {aiError}
              </div>
            )}

            {/* AI Answer Display */}
            {aiAnswer && (
              <div className="space-y-2 pt-2 border-t border-sky-400/15">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                    Gemini Study Notes:
                  </span>
                  <button
                    onClick={handleCopyAnswer}
                    className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 cursor-pointer"
                  >
                    {copiedAnswer ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Notes</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-sky-400/20 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {aiAnswer}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
