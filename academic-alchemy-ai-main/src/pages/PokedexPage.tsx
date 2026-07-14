import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageTransition from "@/components/PageTransition";
import {
  getRarity, GEN_RANGES, RARITY_COLORS, RARITY_LABEL, RARITY_BG,
  getStaticSprite, getAnimatedSprite, loadPokemonNames, type Rarity,
} from "@/lib/pokemonData";

const API_URL = import.meta.env.VITE_API_URL || "/api";

type FilterTab = "all" | "owned" | "notOwned" | 1 | 2 | 3 | 4 | 5;

interface OwnedEntry { pokemon_id: number; rarity: Rarity; }

const RARITY_FILTER_TABS: { id: Rarity | "all"; label: string }[] = [
  { id: "all",       label: "All"        },
  { id: "legendary", label: "Legendary"  },
  { id: "very_rare", label: "Very Rare"  },
  { id: "rare",      label: "Rare"       },
  { id: "uncommon",  label: "Uncommon"   },
  { id: "common",    label: "Common"     },
];

export default function PokedexPage() {
  const navigate = useNavigate();
  const [names, setNames] = useState<Record<number, string>>({});
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [companionId, setCompanionId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [settingCompanion, setSettingCompanion] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const token = () => localStorage.getItem("token");

  useEffect(() => {
    loadPokemonNames().then(setNames);

    // Load collection
    fetch(`${API_URL}/pokemon/collection`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: OwnedEntry[]) => setOwned(new Set(data.map(d => d.pokemon_id))))
      .catch(() => {});

    // Load companion
    fetch(`${API_URL}/pokemon/stats`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.companion_pokemon_id) setCompanionId(data.companion_pokemon_id); })
      .catch(() => {});
  }, []);

  const setCompanion = async (id: number) => {
    if (!owned.has(id)) return;
    setSettingCompanion(id);
    try {
      const res = await fetch(`${API_URL}/pokemon/companion/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        setCompanionId(id);
        window.dispatchEvent(new CustomEvent("companion-changed", { detail: { id } }));
      }
    } catch { /* silent */ } finally {
      setSettingCompanion(null);
    }
  };

  // All 649 IDs filtered by current tab + search
  const filteredIds = useMemo(() => {
    const all: number[] = [];
    for (let i = 1; i <= 649; i++) all.push(i);

    return all.filter(id => {
      // Gen filter
      if (typeof filterTab === "number") {
        const [lo, hi] = GEN_RANGES[filterTab];
        if (id < lo || id > hi) return false;
      }
      // Owned filter
      if (filterTab === "owned" && !owned.has(id)) return false;
      if (filterTab === "notOwned" && owned.has(id)) return false;
      // Rarity filter
      if (rarityFilter !== "all" && getRarity(id) !== rarityFilter) return false;
      // Search
      if (search) {
        const name = (names[id] || "").toLowerCase();
        const idStr = String(id).padStart(3, "0");
        if (!name.includes(search.toLowerCase()) && !idStr.includes(search)) return false;
      }
      return true;
    });
  }, [filterTab, rarityFilter, search, names, owned]);

  const ownedCount = owned.size;

  return (
    <PageTransition>
      <div className="py-4 space-y-4 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pokédex</h1>
            <p className="text-xs text-muted-foreground">{ownedCount} / 649 caught</p>
          </div>
          {/* Pity / total indicator */}
          <div className="text-right">
            <p className="text-xs text-yellow-400 font-medium">{ownedCount > 0 ? `${Math.round((ownedCount / 649) * 100)}% complete` : "Start studying!"}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${(ownedCount / 649) * 100}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or #number…"
            className="pl-8 bg-white/5 border-white/10 h-9 text-sm"
          />
        </div>

        {/* Filter tabs — ownership */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(["all", "owned", "notOwned", 1, 2, 3, 4, 5] as FilterTab[]).map(tab => (
            <button
              key={String(tab)}
              onClick={() => setFilterTab(tab)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterTab === tab ? "gradient-primary text-primary-foreground" : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "all" ? "All" : tab === "owned" ? `Owned (${ownedCount})` : tab === "notOwned" ? "Missing" : `Gen ${tab}`}
            </button>
          ))}
        </div>

        {/* Filter tabs — rarity */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {RARITY_FILTER_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setRarityFilter(id as Rarity | "all")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                rarityFilter === id ? "gradient-primary text-primary-foreground" : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {filteredIds.map(id => {
            const isOwned = owned.has(id);
            const isCompanion = companionId === id;
            const rarity = getRarity(id);
            const name = names[id] || `#${id}`;
            const isHovered = hovered === id;

            return (
              <motion.div
                key={id}
                whileTap={{ scale: 0.9 }}
                onHoverStart={() => setHovered(id)}
                onHoverEnd={() => setHovered(null)}
                onClick={() => isOwned && setCompanion(id)}
                className={`relative rounded-xl border p-1 flex flex-col items-center gap-1 transition-all cursor-pointer
                  ${isOwned
                    ? `${RARITY_BG[rarity]} hover:scale-105`
                    : "bg-white/3 border-white/5 opacity-30 grayscale cursor-default"
                  }
                  ${isCompanion ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-background" : ""}
                `}
                title={isOwned ? `${name} — ${RARITY_LABEL[rarity]}${isOwned ? "\nClick to set as companion" : ""}` : `${name} — Not caught yet`}
              >
                {/* Companion crown */}
                {isCompanion && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">👑</span>
                )}

                {/* Sprite */}
                <img
                  src={isOwned && isHovered ? getAnimatedSprite(id) : getStaticSprite(id)}
                  alt={name}
                  loading="lazy"
                  className="w-10 h-10 object-contain pixelated"
                />

                {/* ID */}
                <p className={`text-[9px] font-medium text-center leading-tight truncate w-full text-center
                  ${isOwned ? RARITY_COLORS[rarity] : "text-muted-foreground"}`}>
                  {String(id).padStart(3, "0")}
                </p>

                {/* Name on hover */}
                {isHovered && isOwned && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-10 bg-background/90 border border-white/15 text-[9px] px-2 py-0.5 rounded-lg whitespace-nowrap shadow-lg"
                  >
                    {name}
                  </motion.div>
                )}

                {/* Setting indicator */}
                {settingCompanion === id && (
                  <div className="absolute inset-0 rounded-xl bg-primary/30 flex items-center justify-center">
                    <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {filteredIds.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No Pokémon match your filters.
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/40 pb-4">
          Complete daily quests to catch more Pokémon. Click any owned Pokémon to set it as your study companion.
        </p>
      </div>
    </PageTransition>
  );
}
