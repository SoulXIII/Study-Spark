import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, animate, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  getAnimatedSprite, getStaticSprite, getCryUrl,
  fetchPokemonTypes, fetchPokemonFlavor, TYPE_EMOJIS,
} from "@/lib/pokemonData";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const SIZE = 64;
const SLEEP_AFTER_MS = 60_000; // 1 minute of inactivity

// ── Personality (varies per Pokémon ID) ────────────────────────────────────
const getPersonality = (id: number) => ({
  speed:    28 + (id % 5) * 7,    // px/s  (RPG-style: 28–56)
  spinOnJump: id % 9 === 0,
});

// ── Speech pools ────────────────────────────────────────────────────────────
const SPEECH = {
  correct:   ["Nice! ✨", "That's right!", "Nailed it! 🎯", "You got it!", "Correct! 🌟", "Perfect! 💯", "Smart! 🧠"],
  wrong:     ["Oops...", "Try again! 💪", "Don't give up!", "Almost! 🤔", "You'll get it! 🌱"],
  celebrate: ["Yahoo! 🎉", "Amazing! 🏆", "You did it!", "Woohoo! ⭐", "Legend! 👑"],
  xp:        ["+XP! ✨", "Level up soon! ⚡", "Growing stronger!", "Power up! 💫"],
  idle:      ["Keep studying! 📚", "Flashcards time! 🃏", "Stay focused! 🎯", "You got this! 💪", "Level up soon! ⚡", "Brain fuel! 🧠"],
  happy:     ["Hehe! ✨", "Yay! 💕", "That tickles! 😄", "*wiggles happily*", "Wheee! 💫", "Hi there! 👋"],
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ── Contextual walk targets (fraction of viewport width) ────────────────────
const ROUTE_FRACS: { test: (p: string) => boolean; fracs: number[] }[] = [
  { test: p => p === "/",                                           fracs: [0.08, 0.50, 0.82] },
  { test: p => p.includes("/quiz") || p.includes("/flashcards"),   fracs: [0.30, 0.50, 0.70] },
  { test: p => p.includes("/profile"),                             fracs: [0.20, 0.50, 0.80] },
  { test: p => p.includes("/pokedex"),                             fracs: [0.10, 0.35, 0.65, 0.90] },
  { test: p => p.includes("/study-set") || p.includes("/create"),  fracs: [0.35, 0.50, 0.65] },
];
function contextualTarget(pathname: string, minX: number, maxX: number): number {
  const entry = ROUTE_FRACS.find(e => e.test(pathname));
  const fracs = entry ? entry.fracs : [0.15, 0.50, 0.85];
  return Math.max(minX, Math.min(maxX, Math.round(pick(fracs) * window.innerWidth - SIZE / 2)));
}

const CONTEXTUAL_SPEECH: Record<string, string[]> = {
  quiz:       ["You can do it! 💪", "Think carefully! 🧠", "Almost there! 🎯"],
  flashcards: ["Flip flip! 🃏", "Keep going! ⚡", "Great memory! 🧠"],
  profile:    ["Check your XP! ⭐", "Level up soon! ⚡", "Nice progress! 📈"],
  pokedex:    ["Gotta catch 'em all! 🎯", "Cool Pokémon! ✨"],
  home:       ["Let's study! 📚", "What's next? ⭐", "Study time! 📖"],
};
function routeKey(p: string): string | null {
  if (p.includes("/quiz"))       return "quiz";
  if (p.includes("/flashcards")) return "flashcards";
  if (p.includes("/profile"))    return "profile";
  if (p.includes("/pokedex"))    return "pokedex";
  if (p === "/")                 return "home";
  return null;
}

// ── Types ───────────────────────────────────────────────────────────────────
type PetState = "idle" | "walking" | "reacting" | "sleeping" | "celebrating";
type BubbleVariant = "default" | "correct" | "wrong" | "celebrate" | "xp" | "sleep";
type SparkleVariant = "correct" | "celebrate" | "xp";

// ── Sub-components ──────────────────────────────────────────────────────────
const ANIM_OPTIONS = [
  { id: "attack", label: "⚔️ Attack", desc: "Lunge forward" },
  { id: "dance",  label: "💃 Dance",  desc: "Groove around" },
  { id: "spin",   label: "🌀 Spin",   desc: "360° spin" },
  { id: "cry",    label: "🔊 Cry",    desc: "Hear your Pokémon" },
];

const SPARKLE_SETS: Record<SparkleVariant, { emoji: string; color?: string }[]> = {
  correct:   [{ emoji: "✨" }, { emoji: "⭐" }, { emoji: "💫" }, { emoji: "✨" }],
  celebrate: [{ emoji: "🎉" }, { emoji: "⭐" }, { emoji: "✨" }, { emoji: "🌟" }, { emoji: "💫" }, { emoji: "🎊" }],
  xp:        [{ emoji: "+XP", color: "#a78bfa" }, { emoji: "⭐" }, { emoji: "+XP", color: "#818cf8" }, { emoji: "⚡" }],
};

function Sparkles({ show, variant = "correct" }: { show: boolean; variant?: SparkleVariant }) {
  if (!show) return null;
  const items = SPARKLE_SETS[variant];
  const big = variant === "celebrate";
  const xp  = variant === "xp";
  return (
    <>
      {items.map((s, i) => (
        <span key={i} style={{
          position: "absolute", pointerEvents: "none", zIndex: 10,
          fontSize:   big ? 13 : xp ? 8 : 11,
          fontWeight: xp ? "bold" : undefined,
          fontFamily: xp ? "monospace" : undefined,
          color:      s.color,
          top:  -8 - i * (big ? 7 : 5),
          left: SIZE / 2 + Math.cos((i / items.length) * Math.PI * 2) * (big ? 32 : 26),
          animation: `sparkle-float ${big ? 0.9 : 0.75}s ease-out ${i * 0.09}s forwards`,
        }}>{s.emoji}</span>
      ))}
    </>
  );
}

function ZzzBubbles({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{ position: "absolute", top: -10, right: -10, pointerEvents: "none" }}>
      {(["z", "z", "Z"] as const).map((z, i) => (
        <span key={i} style={{
          position: "absolute", fontSize: 9 + i * 3,
          color: "#94a3b8", fontFamily: "monospace", fontWeight: "bold",
          top: -i * 13, left: i * 7,
          animation: `zzz-float ${1.2 + i * 0.5}s ease-out ${i * 0.7}s infinite`,
        }}>{z}</span>
      ))}
    </div>
  );
}

function PixelBubble({ text, variant = "default", offsetX = 0 }:
  { text: string; variant?: BubbleVariant; offsetX?: number }) {
  const wrapClass = ["absolute bottom-full mb-1 left-1/2 pixel-bubble-wrap",
    variant !== "default" ? `pixel-bubble-wrap--${variant}` : ""].filter(Boolean).join(" ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.72 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{    opacity: 0, y: 4,  scale: 0.88 }}
      transition={{ type: "spring", stiffness: 520, damping: 28, mass: 0.75 }}
      className={wrapClass}
      style={{ transform: `translateX(calc(-50% + ${offsetX}px))`, zIndex: 50, pointerEvents: "none" }}
    >
      <div className="pixel-bubble">{text}</div>
      <div className="pixel-bubble-tail">
        <div className="pixel-bubble-tail-1" />
        <div className="pixel-bubble-tail-2" />
        <div className="pixel-bubble-tail-3" />
      </div>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function PokemonCompanion() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isStudying = location.pathname.includes("/flashcards") || location.pathname.includes("/quiz");

  // ── State ─────────────────────────────────────────────────────────────────
  const [companionId, setCompanionId] = useState<number | null>(null);
  const [imgSrc,      setImgSrc]      = useState("");
  const [petState,    setPetState]    = useState<PetState>("idle");
  const [showAnimMenu,setShowAnimMenu]= useState(false);
  const [flipX,       setFlipX]       = useState(false);
  const [spinning,    setSpinning]    = useState(false);
  const [showSparkles,setShowSparkles]= useState(false);
  const [sparkleVariant, setSparkleVariant] = useState<SparkleVariant>("correct");
  const [showWrong,   setShowWrong]   = useState(false);
  const [showHappy,   setShowHappy]   = useState(false);
  const [isReacting,  setIsReacting]  = useState(false);
  const [showSpeech,  setShowSpeech]  = useState(false);
  const [speechText,  setSpeechText]  = useState("");
  const [bubbleVariant, setBubbleVariant] = useState<BubbleVariant>("default");
  const [bubbleOffsetX, setBubbleOffsetX] = useState(0);
  const [pokemonName, setPokemonName] = useState("");
  const [pokemonTypes,setPokemonTypes]= useState<string[]>(["normal"]);
  const [flavorText,  setFlavorText]  = useState("");

  // ── Motion values ─────────────────────────────────────────────────────────
  const x      = useMotionValue(-SIZE);
  const y      = useMotionValue(0);
  const rotate = useMotionValue(0);
  const scaleXSpring = useSpring(1, { stiffness: 420, damping: 28 });

  // ── Refs (stable across renders, safe in callbacks) ───────────────────────
  // Use a cleanup token instead of componentMounted to survive React Strict Mode
  // double-invocation: each effect creates its own token, old ones are invalidated.
  const walkActive   = useRef(false);
  const isMovingRef  = useRef(false);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const xAnimRef     = useRef<ReturnType<typeof animate> | null>(null);
  const yBobRef      = useRef<ReturnType<typeof animate> | null>(null);
  const petStateRef  = useRef<PetState>("idle");
  const pathnameRef  = useRef(location.pathname);
  const nextTargetRef= useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const speechTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const personalityRef  = useRef(getPersonality(1));
  // alive flag – reset true on every (re)mount, false only when truly unmounting
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => { petStateRef.current = petState; }, [petState]);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);
  useEffect(() => { scaleXSpring.set(flipX ? -1 : 1); }, [flipX, scaleXSpring]);

  // ── Load companion ID ─────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/pokemon/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive.current) setCompanionId(data?.companion_pokemon_id ?? null); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail?.id;
      if (id && alive.current) setCompanionId(id);
    };
    window.addEventListener("companion-changed", handler);
    return () => window.removeEventListener("companion-changed", handler);
  }, []);

  // ── Load sprite + metadata when companionId changes ───────────────────────
  useEffect(() => {
    if (!companionId) return;
    personalityRef.current = getPersonality(companionId);

    // Set the animated GIF immediately — no preloader — so the pet always renders.
    // The <img> onError falls back to the static PNG if the GIF 404s.
    setImgSrc(getAnimatedSprite(companionId));

    fetchPokemonTypes(companionId).then(t => { if (alive.current) setPokemonTypes(t); });
    fetchPokemonFlavor(companionId).then(f => { if (alive.current) setFlavorText(f); });

    try {
      const cache = JSON.parse(localStorage.getItem("studyspark_pokemon_names_v1") ?? "{}");
      if (cache[companionId]) { setPokemonName(cache[companionId]); return; }
    } catch {}
    setPokemonName(`#${companionId}`);
  }, [companionId]);

  // ── Speech helper ─────────────────────────────────────────────────────────
  const showBubble = useCallback((text: string, duration = 3200, variant: BubbleVariant = "default") => {
    const mid  = x.get() + SIZE / 2;
    const half = 82, margin = 10;
    let offset = 0;
    const lo = margin - (mid - half);
    const ro = (mid + half) - (window.innerWidth - margin);
    if (lo > 0) offset = lo; else if (ro > 0) offset = -ro;
    setSpeechText(text);
    setBubbleVariant(variant);
    setBubbleOffsetX(offset);
    setShowSpeech(true);
    clearTimeout(speechTimerRef.current);
    speechTimerRef.current = window.setTimeout(() => {
      if (alive.current) setShowSpeech(false);
    }, duration);
  }, [x]);

  // ── Stop all movement helpers ─────────────────────────────────────────────
  const stopWalk = useCallback(() => {
    walkActive.current = false;
    isMovingRef.current = false;
    clearTimeout(walkTimerRef.current);
    xAnimRef.current?.stop();
    yBobRef.current?.stop();
    y.set(0);
  }, [y]);

  // ── Walk loop ─────────────────────────────────────────────────────────────
  const doWalk = useCallback(() => {
    if (!walkActive.current) return;
    clearTimeout(walkTimerRef.current);
    xAnimRef.current?.stop();
    yBobRef.current?.stop();
    y.set(0);

    const p    = personalityRef.current;
    const maxX = window.innerWidth - SIZE - 16;
    const minX = 8;
    const curX = x.get();

    // 70% → contextual page target, 30% → random
    let targetX = Math.random() < 0.70
      ? contextualTarget(pathnameRef.current, minX, maxX)
      : minX + Math.random() * (maxX - minX);

    // Don't stay in the same spot
    if (Math.abs(targetX - curX) < 80)
      targetX = curX > maxX / 2 ? minX + 60 : maxX - 60;
    targetX = Math.max(minX, Math.min(maxX, targetX));

    // Consume one-shot override (e.g. rush to center after celebrate)
    if (nextTargetRef.current !== null) {
      targetX = Math.max(minX, Math.min(maxX, nextTargetRef.current));
      nextTargetRef.current = null;
    }

    setFlipX(targetX < curX);
    setPetState("walking");
    isMovingRef.current = true;

    const dist     = Math.abs(targetX - curX);
    const duration = dist / p.speed;

    // Rhythmic step-bob: feels like footsteps instead of a sliding tile
    const step = 0.42;
    const cycles = Math.max(2, Math.ceil(duration / step));
    yBobRef.current = animate(y,
      Array.from({ length: cycles * 2 + 1 }, (_, i) => (i % 2 === 0 ? 0 : -6)),
      { duration: step * cycles, ease: "linear" }
    );

    if (p.spinOnJump && Math.random() < 0.08) {
      setSpinning(true);
      animate(rotate, [0, targetX < curX ? -360 : 360], { duration: Math.min(duration, 0.55) })
        .then(() => { if (alive.current) { rotate.set(0); setSpinning(false); } });
    }

    xAnimRef.current = animate(x, targetX, {
      duration,
      ease: "easeInOut",
      onComplete: () => {
        if (!walkActive.current) return;
        yBobRef.current?.stop();
        y.set(0);
        isMovingRef.current = false;
        setPetState("idle");

        const onStudy = pathnameRef.current.includes("/quiz") || pathnameRef.current.includes("/flashcards");
        if (!onStudy && Math.random() < 0.40) {
          const key  = routeKey(pathnameRef.current);
          const pool = key ? CONTEXTUAL_SPEECH[key] : null;
          showBubble(pool ? pick(pool) : pick(SPEECH.idle));
        }

        // Short pause (200–900 ms) then next walk
        walkTimerRef.current = window.setTimeout(doWalk, 200 + Math.random() * 700);
      },
    });
  }, [x, y, rotate, showBubble, stopWalk]);

  // Start walk when sprite is ready
  useEffect(() => {
    if (!imgSrc) return;
    walkActive.current = true;
    x.set(60 + Math.random() * Math.max(window.innerWidth - SIZE - 120, 80));
    y.set(0); rotate.set(0);
    doWalk();
    return () => {
      stopWalk();
    };
  }, [imgSrc, doWalk, x, y, rotate, stopWalk]);

  // ── Inactivity → sleep ────────────────────────────────────────────────────
  const wakePet = useCallback(() => {
    if (!alive.current || petStateRef.current !== "sleeping") return;
    lastActivityRef.current = Date.now();
    setShowSpeech(false);
    setPetState("idle");
    walkActive.current = true;
    y.set(0);
    window.setTimeout(doWalk, 200);
  }, [doWalk, y]);

  // Sleep check — runs every 10 s, sleeps after SLEEP_AFTER_MS of inactivity
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!alive.current) return;
      if (
        Date.now() - lastActivityRef.current > SLEEP_AFTER_MS &&
        petStateRef.current !== "sleeping" &&
        petStateRef.current !== "reacting" &&
        petStateRef.current !== "celebrating"
      ) {
        stopWalk();
        setPetState("sleeping");
        showBubble("Zzz... 💤", 999_999, "sleep");
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [showBubble, stopWalk]);

  // Activity tracking — mouse/keyboard resets the inactivity clock
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (petStateRef.current === "sleeping") wakePet();
    };
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown",   onActivity, { passive: true });
    window.addEventListener("click",     onActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown",   onActivity);
      window.removeEventListener("click",     onActivity);
    };
  }, [wakePet]);

  // ── Cursor facing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isMovingRef.current &&
          petStateRef.current !== "sleeping" &&
          petStateRef.current !== "reacting" &&
          petStateRef.current !== "celebrating") {
        setFlipX(e.clientX < x.get() + SIZE / 2);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [x]);

  // ── Reactions (correct / wrong / celebrate / xp) ─────────────────────────
  const triggerReaction = useCallback((type: "correct" | "wrong" | "celebrate" | "xp") => {
    if (petStateRef.current === "sleeping") wakePet();

    const wasWalking = walkActive.current;
    stopWalk();

    setIsReacting(true);
    setPetState(type === "celebrate" ? "celebrating" : "reacting");
    showBubble(pick(SPEECH[type]), 3200, type as BubbleVariant);

    const centerX = Math.round(window.innerWidth / 2 - SIZE / 2);

    if (type === "correct") {
      setSparkleVariant("correct");
      setShowSparkles(true);
      window.setTimeout(() => { if (alive.current) setShowSparkles(false); }, 900);
      animate(y, [0, -42, 0], { duration: 0.5, ease: "easeOut" });
      // small dash toward the quiz card (center)
      animate(x, x.get() + (x.get() < centerX ? 28 : -28), { duration: 0.3, ease: "easeOut" });

    } else if (type === "wrong") {
      setShowWrong(true);
      window.setTimeout(() => { if (alive.current) setShowWrong(false); }, 600);
      const cx = x.get();
      animate(x, [cx, cx + 10, cx - 10, cx + 6, cx - 6, cx], { duration: 0.45 });

    } else if (type === "celebrate") {
      setSparkleVariant("celebrate");
      setShowSparkles(true);
      window.setTimeout(() => { if (alive.current) setShowSparkles(false); }, 1500);
      // Rush to center → spin → big jump
      animate(x, centerX, { duration: 0.5, ease: "easeInOut" });
      setSpinning(true);
      animate(rotate, [0, 360], { duration: 0.5 }).then(() => {
        if (!alive.current) return;
        rotate.set(0); setSpinning(false);
        animate(y, [0, -60, 8, 0], { duration: 0.7, ease: "easeOut" });
      });

    } else if (type === "xp") {
      setSparkleVariant("xp");
      setShowSparkles(true);
      window.setTimeout(() => { if (alive.current) setShowSparkles(false); }, 900);
      animate(y, [0, -24, 0], { duration: 0.45, ease: "easeOut" });
    }

    const duration = type === "celebrate" ? 2500 : 1600;
    window.setTimeout(() => {
      if (!alive.current) return;
      setPetState("idle");
      setIsReacting(false);
      if (wasWalking) {
        walkActive.current = true;
        if (type === "celebrate") nextTargetRef.current = centerX;
        walkTimerRef.current = window.setTimeout(doWalk, 400);
      }
    }, duration);
  }, [x, y, rotate, showBubble, stopWalk, wakePet, doWalk]);

  // Listen for events dispatched by QuizMode / FlashcardMode / QuestPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>).detail?.type;
      if (type === "correct" || type === "wrong" || type === "celebrate" || type === "xp")
        triggerReaction(type);
    };
    window.addEventListener("pokemon-react", handler);
    return () => window.removeEventListener("pokemon-react", handler);
  }, [triggerReaction]);

  // ── Occasional flavor-text speech ─────────────────────────────────────────
  useEffect(() => {
    if (!flavorText) return;
    let tid: ReturnType<typeof setTimeout>;
    const schedule = () => {
      tid = window.setTimeout(() => {
        if (alive.current && petStateRef.current !== "sleeping") showBubble(flavorText, 4500);
        if (alive.current) schedule();
      }, 150_000 + Math.random() * 90_000);
    };
    schedule();
    return () => clearTimeout(tid);
  }, [flavorText, showBubble]);

  // ── Outside-click closes menu ─────────────────────────────────────────────
  useEffect(() => {
    if (!showAnimMenu) return;
    const close = () => setShowAnimMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showAnimMenu]);

  // ── Right-click manual animations ────────────────────────────────────────
  const playAnimation = useCallback((type: string) => {
    setShowAnimMenu(false);
    if (petStateRef.current === "sleeping") wakePet();
    stopWalk();
    setPetState("reacting");

    const curX     = x.get();
    const dir      = flipX ? -1 : 1;
    const typeEmoji = TYPE_EMOJIS[pokemonTypes[0]] ?? "⚡";

    const resume = (delay = 400) => window.setTimeout(() => {
      if (!alive.current) return;
      setPetState("idle");
      walkActive.current = true;
      doWalk();
    }, delay);

    switch (type) {
      case "attack":
        showBubble(`${pokemonName} attacks! ${typeEmoji}`);
        animate(y, [0, -12, 0], { duration: 0.25 });
        xAnimRef.current = animate(x, [curX, curX + dir * 58, curX - dir * 6, curX],
          { duration: 0.5, ease: "easeOut", onComplete: () => resume(300) });
        break;
      case "dance": {
        showBubble(`${pokemonName} is dancing! ♪`);
        const sw = [curX, curX+20, curX-20, curX+14, curX-14, curX+7, curX-7, curX];
        animate(y, [0,-10,0,-8,0,-5,0,0], { duration: 1.6 });
        xAnimRef.current = animate(x, sw, { duration: 1.6, ease: "easeInOut", onComplete: () => resume(300) });
        break;
      }
      case "spin":
        showBubble(`${pokemonName} is spinning! 🌀`);
        setSpinning(true);
        animate(rotate, [0, 720], { duration: 0.65, ease: "easeInOut", onComplete: () => {
          if (!alive.current) return;
          rotate.set(0); setSpinning(false);
          animate(y, [0, -20, 0], { duration: 0.3 });
          resume(500);
        }});
        break;
      case "cry":
        if (companionId) {
          const audio = new Audio(getCryUrl(companionId));
          audio.volume = 0.5;
          audio.play().catch(() => {});
        }
        showBubble(`${pokemonName}!! ${pokemonName}!!`, 2500);
        animate(y, [0,-5,5,-4,4,-2,2,0], { duration: 0.55 });
        xAnimRef.current = animate(x, [curX,curX+5,curX-5,curX+4,curX-4,curX+2,curX-2,curX],
          { duration: 0.55, onComplete: () => resume(200) });
        break;
    }
  }, [x, y, rotate, flipX, companionId, pokemonName, pokemonTypes, doWalk, showBubble, stopWalk, wakePet]);

  // ── Click handlers ────────────────────────────────────────────────────────
  const handleLeftClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAnimMenu(false);
    if (petStateRef.current === "sleeping") { wakePet(); return; }
    setShowHappy(true);
    window.setTimeout(() => { if (alive.current) setShowHappy(false); }, 620);
    setSparkleVariant("correct");
    setShowSparkles(true);
    window.setTimeout(() => { if (alive.current) setShowSparkles(false); }, 750);
    animate(y, [0, -48, 6, 0], { duration: 0.52, ease: "easeOut" });
    showBubble(pick(SPEECH.happy));
  }, [y, showBubble, wakePet]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (petStateRef.current === "sleeping") { wakePet(); return; }
    setShowAnimMenu(m => !m);
  }, [wakePet]);

  // ── Don't render until we have a companion ID ─────────────────────────────
  if (!companionId) return null;

  const isSleeping = petState === "sleeping";

  const STATE_CLASS: Record<PetState, string> = {
    idle:        "pokemon-state-idle",
    walking:     "pokemon-state-walking",
    sleeping:    "pokemon-state-sleeping",
    reacting:    "pokemon-state-reacting",
    celebrating: "pokemon-state-celebrating",
  };
  const wrapperClass = [
    showHappy ? "pokemon-happy" : STATE_CLASS[petState],
    showWrong ? "pokemon-wrong-flash" : "",
  ].filter(Boolean).join(" ");

  return (
    <motion.div
      className="fixed bottom-24 z-40 md:bottom-8 select-none"
      animate={{
        opacity: (isStudying && !isReacting) ? 0.45 : 1,
        scale:   (isStudying && !isReacting) ? 0.60 : 1,
      }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      style={{ x, y, left: 0, top: "auto", pointerEvents: isStudying ? "none" : "auto" }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {showSpeech && speechText && (
          <PixelBubble text={speechText} variant={bubbleVariant} offsetX={bubbleOffsetX} />
        )}
      </AnimatePresence>

      {/* Right-click menu */}
      {showAnimMenu && (
        <div
          className="absolute bottom-full mb-10 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-white/15 rounded-xl shadow-xl overflow-hidden text-xs whitespace-nowrap"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 text-[10px] text-muted-foreground border-b border-white/10 font-medium">
            {pokemonName} · {pokemonTypes.map(t => TYPE_EMOJIS[t] ?? t).join(" ")}
          </div>
          {ANIM_OPTIONS.map(opt => (
            <button key={opt.id}
              className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors w-full text-left"
              onClick={() => playAnimation(opt.id)}>
              <span>{opt.label}</span>
              <span className="text-muted-foreground/60 text-[9px] ml-1">{opt.desc}</span>
            </button>
          ))}
          <div className="border-t border-white/10">
            <button className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors w-full"
              onClick={() => { setShowAnimMenu(false); navigate("/pokedex"); }}>🎮 Change companion</button>
            <button className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors w-full"
              onClick={() => { setShowAnimMenu(false); navigate("/pokedex"); }}>📖 Open Pokédex</button>
          </div>
        </div>
      )}

      {/* Sprite wrapper — CSS class drives per-state animation */}
      <div className={wrapperClass} style={{ position: "relative", width: SIZE, height: SIZE }}>
        <Sparkles show={showSparkles} variant={sparkleVariant} />
        <ZzzBubbles show={isSleeping} />

        <motion.img
          src={imgSrc || getStaticSprite(companionId)}
          alt="companion"
          className="pixelated cursor-pointer"
          onError={(e) => {
            const el = e.currentTarget;
            const fb = getStaticSprite(companionId);
            if (el.src !== fb) el.src = fb;
          }}
          style={{
            width: SIZE, height: SIZE,
            objectFit: "contain",
            imageRendering: "pixelated",
            scaleX:  scaleXSpring,
            rotate:  spinning ? rotate : isSleeping ? 20 : 0,
            filter: isSleeping
              ? "drop-shadow(0 4px 10px rgba(0,0,0,0.5)) brightness(0.65) saturate(0.4)"
              : "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
          }}
          onClick={handleLeftClick}
          onContextMenu={handleRightClick}
          whileHover={!isSleeping ? { scale: 1.15 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
      </div>
    </motion.div>
  );
}
