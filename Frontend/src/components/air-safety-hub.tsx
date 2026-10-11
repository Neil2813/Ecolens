/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { useState, useEffect } from "react";
import {
  Flame,
  Wind,
  Home,
  GraduationCap,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  Fan,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Compass,
} from "lucide-react";
import {
  getStubbleFires,
  getIndoorAirEstimate,
  getSchoolSafety,
  type StubbleFiresResponse,
  type IndoorAirResponse,
  type SchoolSafetyResponse,
} from "@/lib/api/env";

interface AirSafetyHubProps {
  lat?: number;
  lon?: number;
  pm25?: number;
  aqi?: number;
  cityName?: string;
}

export function AirSafetyHub({
  lat = 28.6139,
  lon = 77.209,
  pm25 = 65,
  aqi = 158,
  cityName = "Current Location",
}: AirSafetyHubProps) {
  const [activeTab, setActiveTab] = useState<"stubble" | "indoor" | "school">("stubble");
  const [loading, setLoading] = useState(true);

  // Data states
  const [stubbleData, setStubbleData] = useState<StubbleFiresResponse | null>(null);
  const [indoorData, setIndoorData] = useState<IndoorAirResponse | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolSafetyResponse | null>(null);

  // Selected indoor scenario
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("open_windows");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadAll() {
      try {
        const [stubble, indoor, school] = await Promise.all([
          getStubbleFires(lat, lon),
          getIndoorAirEstimate(lat, lon, pm25, aqi),
          getSchoolSafety(lat, lon, pm25, aqi),
        ]);
        if (!cancelled) {
          setStubbleData(stubble);
          setIndoorData(indoor);
          setSchoolData(school);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Error loading air safety analytics:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [lat, lon, pm25, aqi]);

  const activeScenario =
    indoorData?.scenarios.find((s) => s.id === selectedScenarioId) ||
    indoorData?.scenarios[0];

  return (
    <div className="w-full rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-xl backdrop-blur-md">
      {/* Header with Track 01 Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-eco-orange/15 border border-eco-orange/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-eco-orange">
              <Sparkles className="h-3 w-3" /> Track 01 Air Defense
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Live Satellite & Micro-Climate Shield
            </span>
          </div>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Air Hazard Defense Center
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center rounded-2xl bg-muted/70 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("stubble")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "stubble"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-eco-orange" />
            <span>Stubble Fire Radar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("indoor")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "indoor"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="h-3.5 w-3.5 text-emerald-500" />
            <span>Indoor Air & Ventilation</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("school")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "school"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 text-blue-500" />
            <span>School Safety on Bad Days</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-eco-green border-t-transparent" />
            <p className="text-xs font-mono">Querying NASA EONET satellites and EPA infiltration models...</p>
          </div>
        ) : activeTab === "stubble" ? (
          /* ───────── 1. STUBBLE BURNING & FIRE RADAR ───────── */
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Alert banner */}
            <div className="rounded-2xl border border-eco-orange/30 bg-eco-orange/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Flame className="h-5 w-5 text-eco-orange shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Agricultural Stubble & Biomass Fire Plume Radar
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stubbleData?.summary}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    stubbleData?.stubble_risk_level === "Critical"
                      ? "bg-rose-500/20 text-rose-600 border border-rose-500/30"
                      : stubbleData?.stubble_risk_level === "High"
                        ? "bg-eco-orange/20 text-eco-orange border border-eco-orange/30"
                        : "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                  }`}
                >
                  {stubbleData?.stubble_risk_level} Influx Risk
                </span>
              </div>

              {/* Wind Vector Metrics */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-eco-orange/20">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Wind Velocity</span>
                  <span className="text-sm font-bold text-foreground">
                    {stubbleData?.wind_vector.speed_kmh} km/h
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Wind Direction</span>
                  <span className="text-sm font-bold text-foreground">
                    {stubbleData?.wind_vector.from_direction_deg}° (Blows towards {stubbleData?.wind_vector.blows_towards_deg}°)
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Harvest Context</span>
                  <span className="text-sm font-bold text-foreground">
                    {stubbleData?.season_context.label.split(" ")[0]} Season
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">Active Hotspots</span>
                  <span className="text-sm font-bold text-foreground">
                    {stubbleData?.hotspots_count} Sat Clusters
                  </span>
                </div>
              </div>
            </div>

            {/* Hotspots List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stubbleData?.hotspots.map((spot) => (
                <div
                  key={spot.id}
                  className="rounded-2xl border border-border/80 bg-background/60 p-4 hover:border-eco-orange/40 transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        <h4 className="font-semibold text-xs text-foreground">{spot.title}</h4>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                        {spot.distance_km} km away
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Compass className="h-3 w-3 text-eco-orange" />
                      Bearing: {spot.bearing_to_user_deg}° · {spot.trajectory_status}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-eco-orange" />
                      <span>
                        {spot.estimated_plume_arrival_hrs != null
                          ? `Plume arrival: ~${spot.estimated_plume_arrival_hrs} hrs`
                          : "Smoke drifting away"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded-lg text-foreground font-semibold">
                      FRP: {spot.fire_radiative_power_mw} MW
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === "indoor" ? (
          /* ───────── 2. INDOOR AIR & VENTILATION ───────── */
          <div className="flex flex-col gap-5 animate-in fade-in duration-300">
            {/* Interactive Scenario Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Select Building Setup (EPA Indoor-to-Outdoor Infiltration Model)
                </span>
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" /> Outdoor PM2.5: {indoorData?.outdoor_baseline.pm25} µg/m³
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {indoorData?.scenarios.map((scen) => {
                  const isSelected = scen.id === selectedScenarioId;
                  return (
                    <button
                      key={scen.id}
                      type="button"
                      onClick={() => setSelectedScenarioId(scen.id)}
                      className={`text-left rounded-2xl p-3.5 border transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500"
                          : "border-border/80 bg-background/50 hover:border-border hover:bg-background/80"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-foreground">{scen.name}</h4>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {scen.description}
                        </p>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-border/40">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Leakage: {Math.round(scen.penetration_ratio * 100)}%
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-foreground">
                            {scen.estimated_pm25}
                          </span>
                          <span className="text-[10px] text-muted-foreground"> µg/m³</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Scenario Impact Banner */}
            {activeScenario && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                    AQI {activeScenario.estimated_aqi}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      Estimated Indoor Air Quality: {activeScenario.safety_badge}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Inhaled particulate load is reduced by{" "}
                      <b className="text-emerald-600 font-bold">
                        {Math.round((1 - activeScenario.penetration_ratio) * 100)}%
                      </b>{" "}
                      compared to outdoor street air.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono bg-muted/80 px-3 py-1.5 rounded-xl text-foreground font-semibold">
                    Indoor PM2.5: {activeScenario.estimated_pm25} µg/m³
                  </span>
                </div>
              </div>
            )}

            {/* Smart Ventilation Window & Quarantine Rules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ventilation Timing */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-eco-green">
                    <Fan className="h-4 w-4" />
                    <h4 className="font-bold text-xs uppercase tracking-wider font-mono">
                      Smart Window Ventilation Window
                    </h4>
                  </div>
                  <div className="mt-2 text-sm font-bold text-foreground">
                    {indoorData?.smart_ventilation_window.best_time_window}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {indoorData?.smart_ventilation_window.guidance}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                  <Info className="h-3.5 w-3.5 text-eco-green" />
                  <span>Forecast trough PM2.5: ~{indoorData?.smart_ventilation_window.lowest_forecast_pm25} µg/m³</span>
                </div>
              </div>

              {/* Quarantine Checklist */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-center gap-2 text-eco-orange mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  <h4 className="font-bold text-xs uppercase tracking-wider font-mono">
                    Indoor Air Protection Checklist
                  </h4>
                </div>
                <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {indoorData?.indoor_quarantine_protocols.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-eco-orange shrink-0 mt-1.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* ───────── 3. SCHOOL SAFETY ON BAD DAYS ───────── */
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* School Safety Flag Banner */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    EPA Child Air Flag
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    Pediatric Inhalation Volume: {schoolData?.pediatric_multiplier}× Adult Rate
                  </span>
                </div>
                <h3 className="mt-1 text-base font-extrabold text-foreground">
                  Status: {schoolData?.school_safety_flag}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {schoolData?.commute_guidance}
                </p>
              </div>

              {schoolData?.emergency_remote_advisory && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-rose-600 font-bold text-xs flex items-center gap-1.5 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Remote Learning Advisory Triggered</span>
                </div>
              )}
            </div>

            {/* School Activity Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Recess & Playground Status
                </span>
                <div className="mt-1 text-sm font-bold text-foreground">
                  {schoolData?.recess_protocol}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Limit continuous running and physical exertion in open playgrounds.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Physical Education / Sports
                </span>
                <div className="mt-1 text-sm font-bold text-foreground">
                  {schoolData?.physical_education_protocol}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Athletic cardiovascular demand forces deep alveolar particulate penetration.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Vulnerable Students (Asthma)
                </span>
                <div className="mt-1 text-sm font-bold text-foreground">
                  {schoolData?.vulnerable_child_action}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ensure quick access to nebulizers and inhalers in school medical rooms.
                </p>
              </div>
            </div>

            {/* Bell Schedule Drop-off & Pick-up Comparison */}
            <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <h4 className="font-bold text-xs uppercase tracking-wider font-mono text-muted-foreground mb-3">
                School Commute Bell Windows (Traffic & Inversion Exposure)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schoolData?.bell_windows.map((bell, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/60 bg-muted/40 p-3 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{bell.bell}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          bell.risk === "High"
                            ? "bg-rose-500/20 text-rose-600"
                            : "bg-eco-orange/20 text-eco-orange"
                        }`}
                      >
                        {bell.risk} Risk · ~{bell.estimated_pm25} µg/m³
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{bell.protocol}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
