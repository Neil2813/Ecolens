/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bike,
  Footprints,
  Car,
  SlidersHorizontal,
  Loader2,
  History,
} from "lucide-react";
import { useState, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { cn } from "@/lib/utils";
import { getTripHistory, type TripRecord } from "@/lib/api/trips";

export const Route = createFileRoute("/dashboard/history")({
  head: () => ({ meta: [{ title: "Trip History · Ecolens" }] }),
  component: HistoryPage,
});

const filters = ["All", "This Week", "This Month"] as const;

/** Map a backend TripRecord to the shape the UI expects */
function mapTrip(t: TripRecord) {
  const at = t.started_at ? new Date(t.started_at) : null;
  const status: "safe" | "moderate" | "high" =
    (t.ecoscore ?? 0) >= 70 ? "safe" : (t.ecoscore ?? 0) >= 45 ? "moderate" : "high";
  return {
    id: t.id,
    date: at ? at.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
    time: at ? at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
    name: `${t.route_type === "cleanest_air" ? "Cleanest Air" : t.route_type === "lowest_carbon" ? "Lowest Carbon" : "Fastest"} Route`,
    mode: "bike" as "bike" | "walk" | "car",
    duration: t.duration_min != null ? `${t.duration_min} min` : "—",
    pm25Avoided: t.pm25_avoided ?? 0,
    co2: t.co2_grams ?? 0,
    ecoscore: t.ecoscore ?? 0,
    status,
  };
}

function HistoryPage() {
  const [active, setActive] = useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<ReturnType<typeof mapTrip>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTripHistory(1, active === "All" ? "all" : active === "This Week" ? "week" : "month")
      .then((res) => setTrips(res.trips.map(mapTrip)))
      .catch((err) => {
        console.error("Trip history API error:", err);
        setError("Could not load trip history.");
      })
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <MobileShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 lg:py-10">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            Trip History
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                className={cn(
                  "rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                  active === f
                    ? "border-eco-orange bg-eco-orange/15 text-eco-orange"
                    : "border-border text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading && trips.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading trips…</p>
            </div>
          )}
          {!loading && error && (
            <div className="rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
              {error}
            </div>
          )}
          {!loading && !error && trips.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <History className="h-10 w-10 opacity-30" />
              <p className="text-sm">No trips recorded yet.</p>
              <p className="text-xs">Complete a navigation session to see your history here.</p>
            </div>
          )}
          {trips.map((t) => {
            const Icon = t.mode === "bike" ? Bike : t.mode === "walk" ? Footprints : Car;
            const tone =
              t.status === "safe"
                ? "border-l-eco-green"
                : t.status === "moderate"
                  ? "border-l-eco-orange"
                  : "border-l-eco-red";
            const scoreColor =
              t.status === "safe"
                ? "text-eco-green"
                : t.status === "moderate"
                  ? "text-eco-orange"
                  : "text-eco-red";
            const iconBg =
              t.status === "safe"
                ? "bg-eco-green/10 text-eco-green"
                : t.status === "moderate"
                  ? "bg-eco-orange/10 text-eco-orange"
                  : "bg-eco-red/10 text-eco-red";
            return (
              <Link
                key={t.id}
                to="/dashboard/history/$tripId"
                params={{ tripId: t.id }}
                className={cn(
                  "block rounded-2xl border border-border border-l-4 bg-card p-4",
                  tone,
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {t.date} · {t.time}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full",
                          iconBg,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="truncate text-sm font-semibold">{t.name}</div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono text-sm font-bold",
                      scoreColor,
                      t.status === "safe"
                        ? "border-eco-green"
                        : t.status === "moderate"
                          ? "border-eco-orange"
                          : "border-eco-red",
                    )}
                  >
                    {t.ecoscore}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{t.duration}</span>
                  <span className={scoreColor}>
                    {t.pm25Avoided >= 0
                      ? `↓ ${t.pm25Avoided.toFixed(0)}`
                      : `↑ ${Math.abs(t.pm25Avoided).toFixed(0)}`}{" "}
                    µg
                  </span>
                  <span className="text-muted-foreground">
                    CO₂ {typeof t.co2 === "number" ? t.co2.toFixed(0) : t.co2}g
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {trips.length > 0 && (
          <div className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            End of History
          </div>
        )}
      </div>
    </MobileShell>
  );
}
