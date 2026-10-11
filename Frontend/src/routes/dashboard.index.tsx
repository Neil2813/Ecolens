/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Bike,
  Shield,
  Trees,
  History,
  Award,
  Loader2,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";
import { useState, useEffect } from "react";
import { isDemo, apiFetch } from "@/lib/api/client";
import { getCachedUser } from "@/lib/api/auth";
import { AirSafetyHub } from "@/components/air-safety-hub";

interface AQIData {
  value: number;
  pm25: number;
  status: "Safe" | "Moderate" | "Poor";
  city: string;
}

const CITY_COORDS: Record<string, [number, number]> = {
  bengaluru: [77.5946, 12.9716],
  chennai: [80.2707, 13.0827],
  mumbai: [72.8777, 19.076],
  "new delhi": [77.209, 28.6139],
  delhi: [77.209, 28.6139],
  hyderabad: [78.4867, 17.385],
  kolkata: [88.3639, 22.5726],
  ahmedabad: [72.5714, 23.0225],
  pune: [73.8567, 18.5204],
};

async function geocodeCity(cityName: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
      }
    }
  } catch (err) {
    console.warn("Geocoding city failed:", err);
  }
  return null;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12`,
    );
    if (res.ok) {
      const data = await res.json();
      const address = data.address || {};
      const placeName =
        address.city ||
        address.town ||
        address.suburb ||
        address.neighbourhood ||
        address.village ||
        address.county ||
        address.state ||
        "Current Location";
      return placeName;
    }
  } catch (err) {
    console.warn("Reverse geocoding error:", err);
  }
  return "Current Location";
}

async function fetchDemoAQI(lat: number, lon: number): Promise<{ aqi: number; pm25: number }> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=european_aqi,us_aqi,pm2_5&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch demo AQI");
  const data = await res.json();
  const hourly = data.hourly || {};
  const aqiList = hourly.us_aqi || hourly.european_aqi || [];
  const pm25List = hourly.pm2_5 || [];

  let aqi = 0;
  for (let i = aqiList.length - 1; i >= 0; i--) {
    if (aqiList[i] !== null && aqiList[i] !== undefined) {
      aqi = Math.round(aqiList[i]);
      break;
    }
  }
  let pm25 = 0;
  for (let i = pm25List.length - 1; i >= 0; i--) {
    if (pm25List[i] !== null && pm25List[i] !== undefined) {
      pm25 = pm25List[i];
      break;
    }
  }
  if (!aqi) {
    aqi = Math.round(pm25 * 2.0);
  }
  return { aqi, pm25 };
}

async function fetchRealAQI(lat: number, lon: number): Promise<{ aqi: number; pm25: number }> {
  interface AirQualityResponse {
    aqi?: number;
    aqi_us?: number;
    aqi_eu?: number;
    pm25?: number;
  }
  const data = await apiFetch<AirQualityResponse>(`/api/env/air-quality?lat=${lat}&lon=${lon}`);
  const pm25 = data.pm25 ?? 0;
  const aqiVal = data.aqi ?? data.aqi_us ?? data.aqi_eu ?? Math.round(pm25 * 2.0);
  return { aqi: aqiVal, pm25 };
}

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard · Ecolens" }] }),
  component: DashboardPage,
});

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonLine({ w = "w-24" }: { w?: string }) {
  return <span className={`inline-block h-4 animate-pulse rounded bg-muted ${w}`} />;
}
function SkeletonBlock({ h = "h-6", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${h} ${w}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aqiLoading, setAqiLoading] = useState(true);
  const [aqiData, setAqiData] = useState<AQIData | null>(null);

  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [selectedScoreIdx, setSelectedScoreIdx] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number }>({
    lat: 28.6139,
    lon: 77.209,
  });

  useEffect(() => {
    let active = true;

    async function fetchData(latVal: number, lonVal: number, cityVal: string, saveToCache: boolean = false) {
      if (!active) return;
      setCurrentCoords({ lat: latVal, lon: lonVal });

      const aqiPromise = isDemo() ? fetchDemoAQI(latVal, lonVal) : fetchRealAQI(latVal, lonVal);
      const summaryPromise = getDashboardSummary(undefined, latVal, lonVal);

      try {
        const resData = await aqiPromise;
        const status = resData.aqi <= 50 ? "Safe" : resData.aqi <= 100 ? "Moderate" : "Poor";
        if (active) {
          setAqiData({ value: resData.aqi, pm25: resData.pm25, status, city: cityVal });
          setAqiLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch current location AQI:", err);
        if (active) {
          setAqiData({ value: 45, pm25: 15, status: "Safe", city: cityVal });
          setAqiLoading(false);
        }
      }

      try {
        const summaryData = await summaryPromise;
        if (active) {
          setSummary(summaryData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Dashboard API error:", err);
        if (active) {
          setError("Could not load dashboard data. Please sign in.");
          setLoading(false);
        }
      }

      if (saveToCache) {
        localStorage.setItem("ecolens:last_lat", String(latVal));
        localStorage.setItem("ecolens:last_lon", String(lonVal));
        localStorage.setItem("ecolens:last_city", cityVal);
      }
    }

    async function loadLocationAndAQI() {
      const cachedLat = localStorage.getItem("ecolens:last_lat");
      const cachedLon = localStorage.getItem("ecolens:last_lon");
      const cachedCity = localStorage.getItem("ecolens:last_city");

      let lat = 12.9716;
      let lon = 77.5946;
      let city = "Bengaluru";
      let hasCache = false;

      if (cachedLat && cachedLon && cachedCity) {
        lat = parseFloat(cachedLat);
        lon = parseFloat(cachedLon);
        city = cachedCity;
        hasCache = true;
        fetchData(lat, lon, city, false);
      }

      const getCoordsFromProfile = async () => {
        const user = getCachedUser();
        if (user && user.city) {
          const matched = CITY_COORDS[user.city.toLowerCase().trim()];
          if (matched) {
            return { lat: matched[1], lon: matched[0], name: user.city };
          }
          const coords = await geocodeCity(user.city);
          if (coords) {
            return { lat: coords[1], lon: coords[0], name: user.city };
          }
          return { lat: 12.9716, lon: 77.5946, name: user.city };
        }
        return null;
      };

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true,
              maximumAge: 5000,
            });
          }
        });

        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        localStorage.setItem("ecolens:last_lat", String(newLat));
        localStorage.setItem("ecolens:last_lon", String(newLon));

        const latDiff = Math.abs(newLat - lat);
        const lonDiff = Math.abs(newLon - lon);

        if (!hasCache || latDiff > 0.005 || lonDiff > 0.005) {
          const newCity = await reverseGeocode(newLat, newLon);
          fetchData(newLat, newLon, newCity, true);
        }
      } catch (err) {
        console.warn("Geolocation background fetch failed/timed out:", err);
        if (!hasCache) {
          const profileLoc = await getCoordsFromProfile();
          if (profileLoc) {
            fetchData(profileLoc.lat, profileLoc.lon, profileLoc.name, true);
          } else {
            fetchData(12.9716, 77.5946, "Bengaluru", true);
          }
        }
      }
    }

    loadLocationAndAQI();

    return () => {
      active = false;
    };
  }, []);

  // Derived values — only from API, null when no data
  const hasData =
    summary != null &&
    (summary.pm25_inhaled > 0 ||
      summary.pm25_avoided > 0 ||
      summary.co2_grams > 0 ||
      summary.ecoscore > 0 ||
      (summary.trips_today ?? 0) > 0);
  const pm25 = summary?.pm25_inhaled ?? null;
  const avoided = summary?.pm25_avoided ?? null;
  const co2 = summary?.co2_grams ?? null;
  const ecoscore = summary?.ecoscore ?? null;
  const co2VsAvg = summary?.co2_vs_avg_percent;
  const ecoscoreDelta = summary?.ecoscore_delta;
  const ecoscoreTrend = summary?.ecoscore_trend ?? [];
  const weeklyPollution = summary?.weekly_pollution ?? [];
  const forecast = summary?.forecast ?? null;
  const badges = summary?.badges ?? [];

  // Fallbacks using current location AQI / PM2.5 values if no user trips exist
  const displayEcoscore =
    ecoscore != null && ecoscore > 0
      ? ecoscore
      : aqiData
        ? Math.max(0, Math.min(100, Math.round(100 - aqiData.pm25 / 2)))
        : null;

  const displayPm25 = pm25 != null && pm25 > 0 ? pm25 : aqiData ? aqiData.pm25 : null;

  // Ring fill: scale ecoscore (0-100) to ring fill percent
  const ringPercent = displayEcoscore ?? 0;

  return (
    <MobileShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Environmental Stewardship
            </div>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Exposure Dashboard
              {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </h1>
          </div>
          {aqiLoading ? (
            <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground shadow-xs">
              <span className="h-2 w-2 rounded-full bg-muted animate-pulse" />
              Loading AQI…
            </span>
          ) : aqiData ? (
            <span
              className={`flex items-center gap-2 rounded-full border ${
                aqiData.status === "Safe"
                  ? "border-eco-green/40 bg-eco-green/10 text-eco-green"
                  : aqiData.status === "Moderate"
                    ? "border-eco-orange/40 bg-eco-orange/10 text-eco-orange"
                    : "border-eco-red/40 bg-eco-red/10 text-eco-red"
              } px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider shadow-xs`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  aqiData.status === "Safe"
                    ? "bg-eco-green"
                    : aqiData.status === "Moderate"
                      ? "bg-eco-orange"
                      : "bg-eco-red"
                }`}
              />
              AQI {aqiData.value} · {aqiData.status} ({aqiData.city})
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full border border-eco-green/40 bg-eco-green/10 px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest text-eco-green shadow-xs">
              <span className="h-2 w-2 rounded-full bg-eco-green" />
              AQI Safe
            </span>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Track 01 Air Safety Defense Hub (Stubble Burning, Indoor Air Infiltration, School Safety) */}
        <div className="mt-6">
          <AirSafetyHub
            lat={currentCoords.lat}
            lon={currentCoords.lon}
            pm25={aqiData?.pm25 ?? 52}
            aqi={aqiData?.value ?? 130}
            cityName={aqiData?.city ?? "Current Location"}
          />
        </div>

        {/* Responsive Grid Layout */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Today's exposure */}
            <Link
              to="/dashboard/exposure"
              className="group block rounded-3xl border border-border/80 bg-card p-6 shadow-md hover:border-primary/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-eco-green animate-pulse" />
                    <h2 className="text-xl font-bold text-foreground">Today&apos;s Exposure</h2>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Cumulative PM2.5 Intake Dosimetry
                  </p>

                  <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-eco-green/10 border border-eco-green/20 px-3.5 py-2.5 text-xs text-eco-green font-medium">
                    <Shield className="h-4 w-4 shrink-0" />
                    {loading ? (
                      <SkeletonLine w="w-40" />
                    ) : hasData ? (
                      avoided != null && avoided > 0 ? (
                        <span>
                          Avoided <b className="font-bold">{avoided.toFixed(1)} µg</b> via Ecolens route
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No PM2.5 avoided today</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">No trips recorded yet</span>
                    )}
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/50 px-3.5 py-2 font-mono text-xs text-muted-foreground">
                    {loading ? (
                      <SkeletonLine w="w-32" />
                    ) : hasData && co2 != null ? (
                      <>
                        <span className="text-foreground font-semibold">CO₂ {co2.toFixed(1)}g</span>
                        {co2VsAvg != null && (
                          <>
                            {" · "}
                            <span className={co2VsAvg < 0 ? "text-eco-green font-semibold" : "text-eco-orange"}>
                              {co2VsAvg < 0
                                ? `${Math.abs(co2VsAvg)}% below city avg`
                                : `${co2VsAvg}% above city avg`}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span>CO₂ &mdash; (No trips)</span>
                    )}
                  </div>
                </div>

                {/* EcoScore ring */}
                <CircularProgress
                  value={ringPercent}
                  label={
                    loading && aqiLoading
                      ? "–"
                      : displayPm25 != null
                        ? `${displayPm25.toFixed(0)}`
                        : "–"
                  }
                  sublabel="µg PM2.5"
                />
              </div>
            </Link>

            {/* This week's pollution chart */}
            <Card className="shadow-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-foreground">This Week&apos;s Pollution Exposure</h3>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Daily Ambient vs Inhaled
                </span>
              </div>
              {loading ? (
                <div className="mt-5 flex items-end justify-between gap-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end">
                        <div
                          className="w-full rounded-t-lg animate-pulse bg-muted"
                          style={{ height: `${30 + Math.random() * 50}%` }}
                        />
                      </div>
                      <SkeletonLine w="w-4" />
                    </div>
                  ))}
                </div>
              ) : weeklyPollution.length > 0 ? (
                <div className="mt-5 flex flex-col gap-3">
                  <div className="flex items-end justify-between gap-2 sm:gap-3">
                    {weeklyPollution.map((d, idx) => (
                      <button
                        type="button"
                        key={`${d.day}-${idx}`}
                        onClick={() => setSelectedBar(selectedBar === idx ? null : idx)}
                        className="flex flex-1 flex-col items-center gap-2 cursor-pointer outline-none group bg-transparent border-0 p-0 animate-in fade-in duration-200"
                      >
                        <div className="flex h-28 w-full items-end">
                          <div
                            className={
                              "w-full rounded-t-lg transition-all duration-200 " +
                              (selectedBar === idx
                                ? "ring-2 ring-foreground scale-x-105 "
                                : "group-hover:opacity-85 ") +
                              (d.empty
                                ? "bg-muted"
                                : d.status === "safe"
                                  ? "bg-eco-green"
                                  : d.status === "moderate"
                                    ? "bg-eco-orange"
                                    : "bg-eco-red")
                            }
                            style={{
                              height: d.empty
                                ? "4%"
                                : `${Math.max(6, Math.min(100, (d.level / 120) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                          {d.day}
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedBar !== null && weeklyPollution[selectedBar] && (
                    <div className="mt-3 rounded-2xl bg-card border border-border p-3.5 text-center animate-in slide-in-from-bottom-2 duration-200 shadow-sm">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {weeklyPollution[selectedBar].day}&apos;s Pollution Exposure
                      </div>
                      <div className="mt-1 text-sm font-bold text-foreground">
                        {weeklyPollution[selectedBar].level.toFixed(1)} µg PM2.5
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                          {weeklyPollution[selectedBar].status.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-normal">
                        {weeklyPollution[selectedBar].is_ambient
                          ? "Baseline ambient background city exposure."
                          : "Calculated based on your recorded trips."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No pollution data yet — complete a trip to see your weekly trend.
                </p>
              )}
            </Card>

            {/* Quick action links */}
            <div className="grid grid-cols-2 gap-4 pb-2">
              <Link
                to="/dashboard/history"
                className="group rounded-3xl border border-border/80 bg-card p-5 hover:border-eco-orange/50 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-eco-orange/15 text-eco-orange mb-3 group-hover:scale-105 transition-transform">
                  <History className="h-5 w-5" />
                </div>
                <div className="font-bold text-foreground">Trip History</div>
                <div className="text-xs text-muted-foreground mt-0.5">View all commutes & savings</div>
              </Link>
              <Link
                to="/dashboard/exposure"
                className="group rounded-3xl border border-border/80 bg-card p-5 hover:border-eco-green/50 transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-eco-green/15 text-eco-green mb-3 group-hover:scale-105 transition-transform">
                  <Award className="h-5 w-5" />
                </div>
                <div className="font-bold text-foreground">Pollutant Breakdown</div>
                <div className="text-xs text-muted-foreground mt-0.5">PM2.5, NO₂, CO₂ metrics</div>
              </Link>
            </div>
          </div>

          {/* Side Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Tomorrow's risk card */}
            {(loading || forecast) && (
              <Link
                to="/dashboard/forecast"
                className="group block rounded-3xl border border-eco-orange/40 bg-eco-orange/5 p-6 shadow-md hover:border-eco-orange/70 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-eco-orange">
                    <TrendingUp className="h-5 w-5" />
                    <h3 className="font-bold text-base">Tomorrow&apos;s Risk Forecast</h3>
                  </div>
                  <span className="rounded-full bg-eco-orange/15 border border-eco-orange/30 px-2 py-0.5 font-mono text-[9px] uppercase font-bold text-eco-orange">
                    Predictive
                  </span>
                </div>
                {loading ? (
                  <div className="mt-3 space-y-2">
                    <SkeletonBlock h="h-4" w="w-3/4" />
                    <SkeletonBlock h="h-12" />
                  </div>
                ) : forecast ? (
                  <>
                    <p className="mt-3 text-sm leading-relaxed text-foreground">
                      Your usual commute route has{" "}
                      <b className="text-eco-orange">
                        {forecast.pct_higher != null
                          ? `${forecast.pct_higher}% higher PM2.5`
                          : `${forecast.risk_level} pollution risk`}
                      </b>{" "}
                      {forecast.reason
                        ? `due to ${forecast.reason}`
                        : "tomorrow — plan your commute early."}
                    </p>
                    <div className="mt-4 rounded-2xl border border-border/80 bg-background/80 p-3.5 backdrop-blur-xs">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                        Recommended Departure
                      </div>
                      <div className="mt-1 text-sm font-bold text-foreground">
                        {forecast.recommended_departure} via {forecast.recommended_route}
                      </div>
                    </div>
                  </>
                ) : null}
                <div className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-eco-orange group-hover:translate-x-0.5 transition-transform">
                  See full hourly forecast <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            )}

            {/* EcoScore Progress Card */}
            <Card className="shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-foreground">EcoScore Progress</h3>
                  <p className="mt-1 text-xs text-eco-green font-medium">
                    {loading ? (
                      <SkeletonLine w="w-36" />
                    ) : ecoscoreDelta != null ? (
                      ecoscoreDelta > 0 ? (
                        `Improved ${ecoscoreDelta} points this week`
                      ) : ecoscoreDelta < 0 ? (
                        `Down ${Math.abs(ecoscoreDelta)} points this week`
                      ) : (
                        "Stable this week"
                      )
                    ) : ecoscore != null && ecoscore > 0 ? (
                      <span className="text-muted-foreground">
                        Great start! Keep taking eco-routes.
                      </span>
                    ) : displayEcoscore != null ? (
                      <span className="text-muted-foreground">Live EcoScore at current location</span>
                    ) : (
                      <span className="text-muted-foreground">Complete trips to track progress</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-extrabold text-eco-green tracking-tight">
                    {loading && aqiLoading ? "–" : displayEcoscore != null ? displayEcoscore : "–"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">/ 100 Index</div>
                </div>
              </div>
              {loading ? (
                <SkeletonBlock h="h-16" />
              ) : ecoscoreTrend.length >= 2 ? (
                <div className="flex flex-col gap-3">
                  <Sparkline
                    values={ecoscoreTrend}
                    selectedIdx={selectedScoreIdx}
                    onSelect={(idx) => setSelectedScoreIdx(selectedScoreIdx === idx ? null : idx)}
                  />
                  {selectedScoreIdx !== null && weeklyPollution[selectedScoreIdx] && (
                    <div className="mt-2 rounded-2xl bg-card border border-border p-3 text-center animate-in slide-in-from-bottom-2 duration-200">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {weeklyPollution[selectedScoreIdx].day}&apos;s EcoScore
                      </div>
                      <div className="mt-1 text-sm font-bold text-eco-green">
                        {ecoscoreTrend[selectedScoreIdx]} / 100
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-normal">
                        {weeklyPollution[selectedScoreIdx].is_ambient
                          ? "Estimated EcoScore based on city ambient background pollution."
                          : "Calculated from your recorded trips."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">Not enough data for a trend line yet.</p>
              )}
            </Card>

            {/* Badges Card */}
            <Card className="shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground">Badges & Milestones</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Environmental Milestones
                  </p>
                </div>
              </div>
              {loading ? (
                <div className="flex gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <SkeletonBlock h="h-12 w-12" />
                      <SkeletonLine w="w-14" />
                    </div>
                  ))}
                </div>
              ) : badges.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {badges.map((b) => {
                    const Icon = b.icon === "bike" ? Bike : b.icon === "shield" ? Shield : Trees;
                    const color =
                      b.color === "green"
                        ? "text-eco-green bg-eco-green/10 border-eco-green/20"
                        : b.color === "orange"
                          ? "text-eco-orange bg-eco-orange/10 border-eco-orange/20"
                          : "text-eco-blue bg-eco-blue/10 border-eco-blue/20";
                    return (
                      <div key={b.id} className="flex flex-col items-center gap-2 rounded-2xl border border-border/80 bg-background/50 p-3 text-center">
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${color}`}
                        >
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="font-sans text-xs font-semibold text-foreground leading-tight">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No badges earned yet. Take eco-friendly routes to unlock achievements!
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border/80 bg-card p-6 ${className}`}>{children}</div>
  );
}

function CircularProgress({
  value,
  label,
  sublabel,
}: {
  value: number;
  label: string;
  sublabel: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="color-mix(in srgb, var(--color-border) 80%, transparent)" strokeWidth="7" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="var(--eco-green)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  );
}

function Sparkline({
  values,
  selectedIdx,
  onSelect,
}: {
  values: number[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 280,
    h = 60;
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => {
    const y = h - ((v - min) / Math.max(1, max - min)) * (h - 8) - 4;
    return `${i * step},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-16 w-full overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--eco-green)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        const isActive = selectedIdx === i;
        return (
          <g key={i} className="cursor-pointer" onClick={() => onSelect(i)}>
            {/* Click target (invisible large circle for easy tapping) */}
            <circle cx={x} cy={y} r="12" fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={isActive ? "5" : "3"}
              fill={isActive ? "var(--eco-green)" : "var(--background)"}
              stroke="var(--eco-green)"
              strokeWidth="2"
              className="transition-all duration-200"
            />
          </g>
        );
      })}
    </svg>
  );
}
