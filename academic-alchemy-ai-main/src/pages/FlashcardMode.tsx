import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Clock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";
import MathText from "@/components/MathText";
import { reportQuestProgress } from "@/lib/questProgress";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "Due today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
};

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  easiness_factor: number;
  repetitions: number;
  interval_days: number;
  next_review_date: string;
}

// SM-2 quality buttons: Again=1, Hard=3, Good=4, Easy=5
const RATINGS = [
  { label: "Again", quality: 1, className: "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" },
  { label: "Hard",  quality: 3, className: "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20" },
  { label: "Good",  quality: 4, className: "bg-emerald-500/15 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25" },
  { label: "Easy",  quality: 5, className: "bg-blue-500/15 border-blue-500/20 text-blue-400 hover:bg-blue-500/25" },
];

const FlashcardMode = () => {
  const navigate = useNavigate();
  const { id: setId } = useParams();

  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  // queue: cards remaining to pass (Again cards are appended back)
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const flipCountRef = useRef(0);

  // Summary stats
  const [reviewedCount, setReviewedCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  // Per-card next_review_date after SM-2 update
  const [nextDates, setNextDates] = useState<Record<string, string>>({});

  // Live timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const logComplete = () => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/progress/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studySetId: setId, sessionType: "flashcard" }),
    }).catch(() => {});
  };

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/study-sets/${setId}/flashcards`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load flashcards");
        const cards: Flashcard[] = await res.json();
        setAllCards(cards);
        setQueue(cards);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, [setId]);

  const handleFlip = () => {
    if (flipped) return;
    setFlipped(true);
    flipCountRef.current += 1;
    reportQuestProgress("flip_10", 1);
  };

  const dispatchPokemon = (type: string) =>
    window.dispatchEvent(new CustomEvent("pokemon-react", { detail: { type } }));

  const submitReview = async (cardId: string, quality: number) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/study-sets/${setId}/flashcards/${cardId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quality }),
      });
      if (res.ok) {
        const data = await res.json();
        setNextDates(prev => ({ ...prev, [cardId]: data.next_review_date }));
      }
    } catch {
      // silently ignore — SM-2 state will sync next load
    }
  };

  const handleRate = async (quality: number) => {
    const card = queue[0];
    await submitReview(card.id, quality);

    const isPass = quality >= 3;
    setReviewedCount(prev => prev + 1);

    if (!isPass) {
      setAgainCount(prev => prev + 1);
      dispatchPokemon("wrong");
      // Re-append to back of queue for another attempt this session
      setQueue(prev => {
        const [, ...rest] = prev;
        return [...rest, card];
      });
      setFlipped(false);
    } else {
      if (queue.length === 1) {
        // Last card passed — session done
        logComplete();
        dispatchPokemon("celebrate");
        setDone(true);
      } else {
        dispatchPokemon(quality === 5 ? "celebrate" : "correct");
        setQueue(prev => prev.slice(1));
        setFlipped(false);
      }
    }
  };

  const retry = () => {
    setQueue(allCards);
    setDone(false);
    setFlipped(false);
    setReviewedCount(0);
    setAgainCount(0);
    setNextDates({});
    flipCountRef.current = 0;
    startTimeRef.current = Date.now();
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="py-20 text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent mx-auto" />
          </motion.div>
          <p className="text-muted-foreground text-sm">Loading flashcards…</p>
        </div>
      </PageTransition>
    );
  }

  if (error || allCards.length === 0) {
    return (
      <PageTransition>
        <div className="py-12 max-w-md mx-auto text-center space-y-6">
          <div className="text-6xl">📚</div>
          <h2 className="text-2xl font-bold">No Flashcards</h2>
          <p className="text-muted-foreground">{error || "No flashcards found for this study set."}</p>
          <Button onClick={() => navigate(-1)} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground border-0">
            Go Back
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (done) {
    const passedCount = reviewedCount - againCount;
    const accuracy = allCards.length > 0 ? Math.round((passedCount / allCards.length) * 100) : 0;
    // Show next review dates for a sample of cards
    const dateEntries = Object.entries(nextDates).slice(0, 3);

    return (
      <PageTransition>
        <div className="py-12 max-w-md mx-auto text-center space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <div className="text-6xl">🎉</div>
          </motion.div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4">
              <p className="text-2xl font-bold text-primary">{allCards.length}</p>
              <p className="text-xs text-muted-foreground">Reviewed</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-2xl font-bold text-emerald-400">{passedCount}</p>
              <p className="text-xs text-muted-foreground">Mastered</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
          </div>

          {againCount > 0 && (
            <div className="glass-card p-3 text-sm text-orange-400 flex items-center gap-2">
              <span>{againCount} card{againCount > 1 ? "s" : ""} scheduled for review again</span>
            </div>
          )}

          {dateEntries.length > 0 && (
            <div className="glass-card p-4 text-left space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-3">
                <CalendarDays size={11} /> Next Reviews
              </p>
              {dateEntries.map(([cardId, date]) => {
                const card = allCards.find(c => c.id === cardId);
                return (
                  <div key={cardId} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground truncate max-w-[200px]">{card?.question}</span>
                    <span className="text-primary ml-2 shrink-0">{formatDate(date)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={retry} className="flex-1 h-11 rounded-xl bg-muted/30 border-white/5">
              <RotateCcw size={16} className="mr-2" /> Retry
            </Button>
            <Button onClick={() => navigate(-1)} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground border-0">
              Done
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const card = queue[0];
  const totalCards = allCards.length;
  // Progress = unique cards passed (total - remaining unique cards)
  const uniqueRemaining = new Set(queue.map(c => c.id)).size;
  const passedUnique = totalCards - uniqueRemaining;

  return (
    <PageTransition>
      <div className="py-4 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {passedUnique} / {totalCards} mastered
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${(passedUnique / totalCards) * 100}%` }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-primary glass-card px-2 py-1 rounded-lg">
            <Clock size={11} />
            {formatTime(elapsed)}
          </div>
        </div>

        {/* Due date badge */}
        {card.next_review_date && (
          <div className="flex justify-center">
            <span className="text-xs text-muted-foreground glass-card px-3 py-1 rounded-full flex items-center gap-1">
              <CalendarDays size={11} />
              {formatDate(card.next_review_date)}
            </span>
          </div>
        )}

        {/* 3-D Flip Card */}
        <div style={{ perspective: "1200px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div
                onClick={handleFlip}
                className="cursor-pointer select-none"
                style={{ perspective: "1200px" }}
              >
                <motion.div
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                  style={{ transformStyle: "preserve-3d", position: "relative", height: "300px" }}
                >
                  {/* Front – Question */}
                  <div
                    style={{ backfaceVisibility: "hidden" }}
                    className="glass-card p-8 h-[300px] flex flex-col items-center justify-center text-center rounded-2xl absolute inset-0"
                  >
                    <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-6">Question</p>
                    <MathText className="text-lg font-semibold leading-relaxed">{card.question}</MathText>
                    <p className="text-xs text-muted-foreground mt-8">Tap to reveal answer</p>
                  </div>

                  {/* Back – Answer */}
                  <div
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    className="glass-card p-6 h-[300px] flex flex-col text-center rounded-2xl absolute inset-0 bg-emerald-500/5 border-emerald-500/20"
                  >
                    <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-4 flex-shrink-0">Answer</p>
                    <div className="overflow-y-auto flex-1 flex items-start justify-center">
                      <MathText className="text-base leading-relaxed">{card.answer}</MathText>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* SM-2 Rating Buttons — appear after flip */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="space-y-2"
            >
              <p className="text-xs text-center text-muted-foreground">How well did you recall this?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map(({ label, quality, className }) => (
                  <Button
                    key={label}
                    variant="outline"
                    onClick={() => handleRate(quality)}
                    className={`h-12 rounded-xl text-sm font-medium border ${className}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Requeue</span>
                <span>Barely</span>
                <span>Hesitated</span>
                <span>Perfect</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

export default FlashcardMode;
