/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle, Leaf } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/alert/$id")({
  head: () => ({ meta: [{ title: "Alert · Ecolens" }] }),
  component: AlertPage,
});

function AlertPage() {
  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link
          to="/map"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-eco-orange/15 text-eco-orange">
            <AlertTriangle className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-xl font-bold">High NO₂ Detected</h1>
          <p className="font-mono text-[11px] text-muted-foreground">
            Sardar Patel Road · 2 min ago
          </p>
        </div>

        <p className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          NO₂ levels are currently <b className="text-eco-orange">3.2× above safe limits</b> on this
          segment due to vehicle congestion. Extended exposure may cause respiratory irritation.
        </p>

        <div className="mt-4 rounded-3xl border border-eco-green/40 bg-eco-green/5 p-5">
          <div className="flex items-center gap-2 text-eco-green">
            <Leaf className="h-5 w-5" />
            <h3 className="font-semibold">Suggested Action</h3>
          </div>
          <p className="mt-2 text-sm">
            Take Nungambakkam High Road instead — <b className="text-eco-green">68% lower NO₂</b>
          </p>
        </div>

        <Link
          to="/routes"
          search={{ olat: 0, olng: 0, dlat: 0, dlng: 0 }}
          className="mt-4 block rounded-2xl bg-eco-orange py-3.5 text-center text-base font-semibold text-background"
        >
          Reroute now
        </Link>
        <Link to="/map" className="mt-2 block py-3 text-center text-xs text-muted-foreground">
          Dismiss
        </Link>
      </div>
    </MobileShell>
  );
}
