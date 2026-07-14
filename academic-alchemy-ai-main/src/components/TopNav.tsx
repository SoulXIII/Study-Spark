import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Camera, FolderOpen, User } from "lucide-react";

const tabs = [
  { path: "/",        label: "Home",    icon: Home      },
  { path: "/create",  label: "Study",   icon: BookOpen  },
  { path: "/solve",   label: "Solve",   icon: Camera    },
  { path: "/folders", label: "Folders", icon: FolderOpen},
  { path: "/pokedex", label: "Pokédex", icon: null      },
  { path: "/profile", label: "Profile", icon: User      },
];

const StudySparkLogo = () => (
  <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden="true">
    <rect width="36" height="36" rx="10" fill="url(#ss-grad)" />
    {/* Lightning bolt / spark */}
    <path
      d="M21 5L12 20H18.5L15 31L26 16H19.5L24 5H21Z"
      fill="white"
      fillOpacity="0.95"
    />
    <defs>
      <linearGradient id="ss-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6" />
        <stop offset="1" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
  </svg>
);

const TopNav = () => {
  const { pathname } = useLocation();

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/10 rounded-none">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <StudySparkLogo />
          <span className="font-bold text-lg text-foreground tracking-tight">
            Study<span className="text-primary">Spark</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {tabs.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {Icon ? <Icon size={16} /> : <span className="text-base leading-none">🎮</span>}
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
