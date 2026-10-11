/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { Link, useRouterState } from "@tanstack/react-router";
import { Map, MessageSquare, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/assistant", label: "Assistant", icon: MessageSquare },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-3 inset-x-3 z-45 md:hidden">
      <div className="mx-auto max-w-md rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/25">
        <div className="flex items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90",
                  active
                    ? "bg-primary/15 text-primary font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-primary animate-in fade-in zoom-in duration-300" />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    active ? "scale-110 text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-[10px] tracking-tight transition-colors",
                    active ? "font-bold text-primary" : "font-medium text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
