import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";
import MathText from "@/components/MathText";
import { reportQuestProgress } from "@/lib/questProgress";

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
}

const QuizMode = () => {
  const navigate = useNavigate();
  const { id: setId } = useParams();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Time logging is now handled globally by Layout — no per-page duplicate needed.

  const logComplete = () => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/progress/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studySetId: setId, sessionType: "quiz" }),
    }).catch(() => {});
  };


  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/study-sets/${setId}/quiz`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load quiz questions");
        setQuestions(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [setId]);

  const dispatchPokemon = (type: string) =>
    window.dispatchEvent(new CustomEvent("pokemon-react", { detail: { type } }));

  const handleSelect = (optIdx: number) => {
    if (revealed) return;
    setSelected(optIdx);
    setRevealed(true);
    const correct = optIdx === questions[index].correct_option_index;
    setResults([...results, correct]);
    dispatchPokemon(correct ? "correct" : "wrong");
  };

  const handleNext = () => {
    if (index + 1 >= questions.length) {
      logComplete();
      reportQuestProgress("complete_quiz", 1);
      dispatchPokemon("celebrate");
      setDone(true);
    } else {
      setSelected(null);
      setRevealed(false);
      setIndex(index + 1);
    }
  };

  const retry = () => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setResults([]);
    setDone(false);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="py-20 text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent mx-auto" />
          </motion.div>
          <p className="text-muted-foreground text-sm">Loading quiz…</p>
        </div>
      </PageTransition>
    );
  }

  if (error || questions.length === 0) {
    return (
      <PageTransition>
        <div className="py-12 max-w-md mx-auto text-center space-y-6">
          <div className="text-6xl">❓</div>
          <h2 className="text-2xl font-bold">No Quiz Questions</h2>
          <p className="text-muted-foreground">{error || "No quiz questions found for this study set."}</p>
          <Button onClick={() => navigate(-1)} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground border-0">
            Go Back
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (done) {
    const correct = results.filter(Boolean).length;
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <PageTransition>
        <div className="py-12 max-w-md mx-auto text-center space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📖"}</div>
          </motion.div>
          <h2 className="text-2xl font-bold">Quiz Complete!</h2>
          <p className="text-5xl font-bold text-primary">{pct}%</p>
          <p className="text-muted-foreground">{correct} / {questions.length} correct</p>
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

  const q = questions[index];

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
              Question {index + 1} of {questions.length}
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${((index + 1) / questions.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-primary">
              {results.filter(Boolean).length}/{index} ✓
            </span>
            <div className="flex items-center gap-1 text-xs font-mono text-primary glass-card px-2 py-1 rounded-lg">
              <Clock size={11} />
              {formatTime(elapsed)}
            </div>
          </div>
        </div>

        {/* Question + Options */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-4"
          >
            <div className="glass-card p-6">
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-3">
                Question {index + 1}
              </p>
              <MathText className="text-base font-semibold leading-relaxed">{q.question}</MathText>
            </div>

            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                const isCorrect = i === q.correct_option_index;

                let cardClass = "glass-card";
                let labelClass = "bg-muted text-muted-foreground";

                if (revealed) {
                  if (isCorrect) {
                    cardClass = "glass-card border-emerald-500/50 bg-emerald-500/10";
                    labelClass = "bg-emerald-500 text-white";
                  } else if (isSelected) {
                    cardClass = "glass-card border-red-500/50 bg-red-500/10";
                    labelClass = "bg-red-500 text-white";
                  }
                } else if (isSelected) {
                  cardClass = "glass-card border-primary/50 bg-primary/10";
                  labelClass = "bg-primary text-white";
                }

                return (
                  <motion.button
                    key={i}
                    whileTap={!revealed ? { scale: 0.98 } : {}}
                    onClick={() => handleSelect(i)}
                    className={`w-full p-4 rounded-xl text-left flex items-center gap-3 transition-all ${cardClass} ${!revealed ? "hover:border-primary/30" : ""}`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${labelClass}`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <MathText className="text-sm flex-1">{opt}</MathText>
                    {revealed && isCorrect && (
                      <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                    )}
                    {revealed && isSelected && !isCorrect && (
                      <XCircle size={18} className="text-red-400 flex-shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation + Next button */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {q.explanation && (
                    <div className="glass-card p-4 border-primary/20">
                      <p className="text-xs text-primary font-semibold mb-1">Explanation</p>
                      <MathText className="text-sm text-muted-foreground leading-relaxed">{q.explanation}</MathText>
                    </div>
                  )}
                  <Button
                    onClick={handleNext}
                    className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold border-0"
                  >
                    {index + 1 >= questions.length ? "See Results" : "Next Question →"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

export default QuizMode;
