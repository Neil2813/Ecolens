/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Wind, Loader2, AlertTriangle } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/forecast")({
  head: () => ({ meta: [{ title: "Forecast · Ecolens" }] }),
  component: ForecastPage,
});

function ForecastPage() {
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<DashboardSummary["forecast"]>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then((data) => setForecast(data.forecast ?? null))
      .catch((err) => {
        console.error("Forecast API error:", err);
        setError("Could not load forecast data.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Build a single-bar display from predicted_pm25
  const predictedPm25 = forecast?.predicted_pm25 ?? 0;
  const barColor =
    predictedPm25 < 60 ? "bg-eco-green" : predictedPm25 < 120 ? "bg-eco-orange" : "bg-eco-red";
  const barHeight = `${Math.min(100, (predictedPm25 / 200) * 100)}%`;

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
          <h1 className="text-xl font-bold flex items-center gap-2">
            Tomorrow&apos;s Forecast
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Predicted PM2.5 chart */}
        <div className="mt-5 rounded-3xl border border-border bg-card p-5">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Predicted PM2.5 for tomorrow
          </div>

          {loading ? (
            <div className="mt-4 flex h-44 items-end gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm animate-pulse bg-muted"
                    style={{ height: `${30 + i * 10}%` }}
                  />
                </div>
              ))}
            </div>
          ) : forecast ? (
            <>
              <div className="mt-4 flex h-44 items-end gap-2">
                {/* Single bar representing predicted PM2.5 vs thresholds */}
                <div className="flex flex-1 flex-col items-start gap-2 h-full">
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-sm ${barColor} transition-all duration-700`}
                      style={{ height: barHeight }}
                    />
                  </div>
                </div>
                {/* Reference bars */}
                <div className="flex flex-col gap-1 font-mono text-[9px] text-muted-foreground justify-end h-full pb-1">
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-4 bg-eco-green" /> WHO Safe (&lt;60)
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-4 bg-eco-orange" /> Moderate (&lt;120)
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-4 bg-eco-red" /> High (120+)
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>Tomorrow</span>
                <span
                  className={
                    predictedPm25 < 60
                      ? "text-eco-green"
                      : predictedPm25 < 120
                        ? "text-eco-orange"
                        : "text-eco-red"
                  }
                >
                  {predictedPm25.toFixed(1)} µg/m³ predicted
                </span>
              </div>
              {forecast.reason && (
                <p className="mt-2 text-xs text-muted-foreground">{forecast.reason}</p>
              )}
            </>
          ) : !error ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No ML forecast available yet. The model runs after you complete your first trip.
            </p>
          ) : null}
        </div>

        {/* Best departure window */}
        {(loading || forecast) && (
          <div className="mt-4 rounded-3xl border border-eco-green/40 bg-eco-green/5 p-5">
            <div className="flex items-center gap-2 text-eco-green">
              <Clock className="h-5 w-5" />
              <h3 className="font-semibold">Best Departure Window</h3>
            </div>
            {loading ? (
              <div className="mt-3 space-y-2">
                <div className="h-8 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded bg-muted" />
              </div>
            ) : forecast ? (
              <>
                <div className="mt-3 text-2xl font-bold">{forecast.recommended_departure}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Recommended route:{" "}
                  <span className="text-eco-cream font-medium">{forecast.recommended_route}</span>
                  {forecast.reason && ` — ${forecast.reason}`}
                </p>
              </>
            ) : null}
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background">
              <Wind className="h-4 w-4" /> Set departure reminder
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
