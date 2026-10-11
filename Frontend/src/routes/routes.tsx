/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Clock, Wind, Cloud, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { cn } from "@/lib/utils";
import { generateRoutes, type RouteOption } from "@/lib/api/routes";

export const Route = createFileRoute("/routes")({
  head: () => ({ meta: [{ title: "Route options · Ecolens" }] }),
  component: RoutesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    olat: Number(search.olat ?? 0),
    olng: Number(search.olng ?? 0),
    dlat: Number(search.dlat ?? 0),
    dlng: Number(search.dlng ?? 0),
  }),
});

function RoutesPage() {
  const { olat, olng, dlat, dlng } = useSearch({ from: "/routes" });
  const [selected, setSelected] = useState("cleanest_air");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only call API if we have real coordinates
    const hasCoords = olat !== 0 && olng !== 0 && dlat !== 0 && dlng !== 0;
    if (!hasCoords) {
      setLoading(false);
      setError("No origin/destination provided. Go back to the map and search for a route.");
      return;
    }

    setLoading(true);
    generateRoutes({ lat: olat, lng: olng }, { lat: dlat, lng: dlng })
      .then((data) => {
        setRoutes(data);
        // Auto-select the recommended route
        const rec = data.find((r) => r.recommended);
        if (rec) setSelected(rec.type);
      })
      .catch((err) => {
        console.error("Route generation error:", err);
        setError("Could not generate routes. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [olat, olng, dlat, dlng]);

  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link
            to="/map"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            Choose your route
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        {/* Map preview */}
        <div className="mt-4 aspect-[5/3] overflow-hidden rounded-3xl border border-border map-bg relative">
          <svg viewBox="0 0 300 180" className="h-full w-full">
            <path
              d="M 20 150 Q 80 140 140 110 T 280 30"
              stroke="oklch(0.55 0.02 60)"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M 20 150 Q 90 120 160 90 T 280 30"
              stroke="var(--eco-green)"
              strokeWidth="4"
              fill="none"
              filter="drop-shadow(0 0 6px var(--eco-green))"
            />
            <path
              d="M 20 150 Q 60 100 130 80 T 280 30"
              stroke="var(--eco-blue)"
              strokeWidth="3"
              fill="none"
            />
          </svg>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-pulse"
              >
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-3 rounded bg-muted" />
                  <div className="h-3 rounded bg-muted" />
                  <div className="h-3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Route cards */}
        {!loading && routes.length > 0 && (
          <div className="mt-4 space-y-3">
            {routes.map((r) => {
              const active = selected === r.type;
              return (
                <button
                  key={r.route_id ?? r.type}
                  onClick={() => setSelected(r.type)}
                  className={cn(
                    "w-full rounded-2xl border bg-card p-4 text-left transition-colors",
                    active ? "border-eco-green glow-green" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{r.label}</span>
                      {r.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-eco-green/15 px-2 py-0.5 font-mono text-[10px] uppercase text-eco-green">
                          <CheckCircle2 className="h-3 w-3" /> PPO Pick
                        </span>
                      )}
                      {r.degradation_warning && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-eco-orange/15 px-2 py-0.5 font-mono text-[10px] uppercase text-eco-orange">
                          <AlertTriangle className="h-3 w-3" /> Warning
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 font-mono text-xs font-bold",
                        r.ecoscore >= 70
                          ? "bg-eco-green/15 text-eco-green"
                          : "bg-eco-orange/15 text-eco-orange",
                      )}
                    >
                      {r.ecoscore}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {r.duration_min} min
                    </div>
                    <div className="flex items-center gap-1">
                      <Wind className="h-3 w-3" /> {r.pm25_exposure.toFixed(0)} µg
                    </div>
                    <div className="flex items-center gap-1">
                      <Cloud className="h-3 w-3" /> {r.co2_grams.toFixed(0)} g
                    </div>
                  </div>
                  {(r.ecoscore_t10 || r.ecoscore_t20 || r.ecoscore_t30) && (
                    <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      {[
                        r.ecoscore_now ?? r.ecoscore,
                        r.ecoscore_t10,
                        r.ecoscore_t20,
                        r.ecoscore_t30,
                      ].map((score, index) => (
                        <span
                          key={index}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            (score ?? 0) >= 70
                              ? "bg-eco-green/70"
                              : (score ?? 0) >= 50
                                ? "bg-eco-orange/70"
                                : "bg-eco-red/70",
                          )}
                          title={`${index === 0 ? "Now" : `T+${index * 10}`}: ${score}`}
                        />
                      ))}
                      <span className="ml-1 shrink-0">30m</span>
                    </div>
                  )}
                  {r.forecast_note && (
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      {r.forecast_note}
                    </p>
                  )}
                  {r.degradation_warning && (
                    <p className="mt-1 text-[11px] leading-snug text-eco-orange">
                      {r.degradation_warning}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Start navigation CTA */}
        {!loading && routes.length > 0 && (
          <Link
            to="/summary"
            search={{ type: selected }}
            className="mt-5 block rounded-2xl bg-eco-orange py-3.5 text-center text-base font-semibold text-background"
          >
            Start Navigation
          </Link>
        )}
      </div>
    </MobileShell>
  );
}
