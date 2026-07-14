import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import TopNav from "./TopNav";
import PokemonCompanion from "./PokemonCompanion";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// Log every full minute the user spends anywhere on the site.
// Only counts while the browser tab is visible (pauses on tab-switch / minimize).
function useGlobalTimeTracker() {
  const visibleSinceRef = useRef<number | null>(Date.now());
  const accumulatedRef  = useRef(0); // ms accumulated while visible

  useEffect(() => {
    const token = () => localStorage.getItem("token");

    const logMinutes = (mins: number) => {
      if (mins <= 0 || !token()) return;
      fetch(`${API_URL}/progress/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ minutes: mins }),
      }).catch(() => {});
      fetch(`${API_URL}/pokemon/quests/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ questType: "study_15min", increment: mins }),
      }).catch(() => {});
    };

    // Tick every 60 s: flush any full accumulated minutes
    const interval = setInterval(() => {
      if (visibleSinceRef.current !== null) {
        accumulatedRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = Date.now();
      }
      const mins = Math.floor(accumulatedRef.current / 60_000);
      if (mins > 0) {
        accumulatedRef.current -= mins * 60_000;
        logMinutes(mins);
      }
    }, 60_000);

    // Pause accumulation when tab is hidden, resume when visible
    const onVisibility = () => {
      if (document.hidden) {
        if (visibleSinceRef.current !== null) {
          accumulatedRef.current += Date.now() - visibleSinceRef.current;
          visibleSinceRef.current = null;
        }
      } else {
        visibleSinceRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Flush remaining time on unmount / page close
    const onUnload = () => {
      if (visibleSinceRef.current !== null)
        accumulatedRef.current += Date.now() - visibleSinceRef.current;
      const mins = Math.round(accumulatedRef.current / 60_000);
      logMinutes(mins);
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      onUnload();
    };
  }, []);
}

const Layout = () => {
  const location = useLocation();
  useGlobalTimeTracker();

  return (
    <div className="min-h-screen gradient-mesh-bg">
      <TopNav />
      <main className="pb-20 md:pb-6 md:pt-20 px-4 max-w-6xl mx-auto">
        <Outlet key={location.pathname} />
      </main>
      <BottomNav />
      <PokemonCompanion />
    </div>
  );
};

export default Layout;
