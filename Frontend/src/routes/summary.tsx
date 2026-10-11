/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PartyPopper, Share2, Home } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Trip summary · Ecolens" }] }),
  component: SummaryPage,
});

function SummaryPage() {
  return (
    <MobileShell>
      <div className="px-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-center text-center">
          <div className="relative h-32 w-32">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="oklch(0.26 0.02 50)"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="var(--eco-green)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={276}
                strokeDashoffset={26}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-eco-green">94</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                EcoScore
              </div>
            </div>
          </div>
          <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold">
            Trip Complete <PartyPopper className="h-6 w-6 text-eco-orange" />
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            You breathed <b className="text-eco-blue">67% cleaner air</b> than the fastest route.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Duration" value="42 min" />
          <Stat label="Distance" value="12.4 km" />
          <Stat label="PM2.5 Avoided" value="430 µg" tone="text-eco-green" />
          <Stat label="CO₂ Saved" value="180 g" tone="text-eco-green" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-2xl bg-eco-orange py-3.5 text-sm font-semibold text-background">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <Link
            to="/map"
            className="flex items-center justify-center gap-2 rounded-2xl border border-eco-green/40 py-3.5 text-sm font-semibold text-eco-green"
          >
            <Home className="h-4 w-4" /> Done
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-xl font-bold ${tone || ""}`}>{value}</div>
    </div>
  );
}
