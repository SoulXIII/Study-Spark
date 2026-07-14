import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Moon, Bell, Shield, Crown, ChevronRight, LogOut, Target, Check, CreditCard, Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const reminderTimes = ["7:00 AM", "8:00 AM", "9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];
const GOAL_PRESETS = [
  { mins: 15, label: "15 min", note: "Quick review" },
  { mins: 25, label: "25 min", note: "Pomodoro ⭐" },
  { mins: 45, label: "45 min", note: "Deep focus" },
  { mins: 60, label: "1 hour", note: "Recommended" },
  { mins: 90, label: "1.5 hrs", note: "Intensive" },
  { mins: 120, label: "2 hrs", note: "Max focus" },
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [darkMode, setDarkMode] = useState(true);
  const [reminderTime, setReminderTime] = useState("8:00 AM");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState(user?.name || "");
  const [usernameError, setUsernameError] = useState("");

  // Stats
  const [stats, setStats] = useState({ studySetsCount: 0, totalCards: 0, completedCount: 0, totalHours: 0 });

  // XP
  const [xpInfo, setXpInfo] = useState<{
    level: number; xpIntoLevel: number; xpNeeded: number; totalXp: number; title: string;
    log: { amount: number; reason: string; created_at: string }[];
  } | null>(null);

  const XP_REASON_LABELS: Record<string, string> = {
    study_time:       "Studied",
    complete_flashcard: "Flashcards done",
    complete_quiz:    "Quiz completed",
    create_study_set: "Created study set",
    quest_complete:   "Quest completed",
    duplicate_common:     "Duplicate (Common)",
    duplicate_uncommon:   "Duplicate (Uncommon)",
    duplicate_rare:       "Duplicate (Rare)",
    duplicate_very_rare:  "Duplicate (Very Rare)",
    duplicate_legendary:  "Duplicate (Legendary)",
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/progress/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
    fetch(`${API_URL}/xp/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setXpInfo(data); })
      .catch(() => {});
  }, []);

  // Cancel subscription state
  const [cancellingPro, setCancellingPro] = useState(false);

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your Pro subscription? You'll lose access to Pro features.")) return;
    setCancellingPro(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/subscription`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) updateUser({ isPro: false, proSince: null });
    } catch { /* silent */ }
    finally { setCancellingPro(false); }
  };

  // Daily goal state
  const [goalMinutes, setGoalMinutes] = useState(user?.dailyGoalMinutes ?? 30);
  const [customGoal, setCustomGoal] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");

  // Payment state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    const isDarkMode = savedDarkMode === null ? true : JSON.parse(savedDarkMode);
    setDarkMode(isDarkMode);
    if (isDarkMode) document.documentElement.classList.remove("light");
    else document.documentElement.classList.add("light");
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", JSON.stringify(newDarkMode));
    if (newDarkMode) document.documentElement.classList.remove("light");
    else document.documentElement.classList.add("light");
  };

  const handleSaveGoal = async () => {
    const mins = customGoal.trim() ? parseInt(customGoal) : goalMinutes;
    if (!mins || mins < 1 || mins > 1440) {
      setGoalError("Please enter a valid number between 1 and 1440 minutes.");
      return;
    }
    setGoalSaving(true);
    setGoalError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dailyGoalMinutes: mins }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      updateUser({ dailyGoalMinutes: data.user.dailyGoalMinutes });
      setGoalMinutes(data.user.dailyGoalMinutes);
      setCustomGoal("");
      setActiveModal(null);
    } catch {
      setGoalError("Could not save goal. Please try again.");
    } finally {
      setGoalSaving(false);
    }
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const getCardBrand = (num: string) => {
    const d = num.replace(/\s/g, "");
    if (/^4/.test(d)) return "Visa";
    if (/^5[1-5]/.test(d)) return "Mastercard";
    if (/^3[47]/.test(d)) return "Amex";
    if (/^6/.test(d)) return "Discover";
    return null;
  };

  const handleUpgrade = async () => {
    setPaymentError("");
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length !== 16) { setPaymentError("Card number must be 16 digits."); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { setPaymentError("Use MM/YY format for expiry."); return; }
    const [mm, yy] = cardExpiry.split("/").map(Number);
    if (mm < 1 || mm > 12 || new Date(2000 + yy, mm - 1) < new Date(new Date().getFullYear(), new Date().getMonth())) {
      setPaymentError("Card is expired."); return;
    }
    if (!/^\d{3,4}$/.test(cardCvv.trim())) { setPaymentError("CVV must be 3 or 4 digits."); return; }
    if (cardName.trim().length < 2) { setPaymentError("Enter the cardholder name."); return; }

    setPaymentProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/auth/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardNumber: digits, expiry: cardExpiry, cvv: cardCvv, cardName }),
      });
      const data = await res.json();
      if (!res.ok) { setPaymentError(data.error || "Payment failed."); return; }
      updateUser({ isPro: true, proSince: data.user.proSince });
      setPaymentSuccess(true);
    } catch {
      setPaymentError("Could not connect. Please try again.");
    } finally {
      setPaymentProcessing(false);
    }
  };

  const openPaymentModal = () => {
    setCardNumber(""); setCardExpiry(""); setCardCvv(""); setCardName("");
    setPaymentError(""); setPaymentSuccess(false);
    setActiveModal("payment");
  };

  if (!user) {
    return (
      <PageTransition>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div className="py-4 space-y-6 max-w-lg mx-auto" variants={stagger} initial="hidden" animate="show">
        {/* Profile header */}
        <motion.div variants={fadeUp} className="glass-card p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
            <User size={28} className="text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.educationLevel ? user.educationLevel.replace("_", " ").toUpperCase() : "No education level set"} ·{" "}
              {user.isPro ? <span className="text-amber-400 font-medium">Pro Plan</span> : "Free Plan"}
            </p>
          </div>
        </motion.div>

        {/* XP / Level card */}
        {xpInfo && (
          <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <Zap size={14} className="text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Level {xpInfo.level}</p>
                  <p className="text-sm font-bold">{xpInfo.title}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-primary">{xpInfo.xpIntoLevel} / {xpInfo.xpNeeded} XP</p>
                <p className="text-[10px] text-muted-foreground">{xpInfo.totalXp} total</p>
              </div>
            </div>

            {/* XP bar */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (xpInfo.xpIntoLevel / xpInfo.xpNeeded) * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>

            {/* Recent XP log */}
            {xpInfo.log.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Recent XP</p>
                {xpInfo.log.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">{XP_REASON_LABELS[entry.reason] ?? entry.reason}</span>
                    <span className="text-emerald-400 font-semibold ml-2 flex-shrink-0">+{entry.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2">
          {[
            { label: "Study Sets", value: String(stats.studySetsCount) },
            { label: "Cards", value: String(stats.totalCards) },
            { label: "Completed", value: String(stats.completedCount) },
            { label: "Hours", value: String(stats.totalHours) },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-3 text-center">
              <p className="font-bold text-sm">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Upgrade / Pro card */}
        {user.isPro ? (
          <motion.div variants={fadeUp} className="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-3">
              <Crown size={24} className="text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                  Pro Plan <Sparkles size={14} />
                </p>
                <p className="text-xs text-muted-foreground">
                  Active since {user.proSince ? new Date(user.proSince).toLocaleDateString() : "today"}
                </p>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">Active</span>
            </div>
            <button
              onClick={handleCancelSubscription}
              disabled={cancellingPro}
              className="w-full text-xs text-muted-foreground hover:text-red-400 transition-colors py-1 border border-white/10 rounded-lg hover:border-red-500/20"
            >
              {cancellingPro ? "Cancelling…" : "Cancel subscription"}
            </button>
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} onClick={openPaymentModal} className="glass-card p-4 gradient-primary rounded-2xl cursor-pointer hover:opacity-90 transition-opacity">
            <div className="flex items-center gap-3">
              <Crown size={24} className="text-primary-foreground" />
              <div className="flex-1">
                <p className="font-semibold text-primary-foreground">Upgrade to Pro</p>
                <p className="text-xs text-primary-foreground/70">Unlimited study sets & AI features · $9.99/mo</p>
              </div>
              <ChevronRight size={18} className="text-primary-foreground/70" />
            </div>
          </motion.div>
        )}

        {/* Daily Goal — clickable */}
        <motion.div
          variants={fadeUp}
          onClick={() => { setGoalMinutes(user.dailyGoalMinutes ?? 30); setCustomGoal(""); setGoalError(""); setActiveModal("goal"); }}
          className="glass-card p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Target size={18} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Daily Study Goal</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user.dailyGoalMinutes ?? 30} minutes per day</p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>
        </motion.div>

        {/* Subjects */}
        {user.subjects && user.subjects.length > 0 && (
          <motion.div variants={fadeUp} className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Your Subjects</p>
            <div className="flex flex-wrap gap-2">
              {user.subjects.map((subject) => (
                <div key={subject} className="glass-card px-3 py-1 text-xs text-primary">{subject}</div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Settings */}
        <motion.div variants={fadeUp} className="space-y-1">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Settings</p>
          <div onClick={() => setActiveModal("darkmode")} className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <Moon size={18} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Dark Mode</span>
            <span className="text-xs text-muted-foreground">{darkMode ? "On" : "Off"}</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
          <div onClick={() => setActiveModal("reminder")} className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <Bell size={18} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Study Reminders</span>
            <span className="text-xs text-muted-foreground">{reminderTime}</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
          <div onClick={() => setActiveModal("account")} className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <Shield size={18} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Account</span>
            <span className="text-xs text-muted-foreground">Manage</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Button onClick={handleLogout} className="w-full h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-semibold" variant="outline">
            <LogOut size={18} className="mr-2" /> Sign Out
          </Button>
        </motion.div>
      </motion.div>

      {/* Payment / Upgrade Modal */}
      <Dialog open={activeModal === "payment"} onOpenChange={(open) => { if (!open && !paymentProcessing) { setActiveModal(null); setPaymentSuccess(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown size={18} className="text-amber-400" /> Upgrade to Pro
            </DialogTitle>
            <DialogDescription>$9.99 / month · Cancel anytime</DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-lg">You're now Pro!</p>
                <p className="text-sm text-muted-foreground mt-1">Enjoy unlimited study sets and all AI features.</p>
              </div>
              <Button onClick={() => setActiveModal(null)} className="w-full gradient-primary text-primary-foreground border-0">
                Get Started
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pro features list */}
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-1.5">
                {["Unlimited study sets", "AI generation from any source", "PDF & image scanning", "Priority support"].map(f => (
                  <p key={f} className="text-xs flex items-center gap-2 text-foreground">
                    <Check size={12} className="text-primary flex-shrink-0" /> {f}
                  </p>
                ))}
              </div>

              {/* Card number */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard size={12} /> Card Number</p>
                <div className="relative">
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={e => { setCardNumber(formatCardNumber(e.target.value)); setPaymentError(""); }}
                    className="bg-muted/30 border-white/10 font-mono tracking-widest pr-16"
                    maxLength={19}
                  />
                  {getCardBrand(cardNumber) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                      {getCardBrand(cardNumber)}
                    </span>
                  )}
                </div>
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expiry (MM/YY)</p>
                  <Input
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={e => { setCardExpiry(formatExpiry(e.target.value)); setPaymentError(""); }}
                    className="bg-muted/30 border-white/10 font-mono"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={10} /> CVV</p>
                  <Input
                    placeholder="123"
                    value={cardCvv}
                    onChange={e => { setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4)); setPaymentError(""); }}
                    className="bg-muted/30 border-white/10 font-mono"
                    maxLength={4}
                    type="password"
                  />
                </div>
              </div>

              {/* Cardholder name */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cardholder Name</p>
                <Input
                  placeholder="Name on card"
                  value={cardName}
                  onChange={e => { setCardName(e.target.value); setPaymentError(""); }}
                  className="bg-muted/30 border-white/10"
                />
              </div>

              {paymentError && <p className="text-xs text-red-400">{paymentError}</p>}

              <Button
                onClick={handleUpgrade}
                disabled={paymentProcessing}
                className="w-full gradient-primary text-primary-foreground border-0 h-11"
              >
                {paymentProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Processing…
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Crown size={16} /> Pay $9.99 / month</span>
                )}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Lock size={10} /> Secured · 256-bit encryption · Cancel anytime
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Daily Goal Modal */}
      <Dialog open={activeModal === "goal"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Study Goal</DialogTitle>
            <DialogDescription>How many minutes do you want to study each day?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Research note */}
            <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
              💡 Research shows <span className="text-foreground font-medium">25–60 minutes</span> of focused study per day leads to the best retention. The 25-min Pomodoro technique is a proven favourite.
            </p>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
              {GOAL_PRESETS.map(({ mins, label, note }) => (
                <button
                  key={mins}
                  onClick={() => { setGoalMinutes(mins); setCustomGoal(""); setGoalError(""); }}
                  className={`relative flex flex-col items-center gap-0.5 p-3 rounded-xl text-sm font-medium transition-all border ${
                    goalMinutes === mins && !customGoal
                      ? "gradient-primary text-primary-foreground border-transparent"
                      : "glass-card text-muted-foreground border-white/10 hover:border-primary/40"
                  }`}
                >
                  {goalMinutes === mins && !customGoal && (
                    <Check size={11} className="absolute top-1.5 right-1.5 text-primary-foreground" />
                  )}
                  <span className="font-semibold">{label}</span>
                  <span className={`text-[10px] ${goalMinutes === mins && !customGoal ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>{note}</span>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Custom amount</p>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  placeholder="e.g. 75"
                  value={customGoal}
                  onChange={(e) => { setCustomGoal(e.target.value); setGoalError(""); }}
                  className="bg-muted/30 border-white/10"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">min / day</span>
              </div>
            </div>

            {goalError && <p className="text-xs text-red-400">{goalError}</p>}

            <Button
              onClick={handleSaveGoal}
              disabled={goalSaving}
              className="w-full gradient-primary text-primary-foreground border-0"
            >
              {goalSaving ? "Saving…" : "Save Goal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dark Mode Modal */}
      <Dialog open={activeModal === "darkmode"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dark Mode</DialogTitle>
            <DialogDescription>Toggle dark mode for your studies</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">Enable Dark Mode</p>
                <p className="text-sm text-muted-foreground">Reduce eye strain during late night study sessions</p>
              </div>
              <div className="relative w-12 h-6 bg-primary/30 rounded-full cursor-pointer" onClick={handleDarkModeToggle}>
                <div className={`absolute top-1 w-4 h-4 bg-primary rounded-full transition-transform ${darkMode ? "right-1" : "left-1"}`} />
              </div>
            </div>
            <Button onClick={() => setActiveModal(null)} className="w-full">Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Study Reminders Modal */}
      <Dialog open={activeModal === "reminder"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Study Reminders</DialogTitle>
            <DialogDescription>Choose when you'd like to be reminded to study</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {reminderTimes.map((time) => (
              <div
                key={time}
                onClick={() => { setReminderTime(time); setActiveModal(null); }}
                className={`p-3 rounded-lg cursor-pointer transition-all ${reminderTime === time ? "bg-primary/20 border border-primary text-primary" : "glass-card hover:bg-muted/50"}`}
              >
                <p className="font-medium text-sm">{time}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Modal */}
      <Dialog open={activeModal === "account"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
            <DialogDescription>Manage your account information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Display Name</p>
              <Input value={editUsername} onChange={(e) => { setEditUsername(e.target.value); setUsernameError(""); }} placeholder="Enter your name" className="bg-muted/30 border-white/10" />
              {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Account Email</p>
              <div className="glass-card p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Button className="w-full bg-primary/20 border border-primary text-primary hover:bg-primary/30" onClick={() => {
                if (editUsername.trim().length < 2) { setUsernameError("Username must be at least 2 characters"); return; }
                updateUser({ name: editUsername.trim() });
                setActiveModal(null);
              }}>
                Save Changes
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setEditUsername(user?.name || ""); setUsernameError(""); setActiveModal(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default ProfilePage;
