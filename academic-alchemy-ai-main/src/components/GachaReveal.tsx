import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getAnimatedSprite, getStaticSprite, RARITY_LABEL, type Rarity } from "@/lib/pokemonData";

interface RollResult {
  pokemonId: number;
  rarity: Rarity;
  isDuplicate: boolean;
  pityCount: number;
  xpGained?: number;
}

interface Props {
  result: RollResult | null;
  pokemonName: string;
  onClose: () => void;
}

// Rarity → theme colours
const RARITY_THEME: Record<Rarity, { glow: string; rays: string; ring: string; label: string; shine: string }> = {
  common:    { glow: "#4ade80", rays: "#4ade80", ring: "border-green-400",  label: "text-green-400",  shine: "from-green-400/30"  },
  uncommon:  { glow: "#a3e635", rays: "#a3e635", ring: "border-lime-400",   label: "text-lime-400",   shine: "from-lime-400/30"   },
  rare:      { glow: "#60a5fa", rays: "#60a5fa", ring: "border-blue-400",   label: "text-blue-400",   shine: "from-blue-400/30"   },
  very_rare: { glow: "#c084fc", rays: "#c084fc", ring: "border-purple-400", label: "text-purple-400", shine: "from-purple-400/30" },
  legendary: { glow: "#facc15", rays: "#facc15", ring: "border-yellow-400", label: "text-yellow-400", shine: "from-yellow-400/30" },
};

type Phase = "idle" | "shaking" | "opening" | "reveal";

export default function GachaReveal({ result, pokemonName, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [imgSrc, setImgSrc] = useState("");
  const [shakeCount, setShakeCount] = useState(0);

  // Reset + preload when a new result arrives
  useEffect(() => {
    if (!result) return;
    setPhase("idle");
    setShakeCount(0);
    setImgSrc("");
    const url = getAnimatedSprite(result.pokemonId);
    const img = new Image();
    img.src = url;
    img.onload  = () => setImgSrc(url);
    img.onerror = () => setImgSrc(getStaticSprite(result.pokemonId));
  }, [result]);

  const handleBallClick = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("shaking");
    setShakeCount(0);
  }, [phase]);

  // After shaking → opening → reveal
  useEffect(() => {
    if (phase !== "shaking") return;
    const t = setTimeout(() => {
      setPhase("opening");
      setTimeout(() => setPhase("reveal"), 600);
    }, 1400);
    return () => clearTimeout(t);
  }, [phase]);

  if (!result) return null;

  const theme = RARITY_THEME[result.rarity];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Close button (only after reveal) */}
        {phase === "reveal" && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-white/60 hover:text-white transition-colors"
          >
            <X size={22} />
          </motion.button>
        )}

        {/* Main card */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-4">

          {/* ── IDLE / SHAKING / OPENING phases ── */}
          {phase !== "reveal" && (
            <div className="flex flex-col items-center gap-6">
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: phase === "idle" ? 1 : 0, y: 0 }}
                className="text-white/70 text-sm font-medium tracking-wide"
              >
                {phase === "idle" ? "Tap the Pokéball to reveal!" : ""}
              </motion.p>

              {/* The Pokéball */}
              <motion.div
                onClick={handleBallClick}
                className={phase === "idle" ? "cursor-pointer" : ""}
                animate={
                  phase === "idle"    ? { y: [0, -12, 0], rotate: [0, 0, 0] } :
                  phase === "shaking" ? { rotate: [-18, 18, -14, 14, -10, 10, -6, 6, 0], x: [-8, 8, -6, 6, -4, 4, 0] } :
                  phase === "opening" ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] } :
                  {}
                }
                transition={
                  phase === "idle"    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } :
                  phase === "shaking" ? { duration: 1.3, ease: "easeInOut" } :
                  phase === "opening" ? { duration: 0.5, ease: "easeIn" } :
                  {}
                }
                whileHover={phase === "idle" ? { scale: 1.08 } : {}}
                whileTap={phase === "idle" ? { scale: 0.94 } : {}}
              >
                <PokeballSVG size={140} open={phase === "opening"} />
              </motion.div>

              {/* Shaking dots */}
              {phase === "shaking" && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.3 }}
                  className="text-white/50 text-xs tracking-widest"
                >
                  ● ● ●
                </motion.p>
              )}

              {/* Flash on open */}
              {phase === "opening" && (
                <motion.div
                  className="absolute inset-0 bg-white pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </div>
          )}

          {/* ── REVEAL phase ── */}
          {phase === "reveal" && (
            <motion.div
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Rarity label */}
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`text-sm font-bold tracking-widest uppercase ${theme.label}`}
              >
                {RARITY_LABEL[result.rarity]}
              </motion.div>

              {/* Pokemon + light effects */}
              <div className="relative flex items-center justify-center">

                {/* Outer rotating light rays */}
                <motion.div
                  className="absolute w-72 h-72 rounded-full"
                  initial={{ opacity: 0, rotate: 0, scale: 0.3 }}
                  animate={{ opacity: 1, rotate: 360, scale: 1 }}
                  transition={{ rotate: { duration: 8, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.4 }, scale: { duration: 0.5, type: "spring" } }}
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, ${theme.rays}55 10deg, transparent 20deg, transparent 40deg, ${theme.rays}33 50deg, transparent 60deg, transparent 80deg, ${theme.rays}55 90deg, transparent 100deg, transparent 120deg, ${theme.rays}33 130deg, transparent 140deg, transparent 160deg, ${theme.rays}55 170deg, transparent 180deg, transparent 200deg, ${theme.rays}33 210deg, transparent 220deg, transparent 240deg, ${theme.rays}55 250deg, transparent 260deg, transparent 280deg, ${theme.rays}33 290deg, transparent 300deg, transparent 320deg, ${theme.rays}55 330deg, transparent 340deg, transparent 360deg)`,
                  }}
                />

                {/* Inner glow rings */}
                {[64, 96, 128].map((size, i) => (
                  <motion.div
                    key={size}
                    className="absolute rounded-full border-2"
                    style={{ width: size, height: size, borderColor: theme.glow + "88" }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.4] }}
                    transition={{ delay: i * 0.15, duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                  />
                ))}

                {/* Radial glow behind pokemon */}
                <div
                  className="absolute w-48 h-48 rounded-full"
                  style={{ background: `radial-gradient(circle, ${theme.glow}40 0%, transparent 70%)` }}
                />

                {/* The Pokemon sprite — big! */}
                {imgSrc && (
                  <motion.img
                    src={imgSrc}
                    alt={pokemonName}
                    className="relative z-10 pixelated drop-shadow-2xl"
                    style={{
                      width: 160, height: 160,
                      objectFit: "contain",
                      filter: `drop-shadow(0 0 20px ${theme.glow}) drop-shadow(0 0 40px ${theme.glow}88)`,
                    }}
                    initial={{ scale: 0, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}
                  />
                )}
              </div>

              {/* Name + dex number */}
              <motion.div
                className="text-center space-y-1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <p className="text-2xl font-bold text-white">{pokemonName}</p>
                <p className="text-sm text-white/50">#{String(result.pokemonId).padStart(3, "0")}</p>

                {result.isDuplicate ? (
                  <motion.div
                    className="mt-1 space-y-0.5"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                  >
                    <p className="text-sm text-yellow-400">Already in your Pokédex!</p>
                    {result.xpGained && (
                      <p className="text-sm font-bold text-emerald-400">+{result.xpGained} XP</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    className="text-sm text-emerald-400 mt-1"
                    initial={{ scale: 0.8 }} animate={{ scale: [0.8, 1.1, 1] }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                  >
                    ✓ New Pokémon caught!
                  </motion.p>
                )}
              </motion.div>

              {/* Confirm button */}
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={onClose}
                className="mt-2 px-8 py-3 rounded-2xl font-semibold text-sm text-white border-0 gradient-primary shadow-lg"
                style={{ boxShadow: `0 0 24px ${theme.glow}66` }}
              >
                Awesome! 🎉
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function PokeballSVG({ size = 140, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Shadow */}
      <ellipse cx="50" cy="95" rx="28" ry="5" fill="black" opacity="0.25" />
      {/* Top half */}
      <motion.path
        d="M10 50 A40 40 0 0 1 90 50"
        fill={open ? "#cc2222" : "#e63535"}
        animate={open ? { d: "M10 50 A40 40 0 0 1 90 50", translateY: -8 } : {}}
      />
      {/* Bottom half */}
      <motion.path
        d="M10 50 A40 40 0 0 0 90 50"
        fill="white"
        animate={open ? { translateY: 8 } : {}}
      />
      {/* Shine on top half */}
      <path d="M22 28 Q35 20 50 22 Q38 26 28 35 Z" fill="white" opacity="0.25" />
      {/* Outer ring */}
      <circle cx="50" cy="50" r="40" stroke="#1a1a1a" strokeWidth="4" fill="none" />
      {/* Middle band */}
      <line x1="10" y1="50" x2="90" y2="50" stroke="#1a1a1a" strokeWidth="5" />
      {/* Centre button outer */}
      <circle cx="50" cy="50" r="13" fill="white" stroke="#1a1a1a" strokeWidth="4" />
      {/* Centre button inner */}
      <circle cx="50" cy="50" r="7" fill={open ? "#cccccc" : "#f0f0f0"} />
      {/* Button shine */}
      <circle cx="47" cy="47" r="2.5" fill="white" opacity="0.6" />
    </svg>
  );
}
