import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Camera, FolderOpen, User } from "lucide-react";

const tabs = [
  { path: "/",        label: "Home",    icon: Home      },
  { path: "/create",  label: "Study",   icon: BookOpen  },
  { path: "/solve",   label: "Solve",   icon: Camera    },
  { path: "/folders", label: "Folders", icon: FolderOpen},
  { path: "/profile", label: "Profile", icon: User      },
];

const PokeballIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
    <path d="M10 50 A40 40 0 0 1 90 50" fill={active ? "#e63535" : "#888"} />
    <path d="M10 50 A40 40 0 0 0 90 50" fill={active ? "#fff" : "#555"} />
    <circle cx="50" cy="50" r="40" stroke={active ? "hsl(var(--primary))" : "#555"} strokeWidth="6" fill="none" />
    <line x1="10" y1="50" x2="90" y2="50" stroke={active ? "hsl(var(--primary))" : "#555"} strokeWidth="6" />
    <circle cx="50" cy="50" r="12" fill={active ? "white" : "#555"} stroke={active ? "hsl(var(--primary))" : "#666"} strokeWidth="5" />
  </svg>
);

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-card border-t border-white/10 rounded-none">
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = pathname === path;
          return (
            <Link key={path} to={path} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
        {/* Pokédex tab */}
        <Link to="/pokedex" className={`nav-item ${pathname === "/pokedex" ? "active" : ""}`}>
          <PokeballIcon active={pathname === "/pokedex"} />
          <span className="text-[9px] font-medium">Pokédex</span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNav;
