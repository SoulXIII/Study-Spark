import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Lightbulb, BarChart2, Trash2, ShieldCheck,
  ShieldOff, Crown, Search, RefreshCw, LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API = "/api/admin";
const tok = () => localStorage.getItem("token");
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${tok()}` });

const fmt = (n: number) => n?.toLocaleString() ?? "—";

// ── tiny reusable pieces ──────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number; sub?: string }) => (
  <div className="glass-card p-4 flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
      <Icon size={18} className="text-primary-foreground" />
    </div>
    <div>
      <p className="text-2xl font-bold">{fmt(value)}</p>
      <p className="text-xs text-muted-foreground">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  </div>
);

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{children}</span>
);

const SearchBar = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50"
    />
  </div>
);

// ── types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number; proUsers: number; totalStudySets: number;
  totalFlashcards: number; totalQuestions: number; totalSolutions: number; todaySignups: number;
}
interface AdminUser {
  id: string; name: string; email: string; is_pro: boolean; is_admin: boolean;
  study_set_count: number; created_at: string;
}
interface AdminSet {
  id: string; title: string; subject: string | null; owner_name: string;
  owner_email: string; card_count: number; created_at: string;
}
interface AdminSolution {
  id: string; title: string | null; subject: string | null; owner_name: string;
  owner_email: string; folder_name: string | null; created_at: string;
}

// ── tab panels ────────────────────────────────────────────────────────────────

const OverviewTab = ({ stats }: { stats: Stats | null }) => {
  if (!stats) return <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatCard icon={Users}    label="Total Users"    value={stats.totalUsers}      sub={`+${stats.todaySignups} today`} />
      <StatCard icon={Crown}    label="Pro Users"      value={stats.proUsers} />
      <StatCard icon={BookOpen} label="Study Sets"     value={stats.totalStudySets} />
      <StatCard icon={BookOpen} label="Flashcards"     value={stats.totalFlashcards} />
      <StatCard icon={BarChart2} label="Quiz Questions" value={stats.totalQuestions} />
      <StatCard icon={Lightbulb} label="Saved Solutions" value={stats.totalSolutions} />
    </div>
  );
};

const UsersTab = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { user: me } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/users?search=${encodeURIComponent(search)}`, { headers: headers() });
    setUsers(r.ok ? await r.json() : []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, body: object) => {
    setBusy(id);
    const r = await fetch(`${API}/users/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
    if (r.ok) { const updated = await r.json(); setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u)); }
    setBusy(null);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this user and all their data? This cannot be undone.")) return;
    setBusy(id);
    const r = await fetch(`${API}/users/${id}`, { method: "DELETE", headers: headers() });
    if (r.ok) setUsers(prev => prev.filter(u => u.id !== id));
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No users found.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <motion.div key={u.id} layout className="glass-card p-3 flex items-center gap-3 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{u.study_set_count} sets</span>
                  {u.is_pro   && <Badge color="bg-amber-500/20 text-amber-400">Pro</Badge>}
                  {u.is_admin && <Badge color="bg-primary/20 text-primary">Admin</Badge>}
                  {u.id === me?.id && <Badge color="bg-emerald-500/20 text-emerald-400">You</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Toggle Pro */}
                <button
                  disabled={busy === u.id}
                  onClick={() => patch(u.id, { isPro: !u.is_pro })}
                  title={u.is_pro ? "Remove Pro" : "Grant Pro"}
                  className={`p-1.5 rounded-lg transition-colors ${u.is_pro ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "hover:bg-muted text-muted-foreground hover:text-amber-400"}`}
                >
                  {u.is_pro ? <Crown size={14} /> : <Crown size={14} className="opacity-30" />}
                </button>
                {/* Toggle Admin */}
                {u.id !== me?.id && (
                  <button
                    disabled={busy === u.id}
                    onClick={() => patch(u.id, { isAdmin: !u.is_admin })}
                    title={u.is_admin ? "Remove Admin" : "Make Admin"}
                    className={`p-1.5 rounded-lg transition-colors ${u.is_admin ? "bg-primary/20 text-primary hover:bg-primary/30" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}
                  >
                    {u.is_admin ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                  </button>
                )}
                {/* Delete */}
                {u.id !== me?.id && (
                  <button
                    disabled={busy === u.id}
                    onClick={() => del(u.id)}
                    title="Delete user"
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const StudySetsTab = () => {
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/study-sets?search=${encodeURIComponent(search)}`, { headers: headers() });
    setSets(r.ok ? await r.json() : []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm("Delete this study set and all its flashcards/quiz questions?")) return;
    setBusy(id);
    const r = await fetch(`${API}/study-sets/${id}`, { method: "DELETE", headers: headers() });
    if (r.ok) setSets(prev => prev.filter(s => s.id !== id));
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <SearchBar value={search} onChange={setSearch} placeholder="Search by title or owner email…" />
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
      ) : (
        <div className="space-y-2">
          {sets.map(s => (
            <motion.div key={s.id} layout className="glass-card p-3 flex items-center gap-3 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.subject ?? "General"} · {s.card_count} cards · {s.owner_name} ({s.owner_email})
                </p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(s.created_at).toLocaleDateString()}
              </span>
              <button
                disabled={busy === s.id}
                onClick={() => del(s.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const SolutionsTab = () => {
  const [solutions, setSolutions] = useState<AdminSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/solutions`, { headers: headers() });
      setSolutions(r.ok ? await r.json() : []);
      setLoading(false);
    })();
  }, []);

  const del = async (id: string) => {
    if (!confirm("Delete this saved solution?")) return;
    setBusy(id);
    const r = await fetch(`${API}/solutions/${id}`, { method: "DELETE", headers: headers() });
    if (r.ok) setSolutions(prev => prev.filter(s => s.id !== id));
    setBusy(null);
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
      ) : solutions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No saved solutions yet.</p>
      ) : solutions.map(s => (
        <motion.div key={s.id} layout className="glass-card p-3 flex items-center gap-3 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{s.title ?? "Solved Problem"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {s.subject ?? "General"}{s.folder_name ? ` · 📁 ${s.folder_name}` : ""} · {s.owner_name} ({s.owner_email})
            </p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {new Date(s.created_at).toLocaleDateString()}
          </span>
          <button
            disabled={busy === s.id}
            onClick={() => del(s.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

// ── main dashboard ────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",   icon: BarChart2  },
  { id: "users",     label: "Users",      icon: Users      },
  { id: "content",   label: "Study Sets", icon: BookOpen   },
  { id: "solutions", label: "Solutions",  icon: Lightbulb  },
] as const;
type Tab = typeof TABS[number]["id"];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    setRefreshing(true);
    const r = await fetch(`${API}/stats`, { headers: headers() });
    if (r.ok) setStats(await r.json());
    setRefreshing(false);
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-white/5 bg-card/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <ShieldCheck size={14} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Admin Dashboard</span>
            <span className="text-xs text-muted-foreground hidden sm:block">· {user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh stats"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              ← App
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 glass-card p-1 rounded-2xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === id
                  ? "gradient-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview"  && <OverviewTab stats={stats} />}
        {tab === "users"     && <UsersTab />}
        {tab === "content"   && <StudySetsTab />}
        {tab === "solutions" && <SolutionsTab />}
      </div>
    </div>
  );
};

export default AdminDashboard;
