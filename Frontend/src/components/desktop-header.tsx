/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Map,
  MessageSquare,
  LayoutDashboard,
  Headphones,
  Calendar,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { EcoLogo } from "./eco-logo";
import { cn } from "@/lib/utils";
import { getCachedUser } from "@/lib/api/auth";

const navItems = [
  { to: "/map", label: "Live Map", icon: Map },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/travel-planner", label: "Travel Planner", icon: Calendar },
  { to: "/audio-tour", label: "Audio Tour", icon: Headphones },
  { to: "/assistant", label: "AI Assistant", icon: MessageSquare },
] as const;

export function DesktopHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(true);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    setUser(getCachedUser());
    const isDark = localStorage.getItem("theme") !== "light";
    setDark(isDark);
    if (isDark) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "JD";

  return (
    <header className="sticky top-0 z-40 hidden md:block w-full border-b border-border/60 bg-background/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-8 lg:px-12">
        {/* Brand */}
        <div className="flex items-center">
          <Link to="/map" className="group flex items-center gap-3 transition-transform active:scale-95">
            <EcoLogo size={42} className="transition-transform duration-200 group-hover:scale-105" />
            <span className="font-sans text-xl font-bold tracking-tight text-foreground">
              Ecolens
            </span>
          </Link>
        </div>

        {/* Center Navigation Pills - Generous breathing room */}
        <nav className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 p-2 backdrop-blur-xl shadow-sm">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls - Theme & Profile */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95 shadow-xs"
            title={dark ? "Switch to Light mode" : "Switch to Dark mode"}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-slate-700" />}
          </button>

          {/* Profile Badge */}
          <Link
            to="/profile"
            className="group flex items-center gap-3 rounded-full border border-border/80 bg-card/70 p-1.5 pr-4 hover:border-primary/40 transition-all shadow-xs"
            title="User Profile"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <span className="text-sm font-semibold text-foreground max-w-[120px] truncate">
              {user?.name ? user.name.split(" ")[0] : "Account"}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
