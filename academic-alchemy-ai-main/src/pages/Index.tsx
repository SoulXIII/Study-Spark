import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Flame, BookOpen, Zap, Clock, FolderOpen, ChevronRight, Layers, Trash2 } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import QuestPanel from "@/components/QuestPanel";
import { useGreeting } from "@/hooks/use-greeting";
import { useAuth } from "@/context/AuthContext";

interface StudySet {
  id: string;
  title: string;
  subject: string | null;
  updated_at: string;
}

interface Folder {
  id: string;
  name: string;
  set_count: number;
}

const API_URL = import.meta.env.VITE_API_URL || "/api";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } } };

const Index = () => {
  const { greeting, emoji } = useGreeting();
  const { user } = useAuth();

  const [minutesCompleted, setMinutesCompleted] = useState(0);
  const [minutesTarget, setMinutesTarget] = useState(user?.dailyGoalMinutes ?? 30);
  const [streak, setStreak] = useState(0);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);

  const handleDeleteSet = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Remove this study set?")) return;
    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/study-sets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudySets(prev => prev.filter(s => s.id !== id));
    } catch { /* silent */ } finally {
      setDeletingId(null);
    }
  };

  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/progress/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMinutesCompleted(data.minutes_completed ?? 0);
      setMinutesTarget(data.minutes_target ?? user?.dailyGoalMinutes ?? 30);
      setStreak(data.streak ?? 0);
      setCompletedTotal(data.completed_total ?? 0);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchProgress();
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/study-sets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setStudySets(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch(() => {});
    fetch(`${API_URL}/folders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFolders(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => {});

    const interval = setInterval(fetchProgress, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchProgress(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const pct = minutesTarget > 0 ? Math.min(100, Math.round((minutesCompleted / minutesTarget) * 100)) : 0;
  const dashOffset = 100 - pct;

  return (
    <PageTransition>
      <motion.div className="space-y-8 py-4" variants={stagger} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {greeting} {emoji}
            </h1>
            <p className="text-muted-foreground mt-1">Ready to learn something new?</p>
          </div>
          <div className="flex items-center gap-2 glass-card px-3 py-2">
            <Flame size={20} className="text-orange-400" />
            <span className="font-bold text-foreground">{streak}</span>
          </div>
        </motion.div>

        {/* Daily progress */}
        <motion.div variants={fadeUp} className="glass-card p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="100" strokeDashoffset={dashOffset} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Daily Goal</p>
            <p className="text-xs text-muted-foreground">{minutesCompleted} / {minutesTarget} minutes today</p>
          </div>
        </motion.div>

        {/* Create CTA */}
        <motion.div variants={fadeUp}>
          <Link to="/create">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="w-full h-14 rounded-2xl gradient-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              Create Study Set
            </motion.button>
          </Link>
        </motion.div>

        {/* Continue Studying */}
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Continue Studying</h2>
            <Link to="/create" className="text-xs text-primary font-medium">+ New</Link>
          </div>

          {studySets.length === 0 ? (
            <Link to="/create">
              <div className="glass-card p-6 flex flex-col items-center justify-center gap-2 border-dashed border-white/10 rounded-2xl min-h-[100px] hover:border-primary/30 transition-colors">
                <Plus size={22} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Create your first study set</p>
              </div>
            </Link>
          ) : (
            <div className="space-y-2">
              {studySets.map((set) => (
                <Link key={set.id} to={`/study-set/${set.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="group glass-card p-4 flex items-center gap-3 hover:border-primary/20 transition-colors rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                      <Layers size={18} className="text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{set.title}</p>
                      <p className="text-xs text-muted-foreground">{set.subject ?? "General"}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSet(e, set.id)}
                      disabled={deletingId === set.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Daily Quests / Pokemon */}
        <motion.div variants={fadeUp} className="glass-card p-4 rounded-2xl">
          <QuestPanel />
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="space-y-3">
          <h2 className="text-lg font-semibold">Your Stats</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sets Completed", value: String(completedTotal), icon: BookOpen, color: "text-emerald-400" },
              { label: "Study Streak", value: `${streak} day${streak !== 1 ? "s" : ""}`, icon: Zap, color: "text-orange-400" },
              { label: "Time Today", value: `${minutesCompleted} min`, icon: Clock, color: "text-primary" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card p-3 text-center space-y-1">
                <Icon size={18} className={`mx-auto ${color}`} />
                <p className="font-bold text-sm">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Folders */}
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Your Folders</h2>
            <Link to="/folders" className="text-xs text-primary font-medium">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {folders.length === 0 ? (
              <Link to="/folders" className="col-span-2">
                <div className="glass-card p-5 flex flex-col items-center justify-center border-dashed border-white/10 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer gap-2">
                  <FolderOpen size={24} />
                  <span className="text-xs">Create your first folder</span>
                </div>
              </Link>
            ) : (
              <>
                {folders.map(folder => (
                  <Link key={folder.id} to={`/folders/${folder.id}`}>
                    <div className="glass-card p-4 rounded-xl hover:border-primary/20 transition-colors cursor-pointer">
                      <FolderOpen size={20} className="text-primary mb-2" />
                      <p className="font-semibold text-sm truncate">{folder.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{folder.set_count} set{folder.set_count !== 1 ? "s" : ""}</p>
                    </div>
                  </Link>
                ))}
                <Link to="/folders">
                  <div className="glass-card p-4 flex flex-col items-center justify-center border-dashed border-white/10 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer gap-1 min-h-[80px]">
                    <FolderOpen size={20} />
                    <span className="text-xs">New Folder</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
};

export default Index;
