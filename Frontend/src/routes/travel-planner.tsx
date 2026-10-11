/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plane,
  Search,
  Calendar,
  Download,
  Loader2,
  Leaf,
  MapPin,
  MapPinned,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Sun,
  CloudSun,
  Moon,
  Star,
  Clock,
  Utensils,
  Landmark,
  Table as TableIcon,
  Wind,
  BedDouble,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { cn } from "@/lib/utils";
import { planTrip, downloadCalendar, type TravelPlanResponse } from "@/lib/api/travel";

export const Route = createFileRoute("/travel-planner")({
  head: () => ({ meta: [{ title: "Eco-Travel Planner · Ecolens" }] }),
  component: TravelPlannerPage,
});

interface StayItem {
  name: string;
  type: string;
  rating: string;
  price: string;
  highlights: string;
}

interface StopItem {
  time: string;
  name: string;
  type: string;
  ratingPrice: string;
  special: string;
}

interface DayItem {
  dayNumber: number;
  title: string;
  stops: StopItem[];
  ecoTip: string;
}

function parseItinerary(markdown: string) {
  const lines = markdown.split("\n");
  const stays: StayItem[] = [];
  const days: DayItem[] = [];
  let currentDay: DayItem | null = null;
  let inStayTable = false;
  let inDayTable = false;
  let envInfo = "";
  let carbonFootprint = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Environmental header line
    if (raw.startsWith("_") && raw.endsWith("_") && raw.includes("PM2.5")) {
      envInfo = raw.slice(1, -1);
      continue;
    }

    // Carbon footprint line
    if (raw.toLowerCase().includes("carbon footprint")) {
      carbonFootprint = raw.replace(/\*\*/g, "").trim();
      continue;
    }

    // Where to stay heading
    if (raw.toLowerCase().includes("where to stay") || raw.toLowerCase().includes("recommended eco")) {
      inStayTable = true;
      inDayTable = false;
      continue;
    }

    // Day Header
    const dayMatch = raw.match(/^(?:#+\s*)?Day\s*(\d+)[:\s]*(.*)/i);
    if (dayMatch) {
      inStayTable = false;
      inDayTable = true;
      currentDay = {
        dayNumber: parseInt(dayMatch[1], 10),
        title: dayMatch[2].replace(/^[-*:\s]+/, "").trim() || `Day ${dayMatch[1]}: Eco-Exploration`,
        stops: [],
        ecoTip: "",
      };
      days.push(currentDay);
      continue;
    }

    // Eco Tip
    const ecoTipMatch = raw.match(/^(?:>|\*)?\s*(?:\*\*)?Eco[- ]Tip:?(?:\*\*)?\s*(.*)/i);
    if (ecoTipMatch && currentDay) {
      currentDay.ecoTip = ecoTipMatch[1].replace(/\*\*$/, "").replace(/^\*\*/, "").trim();
      continue;
    }

    // Markdown Table Rows: | col1 | col2 | col3 | ... |
    if (raw.startsWith("|") && raw.endsWith("|")) {
      if (raw.includes(":---") || raw.includes("---:")) continue; // separator row
      const cells = raw
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 3) continue;

      const firstCol = cells[0].toLowerCase();
      // Skip table header
      if (firstCol === "time" || firstCol === "accommodation") continue;

      if (inStayTable) {
        stays.push({
          name: cells[0].replace(/\*\*/g, ""),
          type: cells[1] || "Hotel",
          rating: cells[2] || "",
          price: cells[3] || "",
          highlights: cells[4] || cells[3] || "",
        });
      } else if (inDayTable && currentDay) {
        currentDay.stops.push({
          time: cells[0],
          name: cells[1].replace(/\*\*/g, ""),
          type: cells[2] || "",
          ratingPrice: cells[3] || "",
          special: cells[4] || "",
        });
      }
      continue;
    }

    // Fallback: bullet points if table row wasn't used
    if (inDayTable && currentDay && (raw.startsWith("-") || raw.startsWith("*"))) {
      const cleanBullet = raw.replace(/^[-*•]\s+/, "");
      const match = cleanBullet.match(/^\*\*([^*]+)\*\*(?:\s*\(([^)]+)\))?:\s*(.*)/);
      if (match) {
        currentDay.stops.push({
          time: "Explore",
          name: match[1],
          type: match[2] || "Sight",
          ratingPrice: "",
          special: match[3],
        });
      }
    }
  }

  return { envInfo, stays, days, carbonFootprint };
}

function RatingPriceBadge({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split("•").map((p) => p.trim());
  const ratingPart = parts[0] || "";
  const pricePart = parts[1] || "";

  const isStar = ratingPart.includes("⭐") || ratingPart.includes("★");
  const isFree = text.toLowerCase().includes("free");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isStar && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shadow-xs">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
          {ratingPart.replace(/⭐|★/g, "").trim()}
        </span>
      )}
      {!isStar && ratingPart && (
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
            isFree
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-muted text-muted-foreground border border-border/60",
          )}
        >
          {ratingPart}
        </span>
      )}
      {pricePart && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap shadow-xs">
          {pricePart}
        </span>
      )}
    </div>
  );
}

function TimeBadge({ time }: { time: string }) {
  const clean = time.replace(/[🌅🕒🍽️🏺🌙🌆]/g, "").trim() || "Activity";
  const lower = clean.toLowerCase();

  let icon = <Sun className="h-3.5 w-3.5 text-amber-500" />;
  let color = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

  if (lower.includes("late")) {
    icon = <Clock className="h-3.5 w-3.5 text-orange-500" />;
    color = "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
  } else if (lower.includes("lunch")) {
    icon = <Utensils className="h-3.5 w-3.5 text-emerald-500" />;
    color = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  } else if (lower.includes("afternoon")) {
    icon = <Landmark className="h-3.5 w-3.5 text-sky-500" />;
    color = "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30";
  } else if (lower.includes("evening") || lower.includes("dinner")) {
    icon = <Moon className="h-3.5 w-3.5 text-indigo-500" />;
    color = "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border whitespace-nowrap", color)}>
      {icon}
      <span>{clean}</span>
    </span>
  );
}

function TimelineRenderer({ markdown }: { markdown: string }) {
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const { envInfo, stays, days, carbonFootprint } = parseItinerary(markdown);

  if (days.length === 0 && stays.length === 0) {
    return (
      <div className="rounded-3xl border border-border/80 bg-card p-6 text-sm leading-relaxed space-y-3 text-foreground shadow-md">
        <pre className="whitespace-pre-wrap font-sans">{markdown}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-end border-b border-border/60 pb-4">
        <div className="flex items-center gap-1 rounded-2xl bg-muted/60 p-1 border border-border/70 backdrop-blur-md">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === "table"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TableIcon className="h-3.5 w-3.5 text-primary" />
            Table View
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === "timeline"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            Timeline View
          </button>
        </div>
      </div>

      {/* Environmental Live Conditions Banner */}
      {envInfo && (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Live Environmental Status
              </span>
              <p className="text-sm font-bold text-foreground">{envInfo}</p>
            </div>
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Air Quality Verified
          </span>
        </div>
      )}

      {/* Where to Stay Section (Interactive Table & Card) */}
      {stays.length > 0 && (
        <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <BedDouble className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-foreground">Recommended Eco-Friendly Stays</h3>
                <p className="text-xs text-muted-foreground">Certified sustainable accommodations with transit connectivity</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex text-[11px] font-mono px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
              {stays.length} Properties
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/60 font-mono text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/70">
                <tr>
                  <th className="px-4 py-3 font-bold">Accommodation</th>
                  <th className="px-3 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Rating & Reviews</th>
                  <th className="px-3 py-3 font-bold">Price</th>
                  <th className="px-5 py-3 font-bold">Highlights & Sustainability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stays.map((stay, idx) => (
                  <tr key={idx} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{stay.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                        {stay.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <RatingPriceBadge text={stay.rating} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {stay.price || "Check Rates"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground leading-relaxed min-w-[280px]">
                      {stay.highlights}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Days Schedule */}
      <div className="space-y-10">
        {days.map((day, dIdx) => (
          <div key={dIdx} className="space-y-4">
            {/* Day Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{day.title}</h3>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Day {day.dayNumber}
              </span>
            </div>

            {/* Render Mode: Table View */}
            {viewMode === "table" ? (
              <div className="rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-muted/60 font-mono text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/70">
                      <tr>
                        <th className="px-4 py-3.5 font-bold">Time</th>
                        <th className="px-4 py-3.5 font-bold">Stop / Venue</th>
                        <th className="px-3 py-3.5 font-bold">Category</th>
                        <th className="px-4 py-3.5 font-bold">Rating & Price</th>
                        <th className="px-5 py-3.5 font-bold">What Makes It Special</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {day.stops.map((stop, sIdx) => (
                        <tr key={sIdx} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-4 align-top whitespace-nowrap">
                            <TimeBadge time={stop.time} />
                          </td>
                          <td className="px-4 py-4 align-top font-bold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{stop.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                              {stop.type || "Attraction"}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top whitespace-nowrap">
                            <RatingPriceBadge text={stop.ratingPrice} />
                          </td>
                          <td className="px-5 py-4 align-top text-xs sm:text-sm text-muted-foreground leading-relaxed min-w-[280px]">
                            {stop.special}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Render Mode: Timeline View */
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-[11px] sm:before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-border/80">
                {day.stops.map((stop, sIdx) => (
                  <div key={sIdx} className="relative flex items-start gap-4">
                    <span className="absolute -left-[19px] sm:-left-[23px] top-4 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background border-2 border-primary" />
                    <div className="flex-1 rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-2.5 hover:border-primary/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TimeBadge time={stop.time} />
                          <h4 className="font-extrabold text-base text-foreground">{stop.name}</h4>
                        </div>
                        <RatingPriceBadge text={stop.ratingPrice} />
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{stop.special}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Eco Tip Callout */}
            {day.ecoTip && (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 flex items-start gap-3 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                <Leaf className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <strong className="font-bold text-foreground">Eco Tip: </strong>
                  <span>{day.ecoTip}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Carbon Footprint Summary Card */}
      {carbonFootprint && (
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-extrabold text-foreground uppercase tracking-wider font-mono">
              Zero-Emission Mobility Savings
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{carbonFootprint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TravelPlannerPage() {
  const [destination, setDestination] = useState("");
  const [numDays, setNumDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "researching" | "planning" | "done">("idle");
  const [result, setResult] = useState<TravelPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = async () => {
    if (!destination.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPhase("researching");

    let timeoutId: number | undefined;

    try {
      // Brief delay to transition visual phase to "planning"
      timeoutId = window.setTimeout(() => setPhase("planning"), 2000);
      const data = await planTrip(destination.trim(), numDays);
      if (timeoutId) window.clearTimeout(timeoutId);
      setResult(data);
      setPhase("done");
    } catch (err: any) {
      if (timeoutId) window.clearTimeout(timeoutId);
      setError(err?.detail || err?.message || "Failed to generate itinerary.");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!result) return;
    try {
      const blob = new Blob([result.itinerary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ecolens_itinerary_${result.destination.toLowerCase().replace(/\s+/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail text download
    }
  };

  return (
    <MobileShell>
      <div className="flex h-full flex-col bg-background">
        <style>{`
          input[type=range]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: transparent;
            cursor: pointer;
          }
          input[type=range]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: transparent;
            cursor: pointer;
            border: none;
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 shrink-0">
          <a
            href="/map"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              Eco-Travel Planner
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Multi-Agent Itinerary Engine
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-28">
          {/* Input Section */}
          {phase !== "done" && (
            <div className="w-full max-w-3xl mx-auto mt-6 md:mt-12 space-y-8 animate-in fade-in duration-300">
              {/* Destination Input */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <MapPinned className="h-4 w-4 text-primary" strokeWidth={2.5} />
                  Target Destination
                </label>
                <div className="relative flex items-center rounded-2xl bg-card border border-border/80 p-2 shadow-sm focus-within:border-primary/60 transition-all">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Kyoto, Barcelona, Vancouver, Zurich..."
                    disabled={loading}
                    className="flex-1 bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground font-sans text-sm font-medium"
                  />
                  <button 
                    onClick={handlePlan}
                    disabled={loading || !destination.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30 shrink-0 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                  >
                    <Search className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Days Selector */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <Calendar className="h-4 w-4 text-primary" strokeWidth={2.5} />
                  Trip Duration
                </label>

                <div className="relative pt-6 pb-2">
                  {/* Tooltip */}
                  <div
                    className="absolute -top-3 -ml-6 flex w-12 flex-col items-center transition-all duration-200"
                    style={{ left: `calc(${((numDays - 1) / 13) * 100}%)` }}
                  >
                    <div className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md whitespace-nowrap">
                      {numDays} {numDays === 1 ? "Day" : "Days"}
                    </div>
                    <div className="h-2 w-2 rotate-45 bg-primary -mt-1 rounded-xs" />
                  </div>

                  {/* Custom Slider Track (background) */}
                  <div className="absolute top-8 left-0 right-0 h-2 rounded-full bg-secondary border border-border/50" />
                  {/* Custom Slider Track (fill) */}
                  <div
                    className="absolute top-8 left-0 h-2 rounded-full bg-primary"
                    style={{ width: `${((numDays - 1) / 13) * 100}%` }}
                  />

                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={numDays}
                    onChange={(e) => setNumDays(Number(e.target.value))}
                    disabled={loading}
                    className="absolute top-7 w-full appearance-none bg-transparent opacity-0 cursor-pointer h-5 z-10"
                  />

                  {/* Thumb visual */}
                  <div
                    className="absolute top-[30px] h-[18px] w-[18px] -ml-[9px] rounded-full bg-primary ring-2 ring-background shadow-md pointer-events-none transition-all duration-200"
                    style={{ left: `calc(${((numDays - 1) / 13) * 100}%)` }}
                  />

                  <div className="mt-8 flex justify-between text-[11px] text-muted-foreground relative px-1 font-mono font-medium">
                    <div className="absolute top-[-14px] left-0 right-0 flex justify-between px-1 z-0">
                      {[...Array(14)].map((_, i) => (
                        <div key={i} className={cn("w-px bg-border", (i === 0 || i === 6 || i === 13) ? "h-2.5" : "h-1.5")} />
                      ))}
                    </div>
                    <span>1</span>
                    <span className="ml-1">7</span>
                    <span>14</span>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handlePlan}
                disabled={loading || !destination.trim()}
                className={cn(
                  "w-full rounded-2xl py-4 text-center font-bold text-base transition-all mt-4",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2 shadow-lg shadow-primary/20",
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {phase === "researching" ? "Agent 1 Researching..." : "Agent 2 Planning Itinerary..."}
                  </>
                ) : (
                  <>
                    <Leaf className="h-5 w-5" />
                    Generate Eco-Itinerary
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="space-y-3 animate-in fade-in duration-300 w-full max-w-3xl mx-auto">
              <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-3 shadow-md">
                <div className="flex items-center gap-2 text-primary text-xs font-mono">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="uppercase tracking-wider font-bold">
                    {phase === "researching"
                      ? "Agent 1: Ingesting environmental & transit points..."
                      : "Agent 2: Synthesizing zero-emission schedule..."}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-3/4 rounded-full" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono px-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Powered by Multi-Agent Environmental Pipeline</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-xs text-eco-red font-semibold shadow-sm text-center w-full max-w-3xl mx-auto">
              {error}
            </div>
          )}

          {/* Result */}
          {result && phase === "done" && (
            <div className="absolute inset-0 z-20 flex flex-col bg-background overflow-y-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header banner */}
              <div className="border-b border-border/80 bg-card/60 backdrop-blur-xl w-full pt-10 pb-6 px-6 md:px-12 relative flex items-center justify-between">
                <button
                  onClick={() => {
                    setResult(null);
                    setPhase("idle");
                  }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Planner
                </button>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1 font-mono text-xs font-bold text-primary">
                    {result.destination} · {numDays} Days
                  </span>
                </div>
              </div>

              {/* Title Section */}
              <div className="px-6 md:px-12 w-full max-w-5xl mx-auto mt-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Eco-Travel Itinerary
                </h1>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mt-1">
                  AI-Curated Carbon-Neutral Schedule for {result.destination}
                </p>
              </div>

              {/* Timeline Content */}
              <div className="px-6 md:px-12 py-8 max-w-5xl mx-auto w-full">
                <TimelineRenderer markdown={result.itinerary} />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 px-6 md:px-12 pb-12 max-w-5xl mx-auto w-full justify-center">
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-8 py-3.5 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary transition-all shadow-sm active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  Download Itinerary (.txt)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
