/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, Settings, Bell, ChevronRight, LogOut, Info, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { getCachedUser, type AuthUser } from "@/lib/api/auth";
import { logoutUser } from "@/lib/api/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Ecolens" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [pollutionAlerts, setPollutionAlerts] = useState(true);
  const [dailyReport, setDailyReport] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCachedUser());
    if (localStorage.getItem("theme") === "dark") {
      setDark(true);
      document.documentElement.classList.remove("light");
    } else {
      setDark(false);
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const signOut = async () => {
    await logoutUser();
    navigate({ to: "/auth/signin" });
  };

  // Display initials for the avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "JD";

  return (
    <MobileShell>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 lg:py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Profile</h1>

        {/* User card */}
        <div className="mt-6 flex items-center gap-4 rounded-3xl border border-border/80 bg-card p-6 shadow-md">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-eco-green/15 text-2xl font-bold text-eco-green">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-eco-green" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{user?.name ?? "Jane Doe"}</div>
            <div className="truncate text-xs text-muted-foreground">
              {user?.email ?? "jane@ecolens.net"}
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-eco-orange/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-eco-orange">
              Pro tier
            </div>
          </div>
        </div>

        <Section title="Preferences">
          <ToggleRow
            icon={dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            label="Dark theme"
            checked={dark}
            onChange={toggleTheme}
          />
          <LinkRow
            icon={<Settings className="h-4 w-4" />}
            label="Default route"
            value="Cleanest Air"
          />
          <LinkRow icon={<Settings className="h-4 w-4" />} label="Units" value="µg/m³" />
        </Section>

        <Section title="Notifications">
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Pollution alerts"
            checked={pollutionAlerts}
            onChange={() => setPollutionAlerts(!pollutionAlerts)}
          />
          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Daily exposure report"
            checked={dailyReport}
            onChange={() => setDailyReport(!dailyReport)}
          />
        </Section>

        <Section title="Account">
          <LinkRow icon={<User className="h-4 w-4" />} label="Edit profile" />
          <LinkRow icon={<Info className="h-4 w-4" />} label="About Ecolens" />
        </Section>

        <button
          onClick={signOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-eco-red/30 bg-eco-red/5 py-3 text-sm font-semibold text-eco-red"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>

        <div className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Ecolens v2.4.1 · SDG 11 · SDG 13
        </div>
      </div>
    </MobileShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </div>
  );
}

function LinkRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <button className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 hover:bg-muted/30">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {value && <span className="font-mono text-xs text-muted-foreground">{value}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <button
        onClick={onChange}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-eco-green" : "bg-muted")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform " +
            (checked ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
