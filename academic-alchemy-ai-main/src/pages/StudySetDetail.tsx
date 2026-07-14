import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Layers, CheckSquare, Type, PenLine, MessageSquare, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import PageTransition from "@/components/PageTransition";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

interface StudySet {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  created_at: string;
}

const StudySetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [setRes, fcRes, qRes] = await Promise.all([
          fetch(`${API_URL}/study-sets/${id}`, { headers }),
          fetch(`${API_URL}/study-sets/${id}/flashcards`, { headers }),
          fetch(`${API_URL}/study-sets/${id}/quiz`, { headers }),
        ]);
        const [set, flashcards, quiz] = await Promise.all([
          setRes.json(),
          fcRes.json(),
          qRes.json(),
        ]);
        setStudySet(set);
        setFlashcardCount(Array.isArray(flashcards) ? flashcards.length : 0);
        setQuizCount(Array.isArray(quiz) ? quiz.length : 0);
      } catch {
        // silent fallback
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const studyModes = [
    { id: "flashcards", label: "Flashcards", desc: `${flashcardCount} cards`, icon: Layers, path: "flashcards" },
    { id: "quiz", label: "Quiz", desc: `${quizCount} questions`, icon: CheckSquare, path: "quiz" },
    { id: "fill", label: "Fill-in-Blank", desc: "Coming soon", icon: Type, path: "flashcards" },
    { id: "written", label: "Written Test", desc: "Coming soon", icon: PenLine, path: "flashcards" },
    { id: "tutor", label: "AI Tutor", desc: "Coming soon", icon: MessageSquare, path: "flashcards" },
  ];

  const handleSummarize = async () => {
    if (summary) { setSummaryOpen(o => !o); return; }
    setSummarizing(true);
    setSummaryError(null);
    setSummaryOpen(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/study-sets/${id}/summarize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSummary(data.summary);
    } catch (e: unknown) {
      setSummaryError(e instanceof Error ? e.message : "Failed to generate summary");
    } finally {
      setSummarizing(false);
    }
  };

  const createdAgo = studySet
    ? (() => {
        const diff = Date.now() - new Date(studySet.created_at).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return "today";
        if (days === 1) return "yesterday";
        return `${days} days ago`;
      })()
    : "";

  if (loading) {
    return (
      <PageTransition>
        <div className="py-20 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent mx-auto animate-spin" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div className="py-4 space-y-6 max-w-2xl mx-auto" variants={stagger} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{studySet?.title ?? "Study Set"}</h1>
            <p className="text-xs text-muted-foreground">
              {studySet?.subject ?? "General"} · Created {createdAgo}
            </p>
          </div>
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="100" strokeDashoffset="100" strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">0%</span>
          </div>
        </motion.div>

        {/* Card counts */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{flashcardCount}</p>
            <p className="text-xs text-muted-foreground">Flashcards</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-primary">{quizCount}</p>
            <p className="text-xs text-muted-foreground">Quiz Questions</p>
          </div>
        </motion.div>

        {/* Summarize */}
        <motion.div variants={fadeUp}>
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="w-full glass-card p-3 flex items-center justify-between gap-2 hover:border-primary/30 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span className="text-sm font-medium">
                {summarizing ? "Generating summary…" : summary ? "AI Summary" : "Summarize with AI"}
              </span>
            </div>
            {summary && !summarizing && (
              summaryOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />
            )}
            {summarizing && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
          </button>

          <AnimatePresence>
            {summaryOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="glass-card mt-2 p-4 text-sm text-muted-foreground leading-relaxed">
                  {summaryError ? (
                    <p className="text-destructive">{summaryError}</p>
                  ) : summary ? (
                    <p>{summary}</p>
                  ) : (
                    <p className="text-center py-2">Loading…</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Study modes */}
        <motion.div variants={fadeUp} className="space-y-3">
          <p className="text-sm font-medium">Study Modes</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {studyModes.map(({ id: modeId, label, desc, icon: Icon, path }) => (
              <Link key={modeId} to={`/study-set/${id}/${path}`}>
                <motion.div
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="glass-card p-4 space-y-2 cursor-pointer hover:border-primary/20 transition-colors"
                >
                  <Icon size={22} className="text-primary" />
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
};

export default StudySetDetail;
