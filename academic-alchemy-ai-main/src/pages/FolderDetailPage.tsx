import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Layers, ChevronRight, FolderOpen, X, Check, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageTransition from "@/components/PageTransition";
import { marked } from "marked";
import { MathJax } from "better-react-mathjax";

marked.use({ breaks: true });

const API_URL = import.meta.env.VITE_API_URL || "/api";
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

interface StudySet {
  id: string;
  title: string;
  subject: string | null;
  card_count?: number;
  updated_at?: string;
}

interface SavedSolution {
  id: string;
  title: string | null;
  problem_text: string | null;
  solution_text: string;
  subject: string | null;
  created_at: string;
}

interface FolderDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  study_sets: StudySet[];
}

const SolutionCard = ({ sol, onDelete }: { sol: SavedSolution; onDelete: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const html = expanded ? marked(sol.solution_text) as string : "";

  return (
    <motion.div variants={fadeUp} layout className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{sol.title || "Solved Problem"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sol.subject ?? "General"} · {new Date(sol.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X size={13} />
          </button>
          {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
              {sol.problem_text && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Problem</p>
                  <p className="text-sm">{sol.problem_text}</p>
                </div>
              )}
              <MathJax dynamic>
                <div
                  className="solution-body prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[50vh]"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </MathJax>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FolderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [solutions, setSolutions] = useState<SavedSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [allSets, setAllSets] = useState<StudySet[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  const fetchFolder = async () => {
    try {
      const [folderRes, solRes] = await Promise.all([
        fetch(`${API_URL}/folders/${id}`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API_URL}/folders/${id}/solutions`, { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (!folderRes.ok) throw new Error("Folder not found");
      const [folderData, solData] = await Promise.all([folderRes.json(), solRes.json()]);
      setFolder(folderData);
      setSolutions(Array.isArray(solData) ? solData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolder(); }, [id]);

  const openAddModal = async () => {
    const res = await fetch(`${API_URL}/study-sets`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = res.ok ? await res.json() : [];
    const inFolder = new Set(folder?.study_sets.map(s => s.id) || []);
    setAllSets((Array.isArray(data) ? data : []).filter((s: StudySet) => !inFolder.has(s.id)));
    setSelected(new Set());
    setShowAdd(true);
  };

  const toggleSelect = (setId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(setId) ? next.delete(setId) : next.add(setId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    for (const studySetId of selected) {
      await fetch(`${API_URL}/folders/${id}/study-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ studySetId }),
      });
    }
    setAdding(false);
    setShowAdd(false);
    fetchFolder();
  };

  const handleRemoveSet = async (e: React.MouseEvent, setId: string) => {
    e.preventDefault(); e.stopPropagation();
    setRemovingId(setId);
    await fetch(`${API_URL}/folders/${id}/study-sets/${setId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    setFolder(prev => prev ? { ...prev, study_sets: prev.study_sets.filter(s => s.id !== setId) } : prev);
    setRemovingId(null);
  };

  const handleDeleteSolution = async (solId: string) => {
    await fetch(`${API_URL}/solve/saved/${solId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    setSolutions(prev => prev.filter(s => s.id !== solId));
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (error || !folder) {
    return (
      <PageTransition>
        <div className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">{error || "Folder not found."}</p>
          <Button onClick={() => navigate("/folders")} variant="outline">Back to Folders</Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div className="py-4 space-y-6 max-w-lg mx-auto pb-24" variants={stagger} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <button onClick={() => navigate("/folders")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{folder.name}</h1>
            {folder.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{folder.description}</p>
            )}
          </div>
          <button
            onClick={openAddModal}
            className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0"
          >
            <Plus size={16} className="text-primary-foreground" />
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div variants={fadeUp} className="glass-card px-4 py-3 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderOpen size={14} className="text-primary" />
            {folder.study_sets.length} study set{folder.study_sets.length !== 1 ? "s" : ""}
          </span>
          {solutions.length > 0 && (
            <>
              <span className="text-white/10">·</span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lightbulb size={14} className="text-amber-400" />
                {solutions.length} solved problem{solutions.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </motion.div>

        {/* Study sets section */}
        <motion.div variants={fadeUp} className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Study Sets</p>
          {folder.study_sets.length === 0 ? (
            <div className="glass-card p-6 text-center border-dashed border-white/10 space-y-3">
              <Layers size={28} className="mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No study sets yet.</p>
              <Button onClick={openAddModal} className="gradient-primary text-primary-foreground border-0">
                <Plus size={15} className="mr-1.5" /> Add Study Sets
              </Button>
            </div>
          ) : (
            <motion.div variants={stagger} className="space-y-2">
              <AnimatePresence>
                {folder.study_sets.map(set => (
                  <motion.div key={set.id} variants={fadeUp} layout exit={{ opacity: 0, x: -20 }}>
                    <Link to={`/study-set/${set.id}`}>
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        className="group glass-card p-4 flex items-center gap-3 hover:border-primary/20 transition-colors rounded-xl"
                      >
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                          <Layers size={17} className="text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{set.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {set.subject ?? "General"}{set.card_count != null ? ` · ${set.card_count} cards` : ""}
                          </p>
                        </div>
                        <button
                          onClick={e => handleRemoveSet(e, set.id)}
                          disabled={removingId === set.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                      </motion.div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>

        {/* Solved problems section */}
        {solutions.length > 0 && (
          <motion.div variants={fadeUp} className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Solved Problems</p>
            <motion.div variants={stagger} className="space-y-2">
              <AnimatePresence>
                {solutions.map(sol => (
                  <SolutionCard
                    key={sol.id}
                    sol={sol}
                    onDelete={() => handleDeleteSolution(sol.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* Add Study Sets Modal */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) setShowAdd(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Study Sets</DialogTitle>
            <DialogDescription>Select study sets to add to "{folder.name}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {allSets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                All your study sets are already in this folder.
              </p>
            ) : (
              allSets.map(set => (
                <button
                  key={set.id}
                  onClick={() => toggleSelect(set.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    selected.has(set.id)
                      ? "bg-primary/20 border border-primary/40"
                      : "glass-card hover:border-white/20"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selected.has(set.id) ? "bg-primary border-primary" : "border-white/20"
                  }`}>
                    {selected.has(set.id) && <Check size={12} className="text-primary-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{set.title}</p>
                    <p className="text-xs text-muted-foreground">{set.subject ?? "General"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {allSets.length > 0 && (
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              {adding ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""} Study Set${selected.size !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default FolderDetailPage;
