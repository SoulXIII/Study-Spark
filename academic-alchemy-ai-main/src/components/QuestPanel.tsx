import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GachaReveal from "./GachaReveal";
import { loadPokemonNames, type Rarity } from "@/lib/pokemonData";
import { useAuth } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "/api";

interface Quest {
  type: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  completed: boolean;
  rollClaimed: boolean;
}

interface RollResult {
  pokemonId: number;
  rarity: Rarity;
  isDuplicate: boolean;
  pityCount: number;
  xpGained?: number;
}

export default function QuestPanel() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [pityCount, setPityCount] = useState(0);
  const [totalRolls, setTotalRolls] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [pendingRoll, setPendingRoll] = useState<RollResult | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [names, setNames] = useState<Record<number, string>>({});
  const [claiming, setClaiming] = useState<string | null>(null);
  const [testRolling, setTestRolling] = useState(false);
  const [legendaryUsed, setLegendaryUsed] = useState(true); // default true so button hidden until loaded
  const [legendaryRolling, setLegendaryRolling] = useState(false);

  const token = () => localStorage.getItem("token");

  const fetchQuests = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pokemon/quests`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuests(data.quests);
      setPityCount(data.pityCount);
      setTotalRolls(data.totalRolls);
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pokemon/stats`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCollectionCount(data.collectionCount);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchQuests();
    fetchStats();
    loadPokemonNames().then(setNames);
    if (user?.isAdmin) {
      fetch(`${API_URL}/pokemon/admin/legendary-status`, {
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.ok ? r.json() : null).then(d => { if (d) setLegendaryUsed(d.used); }).catch(() => {});
    }
  }, []);

  // Poll for quest progress every 20s + refresh immediately when tab regains focus
  useEffect(() => {
    const id = setInterval(fetchQuests, 20000);
    const onVisible = () => { if (!document.hidden) fetchQuests(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchQuests]);

  const claimQuest = useCallback(async (questType: string) => {
    if (claiming) return;
    setClaiming(questType);
    try {
      const res = await fetch(`${API_URL}/pokemon/quests/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ questType }),
      });
      if (!res.ok) return;
      window.dispatchEvent(new CustomEvent("pokemon-react", { detail: { type: "xp" } }));
      const data = await res.json();
      if (data.roll) {
        const roll = data.roll as RollResult;
        setPendingRoll(roll);
        setPendingName(names[roll.pokemonId] || `#${roll.pokemonId}`);
        fetchStats();
      }
      fetchQuests();
    } catch { /* silent */ } finally {
      setClaiming(null);
    }
  }, [claiming, names, fetchStats, fetchQuests]);

  const claimAll = useCallback(async () => {
    const claimable = quests.filter(q => q.completed && !q.rollClaimed);
    for (const q of claimable) {
      // Claim one at a time; after first roll show the modal
      const res = await fetch(`${API_URL}/pokemon/quests/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ questType: q.type }),
      }).catch(() => null);
      if (!res?.ok) continue;
      const data = await res.json();
      if (data.roll && !pendingRoll) {
        const roll = data.roll as RollResult;
        setPendingRoll(roll);
        setPendingName(names[roll.pokemonId] || `#${roll.pokemonId}`);
        fetchStats();
        break; // show one reveal at a time
      }
    }
    fetchQuests();
  }, [quests, pendingRoll, names, fetchStats, fetchQuests]);

  const testRoll = useCallback(async () => {
    if (testRolling) return;
    setTestRolling(true);
    try {
      const res = await fetch(`${API_URL}/pokemon/admin/roll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.roll) {
        setPendingRoll(data.roll as RollResult);
        setPendingName(names[data.roll.pokemonId] || `#${data.roll.pokemonId}`);
        fetchStats();
      }
    } catch { /* silent */ } finally {
      setTestRolling(false);
    }
  }, [testRolling, names, fetchStats]);

  const legendaryRoll = useCallback(async () => {
    if (legendaryRolling || legendaryUsed) return;
    setLegendaryRolling(true);
    try {
      const res = await fetch(`${API_URL}/pokemon/admin/legendary`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.roll) {
        setPendingRoll(data.roll as RollResult);
        setPendingName(names[data.roll.pokemonId] || `#${data.roll.pokemonId}`);
        setLegendaryUsed(true);
        fetchStats();
      }
    } catch { /* silent */ } finally {
      setLegendaryRolling(false);
    }
  }, [legendaryRolling, legendaryUsed, names, fetchStats]);

  const claimableCount = quests.filter(q => q.completed && !q.rollClaimed).length;
  const pityLeft = 30 - pityCount;

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎮</span>
            <h2 className="text-base font-semibold">Daily Quests</h2>
          </div>
          <div className="flex items-center gap-2">
            {claimableCount > 1 && (
              <button
                onClick={claimAll}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/30 transition-colors"
              >
                Claim All ({claimableCount})
              </button>
            )}
            {user?.isAdmin && (
              <button
                onClick={testRoll}
                disabled={testRolling}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                title="Admin: test gacha roll"
              >
                {testRolling ? "..." : "🎲 Test"}
              </button>
            )}
            {user?.isAdmin && !legendaryUsed && (
              <button
                onClick={legendaryRoll}
                disabled={legendaryRolling}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 hover:bg-yellow-400/30 transition-colors disabled:opacity-50"
                title="One-time guaranteed Legendary"
                style={{ boxShadow: "0 0 6px rgba(250,204,21,0.4)" }}
              >
                {legendaryRolling ? "..." : "⭐ Legendary"}
              </button>
            )}
            <Link to="/pokedex" className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors">
              <span>Pokédex</span>
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">{collectionCount}/649</span>
            </Link>
          </div>
        </div>

        {/* Quest list */}
        <div className="space-y-2">
          {quests.map(q => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            const isClaimable = q.completed && !q.rollClaimed;
            const isClaiming = claiming === q.type;

            return (
              <motion.div
                key={q.type}
                className={`glass-card p-3 rounded-xl flex items-center gap-3 ${q.completed && q.rollClaimed ? "opacity-60" : ""}`}
              >
                <span className="text-xl flex-shrink-0">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-medium truncate ${q.completed && q.rollClaimed ? "line-through text-muted-foreground" : ""}`}>
                      {q.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                      {q.completed && q.rollClaimed ? "✓ Done" : `${Math.min(q.progress, q.target)}/${q.target}`}
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${q.completed ? "bg-emerald-400" : "bg-primary"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>

                {/* Claim button */}
                {isClaimable && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => claimQuest(q.type)}
                    disabled={!!claiming}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 hover:bg-yellow-400/30 transition-colors disabled:opacity-50"
                    style={{ boxShadow: "0 0 8px rgba(250,204,21,0.3)" }}
                  >
                    {isClaiming ? "..." : "🎁 Claim"}
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Pity counter */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-muted-foreground/60">
            Legendary pity: <span className="text-yellow-400 font-medium">{pityLeft} rolls away</span>
          </p>
          <p className="text-[11px] text-muted-foreground/60">{totalRolls} total rolls</p>
        </div>
      </div>

      {/* Gacha modal */}
      <GachaReveal
        result={pendingRoll}
        pokemonName={pendingName}
        onClose={() => { setPendingRoll(null); fetchQuests(); }}
      />
    </>
  );
}
