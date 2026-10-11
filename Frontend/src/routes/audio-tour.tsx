/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Headphones,
  MapPin,
  Loader2,
  ArrowLeft,
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Leaf,
  Landmark,
  Palette,
  UtensilsCrossed,
  Building2,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { cn } from "@/lib/utils";
import { generateTour, type TourResponse } from "@/lib/api/travel";
import { Map as MapComponent, MapMarker } from "@/components/ui/map";

export const Route = createFileRoute("/audio-tour")({
  head: () => ({ meta: [{ title: "Audio Tour Guide · Ecolens" }] }),
  component: AudioTourPage,
});

const INTEREST_OPTIONS = [
  { id: "Environmental", label: "Environmental", icon: Leaf, color: "text-eco-green" },
  { id: "History", label: "History", icon: Landmark, color: "text-eco-blue" },
  { id: "Culture", label: "Culture", icon: Palette, color: "text-purple-400" },
  { id: "Culinary", label: "Culinary", icon: UtensilsCrossed, color: "text-eco-orange" },
  { id: "Architecture", label: "Architecture", icon: Building2, color: "text-amber-400" },
] as const;

const DURATION_OPTIONS = [5, 10, 15, 30] as const;

function AudioTourPage() {
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>(["Environmental"]);
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TourResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([77.5946, 12.9716]);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSecs, setDurationSecs] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedLat = localStorage.getItem("ecolens:last_lat");
      const cachedLon = localStorage.getItem("ecolens:last_lon");
      if (cachedLat && cachedLon) {
        const lat = parseFloat(cachedLat);
        const lon = parseFloat(cachedLon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setMapCenter([lon, lat]);
        }
      }
    }

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    if (!location.trim() || interests.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    if (audioRef.current) {
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    try {
      // Best-effort geocoding for the dynamic map
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location.trim())}&format=json&limit=1`)
        .then(res => res.json())
        .then(geo => {
          if (Array.isArray(geo) && geo.length > 0 && geo[0]?.lon && geo[0]?.lat) {
            const lon = parseFloat(geo[0].lon);
            const lat = parseFloat(geo[0].lat);
            if (Number.isFinite(lon) && Number.isFinite(lat)) {
              setMapCenter([lon, lat]);
            }
          }
        })
        .catch(() => {});

      const data = await generateTour(location.trim(), interests, duration);
      const narrationText = (data?.narration || "").trim();
      if (narrationText.startsWith('{"error"') || narrationText.startsWith('{"detail"') || narrationText.includes('model_not_found') || narrationText.includes('invalid_request_error')) {
        setError("Unable to generate tour. Please try generating again.");
        return;
      }
      setResult(data);
      setCurrentTime(0);
      setDurationSecs(0);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to generate tour.");
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <MobileShell>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <a
            href="/map"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Headphones className="h-4 w-4 text-eco-green" />
              Audio Tour Guide
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Multi-Agent Narration Engine
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 pb-28">
          {/* Input Section */}
          {!result && (
            <div className="w-full max-w-3xl mx-auto mt-6 md:mt-12 space-y-8 animate-in fade-in duration-300">
              {/* Location Input */}
              <div className="w-full relative">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                  <MapPin className="h-4 w-4 text-primary" strokeWidth={2.5} />
                  Tour Location
                </label>
                <div className="relative flex items-center rounded-2xl bg-card border border-border/80 p-2 shadow-sm focus-within:border-primary/60 transition-all">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Cubbon Park, Central Park, Hyde Park..."
                    disabled={loading}
                    className="flex-1 bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground font-sans text-sm font-medium"
                  />
                </div>
              </div>

              <div className="w-full space-y-6">
                {/* Interest Chips */}
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wider text-foreground font-bold pl-1">
                    Select Curated Interests
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {INTEREST_OPTIONS.map(({ id, label, icon: Icon }) => {
                      const active = interests.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleInterest(id)}
                          disabled={loading}
                          className={cn(
                            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all border",
                            active
                              ? "border-primary bg-primary/15 text-primary shadow-xs"
                              : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            "disabled:opacity-50 active:scale-95"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Selector */}
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wider text-foreground font-bold pl-1">
                    Tour Narration Duration
                  </label>
                  <div className="flex gap-2.5 w-full">
                    {DURATION_OPTIONS.map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setDuration(mins)}
                        disabled={loading}
                        className={cn(
                          "flex-1 rounded-xl py-3 text-xs sm:text-sm font-bold transition-all border",
                          "disabled:opacity-50 shadow-xs active:scale-95",
                          duration === mins
                            ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                            : "border-border/80 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading || !location.trim() || interests.length === 0}
                className={cn(
                  "w-full rounded-2xl py-4 text-center font-bold text-base transition-all mt-4",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2.5 shadow-lg shadow-primary/25",
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating tour narration...
                  </>
                ) : (
                  <>
                    <Headphones className="h-5 w-5" />
                    Generate Audio Tour
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-3 animate-in fade-in duration-300 w-full max-w-3xl mx-auto">
              {interests.map((interest, idx) => (
                <div key={interest} className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-muted-foreground uppercase tracking-wider font-semibold">
                      Agent {idx + 1}: Synthesizing {interest.toLowerCase()} perspectives...
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono px-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Neural multi-agent voice synthesis in progress</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-xs text-eco-red font-semibold text-center w-full max-w-3xl mx-auto">
              {error}
            </div>
          )}

          {/* Result Overlay */}
          {result && (
            <div className="absolute inset-0 z-20 flex flex-col bg-background overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              {/* Header */}
              <div className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border/80 bg-card/60 backdrop-blur-xl">
                <button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                    setIsPlaying(false);
                    if (audioRef.current) {
                      audioRef.current.removeAttribute("src");
                      audioRef.current.load();
                    }
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Tours
                </button>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1 font-mono text-xs font-bold text-primary">
                    {location} · {duration} min
                  </span>
                </div>
              </div>

              <div className="max-w-6xl w-full mx-auto p-6 md:p-10 space-y-8 flex-1 flex flex-col">
                {error && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive font-semibold flex items-center justify-between gap-4 animate-in fade-in duration-200">
                    <span>{error}</span>
                    <button
                      onClick={() => {
                        setResult(null);
                        setError(null);
                        setIsPlaying(false);
                        if (audioRef.current) {
                          audioRef.current.removeAttribute("src");
                          audioRef.current.load();
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 shrink-0"
                    >
                      New Tour
                    </button>
                  </div>
                )}
                
                {/* Audio Player Card */}
                {result.audio_url && (
                  <div className="w-full bg-card rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 border border-border/80 shadow-xl backdrop-blur-xl">
                    <audio
                      ref={audioRef}
                      src={result.audio_url}
                      preload="none"
                      onEnded={() => setIsPlaying(false)}
                      onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                      onLoadedMetadata={() => setDurationSecs(audioRef.current?.duration || 0)}
                      onError={() => {
                        setIsPlaying(false);
                        setError("The audio file has expired or is no longer available on the server. Please generate a new tour.");
                        if (audioRef.current) {
                          audioRef.current.removeAttribute("src");
                          audioRef.current.load();
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-4">
                      <button className="text-emerald-300 hover:text-emerald-500 transition-colors">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                      </button>
                      <button
                        onClick={togglePlayPause}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-transform active:scale-95 shadow-lg shadow-emerald-500/30"
                      >
                        {isPlaying ? (
                          <Pause className="h-6 w-6" />
                        ) : (
                          <Play className="h-6 w-6 ml-1" />
                        )}
                      </button>
                      <button className="text-emerald-300 hover:text-emerald-500 transition-colors">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 w-full space-y-4">
                      {/* Fake Waveform Visualizer */}
                      <div className="w-full h-12 flex items-center gap-1 justify-center opacity-60">
                         {Array.from({length: 60}).map((_, i) => (
                           <div 
                             key={i} 
                             className={cn("w-1.5 bg-emerald-400 rounded-full", isPlaying && "animate-pulse")} 
                             style={{ 
                               height: `${Math.max(20, Math.random() * 100)}%`,
                               animationDelay: `${Math.random() * 1}s`,
                               animationDuration: `${0.5 + Math.random() * 0.5}s`
                             }} 
                           />
                         ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <div 
                          className="h-1 flex-1 bg-emerald-200/50 rounded-full relative cursor-pointer"
                          onClick={(e) => {
                            if (!audioRef.current || !durationSecs) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const newTime = (clickX / rect.width) * durationSecs;
                            audioRef.current.currentTime = newTime;
                            setCurrentTime(newTime);
                          }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full" style={{ width: `${durationSecs > 0 ? (currentTime / durationSecs) * 100 : 0}%` }} />
                          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full shadow pointer-events-none" style={{ left: `calc(${durationSecs > 0 ? (currentTime / durationSecs) * 100 : 0}% - 6px)` }} />
                        </div>
                        <span className="text-xs font-mono text-emerald-600 font-medium min-w-[95px] text-right">
                          {formatTime(currentTime)} / {durationSecs > 0 ? formatTime(durationSecs) : `${result.duration_minutes}:00`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content Grid */}
                {(() => {
                  const safeLng = Number.isFinite(mapCenter?.[0]) ? mapCenter[0] : 77.5946;
                  const safeLat = Number.isFinite(mapCenter?.[1]) ? mapCenter[1] : 12.9716;
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                      {/* Transcript Left Column */}
                      <div className="lg:col-span-2 bg-card/80 border border-border/70 rounded-[32px] p-8 md:p-10 space-y-6 overflow-y-auto max-h-[800px] shadow-sm backdrop-blur-xl">
                        {(result.narration || "").trim().startsWith('{"error"') || (result.narration || "").includes('model_not_found') ? (
                          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                            <p className="text-sm text-destructive font-medium">This previous session has an expired model response.</p>
                            <button
                              onClick={() => {
                                setResult(null);
                                setError(null);
                                setIsPlaying(false);
                              }}
                              className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
                            >
                              Generate Fresh Tour
                            </button>
                          </div>
                        ) : (
                          <div className="text-[15px] leading-relaxed text-foreground/90 space-y-5">
                            {result.narration.split("\n").map((line, i) =>
                              line.trim() ? (
                                <p key={i} className={i === 0 ? "bg-primary/10 text-primary font-medium rounded-xl p-3 -mx-2 border border-primary/20" : ""}>
                                  {line}
                                </p>
                              ) : null
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Map Right Column */}
                      <div className="space-y-4 flex flex-col h-[400px] lg:h-auto">
                        <div className="flex-1 rounded-[32px] overflow-hidden border border-border/80 bg-card/50 relative shadow-sm">
                          <MapComponent
                            className="absolute inset-0"
                            projection={{ type: "mercator" }}
                            viewport={{
                              center: [safeLng, safeLat],
                              zoom: 14,
                              pitch: 20,
                              bearing: 0
                            }}
                          >
                             <MapMarker longitude={safeLng} latitude={safeLat} color="#10b981">
                               <MapPin className="h-6 w-6 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                             </MapMarker>
                          </MapComponent>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {result.interests.map(tag => {
                            const Icon = INTEREST_OPTIONS.find(o => o.id === tag)?.icon || Sparkles;
                            const color = INTEREST_OPTIONS.find(o => o.id === tag)?.color || "text-emerald-500";
                            return (
                              <span key={tag} className="flex items-center gap-1.5 px-4 py-2 border border-border/70 bg-card text-foreground rounded-full text-xs font-semibold shadow-xs">
                                <Icon className={cn("h-3.5 w-3.5", color)} />
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
