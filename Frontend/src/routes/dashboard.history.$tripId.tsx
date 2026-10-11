/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Share2, PartyPopper, Loader2, AlertTriangle } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getTripDetail, type TripRecord } from "@/lib/api/trips";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/history/$tripId")({
  head: () => ({ meta: [{ title: "Trip Detail · Ecolens" }] }),
  component: TripDetailPage,
  notFoundComponent: () => (
    <MobileShell>
      <div className="p-8 text-center text-muted-foreground">Trip not found.</div>
    </MobileShell>
  ),
});

function TripDetailPage() {
  const { tripId } = useParams({ from: "/dashboard/history/$tripId" });
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTripDetail(tripId)
      .then(setTrip)
      .catch((err) => {
        console.error("Trip detail API error:", err);
        setError(err?.status === 404 ? "Trip not found." : "Could not load trip details.");
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  // ── Derived display values ─────────────────────────────────────────────────
  const routeLabel =
    trip?.route_type === "cleanest_air"
      ? "Cleanest Air"
      : trip?.route_type === "lowest_carbon"
        ? "Lowest Carbon"
        : "Fastest";

  const startedAt = trip?.started_at
    ? new Date(trip.started_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

  const pm25Reduction = trip?.vs_fastest?.pm25_reduction_percent ?? null;

  return (
    <MobileShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 lg:py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/history"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              {loading ? (
                <>
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted" />
                </>
              ) : (
                <>
                  <div className="text-base font-bold">
                    {startedAt} — {routeLabel} Route
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    Trip #{tripId.slice(0, 8)}
                  </div>
                </>
              )}
            </div>
          </div>
          <button className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading trip details…</p>
          </div>
        )}

        {trip && (
          <>
            {/* Map preview (polyline if available) */}
            <div className="mt-4 aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-card map-bg relative">
              <svg viewBox="0 0 300 220" className="h-full w-full">
                {trip.polyline && trip.polyline.length >= 2 ? (
                  <polyline
                    points={trip.polyline
                      .map(([lat, lng]) => {
                        // Normalise to SVG viewport 0-300 x 0-220
                        const lats = trip.polyline!.map((p) => p[0]);
                        const lngs = trip.polyline!.map((p) => p[1]);
                        const minLat = Math.min(...lats),
                          maxLat = Math.max(...lats);
                        const minLng = Math.min(...lngs),
                          maxLng = Math.max(...lngs);
                        const x =
                          maxLng === minLng ? 150 : ((lng - minLng) / (maxLng - minLng)) * 260 + 20;
                        const y =
                          maxLat === minLat
                            ? 110
                            : 200 - ((lat - minLat) / (maxLat - minLat)) * 180 - 10;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    stroke="var(--eco-orange)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                ) : (
                  // Fallback static path
                  <path
                    d="M 20 200 L 60 160 L 140 130 L 200 90 L 260 50"
                    stroke="var(--eco-orange)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    filter="drop-shadow(0 0 6px var(--eco-orange))"
                  />
                )}
                <circle
                  cx={
                    trip.polyline
                      ? (() => {
                          const lngs = trip.polyline.map((p) => p[1]);
                          const minLng = Math.min(...lngs),
                            maxLng = Math.max(...lngs);
                          return maxLng === minLng
                            ? 150
                            : ((trip.polyline[0][1] - minLng) / (maxLng - minLng)) * 260 + 20;
                        })()
                      : 20
                  }
                  cy={
                    trip.polyline
                      ? (() => {
                          const lats = trip.polyline.map((p) => p[0]);
                          const minLat = Math.min(...lats),
                            maxLat = Math.max(...lats);
                          return maxLat === minLat
                            ? 110
                            : 200 - ((trip.polyline[0][0] - minLat) / (maxLat - minLat)) * 180 - 10;
                        })()
                      : 200
                  }
                  r="6"
                  fill="var(--eco-orange)"
                />
              </svg>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-eco-green animate-pulse" />
                Trip complete
              </div>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat
                label="Duration"
                value={trip.duration_min != null ? `${trip.duration_min} min` : "–"}
              />
              <Stat
                label="Distance"
                value={trip.distance_km != null ? `${trip.distance_km.toFixed(1)} km` : "–"}
              />
              <Stat
                label="PM2.5 Inhaled"
                value={trip.pm25_inhaled != null ? `${trip.pm25_inhaled.toFixed(1)} µg` : "–"}
                tone="eco-cream"
              />
              <Stat
                label="CO₂ Emitted"
                value={trip.co2_grams != null ? `${trip.co2_grams.toFixed(0)} g` : "–"}
                tone="eco-green"
              />
              <Stat
                label="EcoScore"
                value={trip.ecoscore != null ? `${trip.ecoscore}/100` : "–"}
                tone="eco-green"
                big
              />
              <Stat
                label="PM2.5 Avoided"
                value={trip.pm25_avoided != null ? `${trip.pm25_avoided.toFixed(0)} µg` : "–"}
                tone="eco-blue"
              />
            </div>

            {/* Comparison bar */}
            {trip.vs_fastest && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <div className="text-sm">
                  This route vs Fastest Route — you avoided{" "}
                  <span className="font-bold text-eco-blue">
                    {pm25Reduction != null
                      ? `${pm25Reduction}% more PM2.5`
                      : `${trip.pm25_avoided?.toFixed(0) ?? 0} µg PM2.5`}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-eco-blue"
                    style={{
                      width: pm25Reduction != null ? `${100 - pm25Reduction}%` : "33%",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>This Route</span>
                  <span>Fastest (baseline)</span>
                </div>
              </div>
            )}

            {/* Celebration */}
            <div className="mt-4 rounded-3xl border border-eco-green/40 bg-eco-green/5 p-5">
              <div className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-eco-green" />
                <h3 className="font-semibold">Trip Complete</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {(trip.ecoscore ?? 0) >= 80
                  ? "Excellent navigation! You maintained a high EcoScore by taking the green corridor, significantly reducing your exposure to urban pollutants."
                  : (trip.ecoscore ?? 0) >= 60
                    ? "Good trip! You made a conscious effort to reduce your exposure. Keep choosing eco-friendly routes."
                    : "Every trip counts. Try the Cleanest Air route next time to improve your EcoScore."}
              </p>
              <button className="mt-4 w-full rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background">
                View Badge Progress
              </button>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Stat({
  label,
  value,
  tone,
  big = false,
}: {
  label: string;
  value: string;
  tone?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 font-bold ${big ? "text-3xl" : "text-xl"} ${
          tone === "eco-green"
            ? "text-eco-green"
            : tone === "eco-blue"
              ? "text-eco-blue"
              : tone === "eco-cream"
                ? "text-eco-cream"
                : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
