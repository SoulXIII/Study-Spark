import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Plus, Trash2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageTransition from "@/components/PageTransition";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const FOLDER_COLORS = [
  "from-violet-500/20 to-purple-500/20 border-violet-500/30",
  "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
  "from-orange-500/20 to-amber-500/20 border-orange-500/30",
  "from-pink-500/20 to-rose-500/20 border-pink-500/30",
  "from-indigo-500/20 to-blue-500/20 border-indigo-500/30",
];

interface Folder {
  id: string;
  name: string;
  description: string | null;
  set_count: number;
  created_at: string;
}

const FoldersPage = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");

  useEffect(() => {
    fetch(`${API_URL}/folders`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFolders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError("Folder name is required."); return; }
    setCreating(true); setCreateError("");
    try {
      const res = await fetch(`${API_URL}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create folder."); return; }
      setFolders(prev => [data, ...prev]);
      setShowCreate(false); setNewName(""); setNewDesc("");
    } catch { setCreateError("Could not connect. Try again."); }
    finally { setCreating(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this folder? Study sets inside won't be deleted.")) return;
    setDeletingId(id);
    try {
      await fetch(`${API_URL}/folders/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token()}` },
      });
      setFolders(prev => prev.filter(f => f.id !== id));
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  };

  return (
    <PageTransition>
      <motion.div className="py-4 space-y-6" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Folders</h1>
          <button
            onClick={() => { setShowCreate(true); setNewName(""); setNewDesc(""); setCreateError(""); }}
            className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center"
          >
            <Plus size={18} className="text-primary-foreground" />
          </button>
        </motion.div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <motion.div variants={stagger} className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {folders.map((folder, i) => (
                <motion.div key={folder.id} variants={fadeUp} layout exit={{ opacity: 0, scale: 0.9 }}>
                  <Link to={`/folders/${folder.id}`}>
                    <div className={`group relative glass-card p-4 rounded-2xl border bg-gradient-to-br ${FOLDER_COLORS[i % FOLDER_COLORS.length]} hover:opacity-90 transition-opacity cursor-pointer min-h-[120px] flex flex-col justify-between`}>
                      <button
                        onClick={(e) => handleDelete(e, folder.id)}
                        disabled={deletingId === folder.id}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                      <div>
                        <FolderOpen size={26} className="text-primary mb-2" />
                        <p className="font-semibold text-sm leading-tight">{folder.name}</p>
                        {folder.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{folder.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">{folder.set_count} set{folder.set_count !== 1 ? "s" : ""}</p>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* New folder card */}
            <motion.div variants={fadeUp}>
              <button
                onClick={() => { setShowCreate(true); setNewName(""); setNewDesc(""); setCreateError(""); }}
                className="w-full glass-card p-4 rounded-2xl flex flex-col items-center justify-center border-dashed border-white/10 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors min-h-[120px] gap-2"
              >
                <Plus size={24} />
                <span className="text-xs">New Folder</span>
              </button>
            </motion.div>
          </motion.div>
        )}

        {!loading && folders.length === 0 && (
          <motion.div variants={fadeUp} className="text-center py-8 space-y-2">
            <FolderOpen size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No folders yet. Create one to organize your study sets.</p>
          </motion.div>
        )}
      </motion.div>

      {/* Create Folder Modal */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) setShowCreate(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Group your study sets by topic, subject, or exam.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g., Biology Final, Semester 1, French Vocab"
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(""); }}
              className="bg-muted/30 border-white/10"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="bg-muted/30 border-white/10"
            />
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <Button onClick={handleCreate} disabled={creating} className="w-full gradient-primary text-primary-foreground border-0">
              {creating ? "Creating…" : "Create Folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default FoldersPage;
