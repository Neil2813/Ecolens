/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Wind, Factory, Cloud, Thermometer, Volume2, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getDashboardSummary } from "@/lib/api/dashboard";
import { useState, useEffect } from "react";
import { isDemo, apiFetch } from "@/lib/api/client";
import { getCachedUser } from "@/lib/api/auth";

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

async function fetchDemoComposite(
  lat: number,
  lon: number,
): Promise<{ pm25: number; no2: number; temperature: number }> {
  try {
    const [aqRes, weatherRes] = await Promise.all([
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,nitrogen_dioxide&timezone=auto`,
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      ),
    ]);

    let pm25 = 15;
    let no2 = 10;
    let temperature = 25;

    if (aqRes.ok) {
      const aqData = await aqRes.json();
      const hourly = aqData.hourly || {};
      const pm25List = hourly.pm2_5 || [];
      const no2List = hourly.nitrogen_dioxide || [];

      for (let i = pm25List.length - 1; i >= 0; i--) {
        if (pm25List[i] !== null && pm25List[i] !== undefined) {
          pm25 = pm25List[i];
          break;
        }
      }
      for (let i = no2List.length - 1; i >= 0; i--) {
        if (no2List[i] !== null && no2List[i] !== undefined) {
          no2 = no2List[i];
          break;
        }
      }
    }

    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather || {};
      if (current.temperature !== undefined) {
        temperature = current.temperature;
      }
    }

    return { pm25, no2, temperature };
  } catch (err) {
    console.warn("Failed to fetch demo composite:", err);
    return { pm25: 15, no2: 10, temperature: 25 };
  }
}

async function fetchRealComposite(
  lat: number,
  lon: number,
): Promise<{ pm25: number; no2: number; temperature: number }> {
  interface CompositeResponse {
    air_quality?: {
      pm25?: number;
      no2?: number;
    } | null;
    weather?: {
      temperature?: number;
    } | null;
  }
  const data = await apiFetch<CompositeResponse>(`/api/env/composite?lat=${lat}&lon=${lon}`);
  const pm25 = data.air_quality?.pm25 ?? 15;
  const no2 = data.air_quality?.no2 ?? 10;
  const temperature = data.weather?.temperature ?? 25;
  return { pm25, no2, temperature };
}

export const Route = createFileRoute("/dashboard/exposure")({
  head: () => ({ meta: [{ title: "Exposure Breakdown · Ecolens" }] }),
  component: ExposurePage,
});

function ExposurePage() {
  const [loading, setLoading] = useState(true);
  const [pm25, setPm25] = useState(0);
  const [avoided, setAvoided] = useState(0);
  const [co2, setCo2] = useState(0);
  const [heat, setHeat] = useState<string>("–");
  const [noise, setNoise] = useState(0);
  const [no2, setNo2] = useState<number | null>(null);

  const [liveLocationData, setLiveLocationData] = useState<{
    pm25: number;
    no2: number;
    temperature: number;
    city: string;
  } | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLiveLocationData() {
      let lat = 12.9716;
      let lon = 77.5946;
      let city = "Bengaluru";

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

        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        localStorage.setItem("ecolens:last_lat", String(lat));
        localStorage.setItem("ecolens:last_lon", String(lon));
        city = await reverseGeocode(lat, lon);
      } catch (err) {
        console.warn("Geolocation or reverse geocode failed, using profile/fallback:", err);
        const profileLoc = await getCoordsFromProfile();
        if (profileLoc) {
          lat = profileLoc.lat;
          lon = profileLoc.lon;
          city = profileLoc.name;
        } else {
          lat = 12.9716;
          lon = 77.5946;
          city = "Bengaluru";
        }
      }

      if (!active) return;

      try {
        let resData = { pm25: 15, no2: 10, temperature: 25 };
        if (isDemo()) {
          resData = await fetchDemoComposite(lat, lon);
        } else {
          resData = await fetchRealComposite(lat, lon);
        }

        if (active) {
          setLiveLocationData({ ...resData, city });
        }
      } catch (err) {
        console.error("Failed to fetch current location composite:", err);
        if (active) {
          setLiveLocationData({ pm25: 15, no2: 10, temperature: 25, city });
        }
      } finally {
        if (active) {
          setLiveLoading(false);
        }
      }
    }

    loadLiveLocationData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    getDashboardSummary()
      .then((data) => {
        setPm25(data.pm25_inhaled ?? 0);
        setAvoided(data.pm25_avoided ?? 0);
        setCo2(data.co2_grams ?? 0);
        setNoise(data.noise_avg_db ?? 0);
        setNo2(data.no2_inhaled ?? 0);
        // Heat stress: classify from heat_exposure value
        const heatVal = data.heat_exposure ?? 0;
        setHeat(heatVal > 5 ? "High" : heatVal > 2 ? "Moderate" : heatVal > 0 ? "Low" : "–");
      })
      .catch((err) => console.error("Exposure API error:", err))
      .finally(() => setLoading(false));
  }, []);

  const isLiveFallback = !loading && pm25 === 0;

  const displayPm25 = isLiveFallback ? (liveLocationData?.pm25 ?? 0) : pm25;

  const displayNo2 = isLiveFallback ? (liveLocationData?.no2 ?? 0) : (no2 ?? 0);

  const displayHeat = isLiveFallback
    ? liveLocationData
      ? liveLocationData.temperature > 35
        ? "High"
        : liveLocationData.temperature > 28
          ? "Moderate"
          : "Low"
      : "–"
    : heat;

  const displayNoise = isLiveFallback ? (liveLocationData ? 55 : 0) : noise;

  const displayCO2 = co2;

  // WHO PM2.5 daily guideline: 15 µg/m³
  const whoMultiple = displayPm25 > 0 ? Math.round(displayPm25 / 15) : null;
  const heatStatus: "safe" | "moderate" | "high" =
    displayHeat === "High" ? "high" : displayHeat === "Moderate" ? "moderate" : "safe";
  const noiseStatus: "safe" | "moderate" | "high" =
    displayNoise > 70 ? "high" : displayNoise > 55 ? "moderate" : "safe";
  const no2Status: "safe" | "moderate" | "high" =
    displayNo2 > 50 ? "high" : displayNo2 > 25 ? "moderate" : "safe";

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
            Today&apos;s Exposure Breakdown
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        {/* PM2.5 bar */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-eco-orange" />
              <h3 className="font-semibold">PM2.5 Exposure</h3>
            </div>
            <div className="text-right">
              {loading || (isLiveFallback && liveLoading) ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold">
                  {displayPm25.toFixed(1)}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {isLiveFallback ? "µg/m³ ambient" : "µg inhaled"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Particulate Matter &lt; 2.5 µm
          </p>
          <Bar
            value={isLiveFallback ? (displayPm25 / 150) * 100 : (displayPm25 / 1000) * 100}
            color="bg-eco-orange"
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            {isLiveFallback ? (
              <>
                <span>0</span>
                <span>35 (WHO Guideline)</span>
                <span>100 (Unhealthy)</span>
                <span>150+</span>
              </>
            ) : (
              <>
                <span>0</span>
                <span>500</span>
                <span>City Avg 890</span>
                <span>1000+</span>
              </>
            )}
          </div>
        </div>

        {/* Mini metric grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniMetric
            icon={<Factory className="h-4 w-4" />}
            label="NO2"
            value={
              loading || (isLiveFallback && liveLoading)
                ? "–"
                : `${displayNo2.toFixed(0)} ${isLiveFallback ? "µg/m³" : "µg"}`
            }
            status={no2Status}
          />
          <MiniMetric
            icon={<Cloud className="h-4 w-4" />}
            label="CO₂ Emitted"
            value={loading ? "–" : `${displayCO2.toFixed(0)} g`}
            status="safe"
          />
          <MiniMetric
            icon={<Thermometer className="h-4 w-4" />}
            label="Heat Stress"
            value={loading || (isLiveFallback && liveLoading) ? "–" : displayHeat}
            status={heatStatus}
          />
          <MiniMetric
            icon={<Volume2 className="h-4 w-4" />}
            label="Noise"
            value={
              loading || (isLiveFallback && liveLoading)
                ? "–"
                : displayNoise > 0
                  ? `${displayNoise.toFixed(0)} dB`
                  : "–"
            }
            status={noiseStatus}
          />
        </div>

        {/* Health context */}
        <div className="mt-4 rounded-3xl border border-eco-green/30 bg-eco-green/5 p-5">
          <h3 className="font-semibold text-eco-green">Health Context</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isLiveFallback ? (
              <>
                Current location ambient PM2.5:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {displayPm25.toFixed(1)} µg/m³
                </span>
                .
              </>
            ) : (
              <>
                WHO daily PM2.5 guideline:{" "}
                <span className="font-mono font-semibold text-foreground">15 µg</span>.
              </>
            )}
          </p>
          {loading || (isLiveFallback && liveLoading) ? (
            <div className="mt-3 h-6 w-48 animate-pulse rounded bg-muted" />
          ) : isLiveFallback ? (
            <p className="mt-3 text-base font-semibold text-eco-green">
              Showing live environmental data for {liveLocationData?.city || "your location"}.
            </p>
          ) : whoMultiple != null && whoMultiple > 0 ? (
            <p className="mt-3 text-base font-semibold text-eco-orange">
              You inhaled {whoMultiple}× that.
            </p>
          ) : pm25 === 0 ? (
            <p className="mt-3 text-base font-semibold text-eco-green">
              No PM2.5 exposure recorded today.
            </p>
          ) : (
            <p className="mt-3 text-base font-semibold text-eco-green">
              You inhaled less than 1× the WHO guideline. Great job!
            </p>
          )}
          {avoided > 0 && (
            <p className="mt-3 rounded-xl bg-background/50 p-3 text-sm leading-relaxed">
              Ecolens route saved you from an additional{" "}
              <b className="font-mono text-eco-green">{avoided.toFixed(0)} µg</b>.
            </p>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "safe" | "moderate" | "high";
}) {
  const tone =
    status === "safe"
      ? "text-eco-green"
      : status === "moderate"
        ? "text-eco-orange"
        : "text-eco-red";
  const ring =
    status === "safe"
      ? "border-eco-green/30"
      : status === "moderate"
        ? "border-eco-orange/30"
        : "border-eco-red/30";
  return (
    <div className={`rounded-2xl border bg-card p-4 ${ring}`}>
      <div className={`flex items-center gap-2 ${tone}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
