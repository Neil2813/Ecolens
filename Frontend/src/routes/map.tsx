/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  User,
  AlertTriangle,
  X,
  Layers,
  Crosshair,
  MessageSquare,
  Leaf,
  ArrowLeft,
  Navigation,
  MapPin,
  Compass,
  Play,
  RotateCcw,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Award,
  Loader2,
  Volume2,
  VolumeX,
  Map,
  LayoutDashboard,
  Plus,
  Minus,
  Flame,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MobileShell } from "@/components/mobile-shell";
import {
  Map as MapComponent,
  MapRoute,
  MapMarker,
  MarkerContent,
  useMap,
  type MapRef,
} from "@/components/ui/map";
import { generateRoutes, type RouteOption } from "@/lib/api/routes";
import { isDemo, apiFetch } from "@/lib/api/client";
import { getStubbleFires, type StubbleHotspot } from "@/lib/api/env";

const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DARK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Helper for dynamic turn-by-turn directions based on progress
function getDirectionsInstruction(progress: number, pathLength: number) {
  if (pathLength === 0) return { text: "Proceed to destination", type: "straight" };

  const remainingSteps = pathLength - progress;
  if (remainingSteps <= 1) {
    return { text: "Arrived at your destination", type: "arrive" };
  }

  if (progress < 3) {
    const meters = Math.max(50, 250 - progress * 50);
    return { text: `In ${meters} meters, take a right onto Cubbon Rd`, type: "right" };
  } else if (progress < 7) {
    const meters = Math.max(50, 400 - (progress - 3) * 50);
    return { text: `In ${meters} meters, turn left toward Residency Rd`, type: "left" };
  } else {
    const meters = Math.max(50, 150 - (progress - 7) * 50);
    return { text: `In ${meters} meters, proceed straight to destination`, type: "straight" };
  }
}

// Helper to calculate Haversine distance between two coordinates in meters
function getDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find index of coordinates in path closest to current location
function findClosestPathIndex(coords: [number, number], path: [number, number][]): number {
  if (path.length === 0) return 0;
  let minDistance = Infinity;
  let closestIndex = 0;
  for (let i = 0; i < path.length; i++) {
    const dx = path[i][0] - coords[0];
    const dy = path[i][1] - coords[1];
    const distSq = dx * dx + dy * dy;
    if (distSq < minDistance) {
      minDistance = distSq;
      closestIndex = i;
    }
  }
  return closestIndex;
}

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Map Â· Ecolens" }] }),
  component: MapPage,
});

interface LocationSuggestion {
  name: string;
  address?: string;
  coords: [number, number];
  placeId?: string;
}

function readSavedNavigationState() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("ecolens:navigation_state");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);

  // Voice navigation control
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  const toggleVoice = () => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("ecolens:voice_enabled", String(next));
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  // Map settings
  const lightStyle = LIGHT_STYLE;
  const darkStyle = DARK_STYLE;

  // Saved navigation state (loaded post-hydration to prevent SSR mismatch)
  const [savedState, setSavedState] = useState<any>(null);

  // Location/Directions state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [originText, setOriginText] = useState<string>("My Location");
  const [destText, setDestText] = useState<string>("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);

  // Suggestion boxes
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [isRoutingMode, setIsRoutingMode] = useState<boolean>(false);
  const [isDirectionsExpanded, setIsDirectionsExpanded] = useState<boolean>(false);

  useEffect(() => {
    setMapReady(true);
    if (typeof window !== "undefined") {
      setVoiceEnabled(localStorage.getItem("ecolens:voice_enabled") !== "false");
      const saved = readSavedNavigationState();
      if (saved) {
        setSavedState(saved);
        if (saved.originText) setOriginText(saved.originText);
        if (saved.destText) setDestText(saved.destText);
        if (saved.originCoords) setOriginCoords(saved.originCoords);
        if (saved.destCoords) setDestCoords(saved.destCoords);
        if (saved.isRoutingMode !== undefined) setIsRoutingMode(saved.isRoutingMode);
        if (saved.isDirectionsExpanded || saved.isRoutingMode) {
          setIsDirectionsExpanded(saved.isDirectionsExpanded || saved.isRoutingMode);
        }
      }
    }
  }, []);

  // Dynamic suggestions states
  const [originSuggestions, setOriginSuggestions] = useState<LocationSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);

  // Debounced search for Origin suggestions using Backend Places Search API
  useEffect(() => {
    if (!originText || originText === "My Location" || originText.trim().length < 2) {
      setOriginSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingOrigin(true);
      try {
        const data = await apiFetch<any[]>(
          `/api/routes/search-places?q=${encodeURIComponent(originText)}`
        );
        const mapped = (data || []).map((item: any) => ({
          name: item.name,
          address: item.formatted_address,
          coords: [parseFloat(item.lng), parseFloat(item.lat)] as [number, number],
          placeId: item.place_id,
        }));
        setOriginSuggestions(mapped);
      } catch (err) {
        console.error("Places search origin query failed:", err);
      } finally {
        setLoadingOrigin(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [originText]);

  // Debounced search for Destination suggestions using Backend Places Search API
  useEffect(() => {
    if (!destText || destText.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingDest(true);
      try {
        const data = await apiFetch<any[]>(
          `/api/routes/search-places?q=${encodeURIComponent(destText)}`
        );
        const mapped = (data || []).map((item: any) => ({
          name: item.name,
          address: item.formatted_address,
          coords: [parseFloat(item.lng), parseFloat(item.lat)] as [number, number],
          placeId: item.place_id,
        }));
        setDestSuggestions(mapped);
      } catch (err) {
        console.error("Places search destination query failed:", err);
      } finally {
        setLoadingDest(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [destText]);

  // Selected Route Type
  const [routeType, setRouteType] = useState<string>(savedState?.routeType || "cleanest_air");

  // Navigation Simulation States
  const [isNavigating, setIsNavigating] = useState<boolean>(savedState?.isNavigating || false);
  const [navProgress, setNavProgress] = useState<number>(savedState?.navProgress || 0);
  const [navPath, setNavPath] = useState<[number, number][]>(savedState?.navPath || []);
  const [currentNavCoords, setCurrentNavCoords] = useState<[number, number] | null>(
    savedState?.currentNavCoords || null,
  );
  const [tripCompleted, setTripCompleted] = useState<boolean>(savedState?.tripCompleted || false);
  const [isSimulatedNav, setIsSimulatedNav] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("ecolens:simulated_nav");
    return saved !== null ? saved === "true" : true;
  });

  // Dynamic layers state
  const [layerOpen, setLayerOpen] = useState(true);
  const [activeLayers, setActiveLayers] = useState({
    air: false,
    stubble: false,
    carbon: false,
    heat: false,
    cloud: false,
    wind: false,
  });
  const [forecastHours, setForecastHours] = useState<number>(0);
  const [stubbleHotspots, setStubbleHotspots] = useState<StubbleHotspot[]>([]);

  // Fetch stubble fires when layer is enabled
  useEffect(() => {
    if (activeLayers.stubble && stubbleHotspots.length === 0) {
      const targetPt = userLocation || [77.5946, 12.9716];
      getStubbleFires(targetPt[1], targetPt[0]).then((res) => {
        if (res && res.hotspots) {
          setStubbleHotspots(res.hotspots);
        }
      });
    }
  }, [activeLayers.stubble, userLocation]);

  // Backend-fetched routes (null = not yet fetched)
  const [apiRoutes, setApiRoutes] = useState<RouteOption[] | null>(null);
  const [fetchingRoutes, setFetchingRoutes] = useState(false);
  const [activeHazards, setActiveHazards] = useState<any[]>([]);

  // Poll active hazards from the backend
  useEffect(() => {
    if (isDemo()) return;
    const fetchHazards = () => {
      apiFetch<any[]>("/api/alerts/active")
        .then((data) => {
          if (Array.isArray(data)) setActiveHazards(data);
        })
        .catch((err) => console.warn("Failed to fetch active alerts:", err));
    };
    fetchHazards();
    const interval = setInterval(fetchHazards, 20000); // 20s poll
    return () => clearInterval(interval);
  }, []);

  // Keep a stable ref to the selected API route so the nav interval doesn't
  // restart every render when apiRoutes/routeType changes.
  const selectedApiRouteRef = useRef<RouteOption | undefined>(undefined);

  // Live EcoScore for current user position
  const [liveEcoScore, setLiveEcoScore] = useState<number | null>(null);

  // PPO Scoring Simulation States
  const [ppoScoring, setPpoScoring] = useState(false);
  const [ppoProgress, setPpoProgress] = useState(0);

  // PPO Scoring telemetry simulation
  useEffect(() => {
    if (!ppoScoring || !originCoords || !destCoords) {
      setPpoProgress(0);
      return;
    }

    // Increment progress from 0 to 100 over 10 seconds (10000ms)
    // Every 100ms we add 1 to progress (total 100 ticks)
    const progressInterval = window.setInterval(() => {
      setPpoProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    const timeout = window.setTimeout(() => {
      setPpoScoring(false);
    }, 10000);

    return () => {
      window.clearInterval(progressInterval);
      window.clearTimeout(timeout);
    };
  }, [ppoScoring, originCoords, destCoords]);

  // Trip completion result from the calculate API
  const [tripResult, setTripResult] = useState<{
    ecoscore: number;
    pm25_avoided: number;
    co2_grams: number;
  } | null>(null);

  // Serialize state changes to localStorage.
  // NOTE: navPath is intentionally excluded — it's a large coordinate array
  // that would block the main thread if serialized every 2-second nav tick.
  // It is only saved when startNav() fires (below).
  useEffect(() => {
    if (destCoords) {
      const selectedRoute = apiRoutes?.find((r) => r.type === routeType);
      const fastestRoute = apiRoutes?.find((r) => r.type === "fastest");
      const pm25Avoided =
        selectedRoute && fastestRoute
          ? Math.max(0, Math.round(fastestRoute.pm25_exposure - selectedRoute.pm25_exposure))
          : 0;

      const state = {
        originText,
        originCoords,
        destText,
        destCoords,
        isRoutingMode,
        isDirectionsExpanded,
        routeType,
        isNavigating,
        navProgress,
        currentNavCoords,
        tripCompleted,
        durationMin: selectedRoute?.duration_min,
        distanceKm: selectedRoute?.distance_km,
        pm25Exposure: selectedRoute?.pm25_exposure,
        co2Grams: selectedRoute?.co2_grams,
        ecoscore: selectedRoute?.ecoscore,
        pm25Avoided,
        segmentIds: selectedRoute?.segment_ids,
      };
      localStorage.setItem("ecolens:navigation_state", JSON.stringify(state));
    } else {
      localStorage.removeItem("ecolens:navigation_state");
    }
  }, [
    originText,
    originCoords,
    destText,
    destCoords,
    isRoutingMode,
    isDirectionsExpanded,
    routeType,
    isNavigating,
    navProgress,
    currentNavCoords,
    tripCompleted,
    apiRoutes,
  ]);

  // Fetch real routes from the backend whenever origin + destination are set
  useEffect(() => {
    if (!destCoords || !originCoords) return;
    const origin = { lat: originCoords[1], lng: originCoords[0] };
    const destination = { lat: destCoords[1], lng: destCoords[0] };
    setFetchingRoutes(true);
    setApiRoutes(null);
    setPpoScoring(true); // Trigger PPO scoring simulation
    generateRoutes(origin, destination)
      .then((routes) => {
        if (routes.length > 0) {
          setApiRoutes(routes);
          const recommended = routes.find((r) => r.ppo_recommended || r.recommended);
          if (recommended) {
            setRouteType(recommended.type);
          } else {
            setRouteType(routes[0].type);
          }
        } else {
          setApiRoutes([]);
        }
      })
      .catch((err) => {
        console.warn("Route generation API error:", err);
        setApiRoutes([]);
      })
      .finally(() => setFetchingRoutes(false));
  }, [destCoords, originCoords]);

  // Request location on mount
  useEffect(() => {
    const cachedLat = localStorage.getItem("ecolens:last_lat");
    const cachedLon = localStorage.getItem("ecolens:last_lon");
    let hasCache = false;
    let initialCoords: [number, number] = [77.5946, 12.9716];

    if (cachedLat && cachedLon) {
      initialCoords = [parseFloat(cachedLon), parseFloat(cachedLat)];
      hasCache = true;
      setUserLocation(initialCoords);
      if (!savedState) {
        setOriginCoords(initialCoords);
      }
    }

    if ("geolocation" in navigator) {
      // First quick fetch
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coords);
          localStorage.setItem("ecolens:last_lat", String(pos.coords.latitude));
          localStorage.setItem("ecolens:last_lon", String(pos.coords.longitude));
          
          if (!savedState) {
            setOriginCoords(coords);
            mapRef.current?.flyTo({ center: coords, zoom: 15, duration: 1200 });
          }
        },
        (err) => {
          console.warn("High accuracy geolocation failed, trying fallback.", err);
          if (!hasCache) {
            setUserLocation(initialCoords);
            if (!savedState) setOriginCoords(initialCoords);
          }
        },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
      );

      // Continuous dynamic GPS location tracking
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coords);
          localStorage.setItem("ecolens:last_lat", String(pos.coords.latitude));
          localStorage.setItem("ecolens:last_lon", String(pos.coords.longitude));
          if (!savedState && !isNavigating) {
            setOriginCoords(coords);
          }
        },
        (err) => console.warn("GPS watch error:", err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      if (!hasCache) {
        setUserLocation(initialCoords);
        if (!savedState) setOriginCoords(initialCoords);
      }
    }
  }, []);

  // Fetch live EcoScore for user's current location
  useEffect(() => {
    if (!userLocation || isDemo()) return;
    const [lng, lat] = userLocation;
    const token = localStorage.getItem("ecolens:auth_token");
    if (!token) return;
    fetch(`/api/env/composite?lat=${lat}&lon=${lng}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.air_quality) return;
        const pm25 = data.air_quality.pm25 ?? 0;
        // Simple ecoscore from PM2.5: 100 at 0Âµg, 0 at 200Âµg
        setLiveEcoScore(Math.max(0, Math.min(100, Math.round(100 - pm25 / 2))));
      })
      .catch(() => {
        /* silent â€” EcoScore stays null */
      });
  }, [userLocation]);

  // Fly to active navigation or routing coordinates if saved state exists
  useEffect(() => {
    if (savedState) {
      const flyCenter =
        savedState.currentNavCoords || savedState.destCoords || savedState.originCoords;
      if (flyCenter) {
        const timer = setTimeout(() => {
          mapRef.current?.flyTo({
            center: flyCenter,
            zoom: savedState.isNavigating ? 16.5 : 13,
            pitch: savedState.isNavigating ? 50 : 45,
            duration: 1500,
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Handle Locating Button click
  const handleLocateMe = () => {
    if (userLocation) {
      mapRef.current?.flyTo({ center: userLocation, zoom: 15, duration: 1200 });
      setOriginCoords(userLocation);
      setOriginText("My Location");
    } else {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        setOriginCoords(coords);
        setOriginText("My Location");
        mapRef.current?.flyTo({ center: coords, zoom: 15, duration: 1200 });
      });
    }
  };

  const startPt = originCoords || userLocation || [77.5946, 12.9716];
  const endPt = destCoords;

  const selectedApiRoute = apiRoutes?.find((r) => r.type === routeType);
  // Keep the ref in sync so the nav interval can access it without being in deps
  selectedApiRouteRef.current = selectedApiRoute;
  const selectedPath = selectedApiRoute?.polyline?.length
    ? validCoords(selectedApiRoute.polyline)
    : [];
  const selectedDistanceKm = selectedApiRoute?.distance_km ?? 0;

  // Intersect route segment list with active hazard segment list
  const routeHasHazard = selectedApiRoute?.segment_ids?.some((sid) =>
    activeHazards.some((h) => h.segment_id === sid),
  );

  const activeDirection = getDirectionsInstruction(navProgress, navPath.length);

  // Trigger voice guidance when the instruction text changes
  useEffect(() => {
    if (isNavigating && !tripCompleted && activeDirection?.text && voiceEnabled) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(activeDirection.text);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeDirection?.text, isNavigating, tripCompleted, voiceEnabled]);

  // Select a suggestion
  const selectSuggestion = (type: "origin" | "dest", item: LocationSuggestion) => {
    if (type === "origin") {
      setOriginText(item.name);
      setOriginCoords(item.coords);
      setShowOriginSuggestions(false);
      mapRef.current?.flyTo({ center: item.coords, zoom: 14, duration: 1000 });
    } else {
      setDestText(item.name);
      setDestCoords(item.coords);
      setShowDestSuggestions(false);
      setIsRoutingMode(true);
      setIsDirectionsExpanded(false);
      mapRef.current?.flyTo({ center: item.coords, zoom: 13, duration: 1200 });
    }
  };

  // Save trip to database after navigation finishes; avoid blocking PPO route start.
  const saveTripToBackend = async (
    start: [number, number],
    end: [number, number],
    selectedRouteType: string,
    route: RouteOption | undefined,
  ) => {
    const token = localStorage.getItem("ecolens:auth_token");
    const isDemoMode = localStorage.getItem("ecolens:auth") === "demo";
    if (!token || isDemoMode) {
      console.log("Trip save skipped without an authenticated backend session.");
      return;
    }

    try {
      const response = await fetch("/api/exposure/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trip: {
            origin: { lat: start[1], lng: start[0] },
            destination: { lat: end[1], lng: end[0] },
            route_type: selectedRouteType,
            segment_ids: route?.segment_ids ?? [],
            segment_durations_sec:
              route?.segment_ids?.map(() =>
                Math.max(
                  30,
                  Math.round((route.duration_min * 60) / Math.max(1, route.segment_ids.length)),
                ),
              ) ?? [],
            started_at: new Date().toISOString(),
            ended_at: new Date(
              Date.now() + Math.max(1, route?.duration_min ?? 1) * 60000,
            ).toISOString(),
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Trip successfully saved to backend database!");
        setTripResult({
          ecoscore: result.ecoscore ?? 0,
          pm25_avoided: result.pm25_avoided ?? 0,
          co2_grams: result.co2_grams ?? 0,
        });
      } else {
        const err = await response.json();
        console.error("Failed to save trip to backend:", err);
      }
    } catch (err) {
      console.warn("Backend offline, could not save trip to backend:", err);
    }
  };

  // Start navigation simulation
  const startNav = () => {
    if (selectedPath.length === 0) return;

    setNavPath(selectedPath);
    setNavProgress(0);
    setCurrentNavCoords(selectedPath[0]);
    setIsNavigating(true);
    setTripCompleted(false);

    // Share navigation state instantly with the AR page
    const fastestRoute = apiRoutes?.find((r) => r.type === "fastest");
    const pm25Avoided =
      selectedApiRoute && fastestRoute
        ? Math.max(0, Math.round(fastestRoute.pm25_exposure - selectedApiRoute.pm25_exposure))
        : 0;

    const state = {
      originText,
      originCoords,
      destText,
      destCoords,
      isRoutingMode,
      isDirectionsExpanded,
      routeType,
      isNavigating: true,
      navProgress: 0,
      navPath: selectedPath,
      currentNavCoords: selectedPath[0],
      tripCompleted: false,
      durationMin: selectedApiRoute?.duration_min,
      distanceKm: selectedApiRoute?.distance_km,
      pm25Exposure: selectedApiRoute?.pm25_exposure,
      co2Grams: selectedApiRoute?.co2_grams,
      ecoscore: selectedApiRoute?.ecoscore,
      pm25Avoided,
      segmentIds: selectedApiRoute?.segment_ids,
    };
    localStorage.setItem("ecolens:navigation_state", JSON.stringify(state));

    mapRef.current?.flyTo({
      center: selectedPath[0],
      zoom: 16.5,
      pitch: 60,
      duration: 1000,
    });
  };

  // Stable refs so the interval callback never becomes stale while also
  // not triggering interval restarts on every render.
  const navPathRef = useRef<[number, number][]>(navPath);
  useEffect(() => {
    navPathRef.current = navPath;
  }, [navPath]);
  const routeTypeRef = useRef(routeType);
  useEffect(() => {
    routeTypeRef.current = routeType;
  }, [routeType]);
  const originCoordsRef = useRef(originCoords);
  useEffect(() => {
    originCoordsRef.current = originCoords;
  }, [originCoords]);
  const destCoordsRef = useRef(destCoords);
  useEffect(() => {
    destCoordsRef.current = destCoords;
  }, [destCoords]);
  const apiRoutesRef = useRef(apiRoutes);
  useEffect(() => {
    apiRoutesRef.current = apiRoutes;
  }, [apiRoutes]);

  // Simulated movement hook
  useEffect(() => {
    if (!isNavigating || tripCompleted || !isSimulatedNav) return;

    const interval = window.setInterval(() => {
      setNavProgress((prevProgress) => {
        const currentNavPath = navPathRef.current;
        if (currentNavPath.length === 0) return prevProgress;

        const nextProgress = prevProgress + 1;
        if (nextProgress >= currentNavPath.length) {
          clearInterval(interval);
          setTripCompleted(true);
          setIsNavigating(false);

          // Immediately show values from route data so the modal is never empty.
          // The async backend call will overwrite this with real saved data if it succeeds.
          const route = selectedApiRouteRef.current;
          if (route) {
            const fastestRoute = apiRoutesRef.current?.find((r) => r.type === "fastest");
            const fastestPm25 = fastestRoute?.pm25_exposure ?? route.pm25_exposure * 1.6;
            setTripResult({
              ecoscore: route.ecoscore,
              pm25_avoided: Math.max(0, Math.round(fastestPm25 - route.pm25_exposure)),
              co2_grams: Math.round(route.co2_grams),
            });
          }

          if (originCoordsRef.current && destCoordsRef.current) {
            void saveTripToBackend(
              originCoordsRef.current,
              destCoordsRef.current,
              routeTypeRef.current,
              selectedApiRouteRef.current,
            );
          }
          return prevProgress;
        }

        const nextCoords = currentNavPath[nextProgress];
        setCurrentNavCoords(nextCoords);
        mapRef.current?.easeTo({
          center: nextCoords,
          zoom: 16.5,
          duration: 1000,
        });

        return nextProgress;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isNavigating, tripCompleted, isSimulatedNav]);

  // Real GPS movement hook
  useEffect(() => {
    if (!isNavigating || tripCompleted || isSimulatedNav) return;

    if (!("geolocation" in navigator)) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const currentCoords: [number, number] = [pos.coords.longitude, pos.coords.latitude];

      // Update states
      setUserLocation(currentCoords);
      setCurrentNavCoords(currentCoords);

      const currentNavPath = navPathRef.current;
      if (currentNavPath.length > 0) {
        const closestIdx = findClosestPathIndex(currentCoords, currentNavPath);
        setNavProgress(closestIdx);
      }

      // Check if we arrived at destination
      if (destCoordsRef.current) {
        const distance = getDistanceMeters(currentCoords, destCoordsRef.current);
        if (distance <= 25) {
          // 25 meters threshold
          setTripCompleted(true);
          setIsNavigating(false);
          const route = selectedApiRouteRef.current;
          if (route) {
            const fastestRoute = apiRoutesRef.current?.find((r) => r.type === "fastest");
            const fastestPm25 = fastestRoute?.pm25_exposure ?? route.pm25_exposure * 1.6;
            setTripResult({
              ecoscore: route.ecoscore,
              pm25_avoided: Math.max(0, Math.round(fastestPm25 - route.pm25_exposure)),
              co2_grams: Math.round(route.co2_grams),
            });
          }

          if (originCoordsRef.current && destCoordsRef.current) {
            void saveTripToBackend(
              originCoordsRef.current,
              destCoordsRef.current,
              routeTypeRef.current,
              selectedApiRouteRef.current,
            );
          }
        }
      }

      // Smoothly center the map
      mapRef.current?.easeTo({
        center: currentCoords,
        zoom: 16.5,
        duration: 1000,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error("Error watching GPS location:", error);
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating, tripCompleted]);

  // Exit navigation
  const exitNavigation = () => {
    setIsNavigating(false);
    setTripCompleted(false);
    setNavProgress(0);
    setNavPath([]);
    setCurrentNavCoords(null);
    setIsRoutingMode(false);
    setDestCoords(null);
    setDestText("");
    setApiRoutes(null);
    setTripResult(null);
    localStorage.removeItem("ecolens:navigation_state");
    mapRef.current?.easeTo({ pitch: 60, zoom: 14, duration: 1000 });
  };
  const routeOptions = (apiRoutes ?? []).map((route, index) => ({
    id: route.type,
    label: route.label,
    duration: route.duration_min ?? 0,
    distance: route.distance_km ?? 0,
    pm25: Math.round(route.pm25_exposure ?? 0),
    co2: Math.round(route.co2_grams ?? 0),
    ecoscore: route.ecoscore ?? 0,
    lineColor: routeColor(route, index),
    recommended: route.recommended || route.ppo_recommended || false,
    forecastNote: route.forecast_note,
    warning: route.degradation_warning,
  }));

  return (
    <MobileShell>
      <div className="relative h-dvh md:h-[calc(100dvh-5rem)] min-h-[480px] overflow-hidden bg-background">
        {/* Real Map Component — mount client-side after layout is known */}
        {mapReady && (
          <MapComponent
            ref={mapRef}
            theme="light"
            center={userLocation || [77.5946, 12.9716]}
            zoom={15}
            pitch={60}
            className="absolute inset-0 h-full w-full min-h-[300px]"
            styles={{
              light: lightStyle,
              dark: darkStyle,
            }}
            attributionControl={false}
          >
            {/* User live location marker */}
            {userLocation && !isNavigating && (
              <MapMarker longitude={userLocation[0]} latitude={userLocation[1]}>
                <MarkerContent>
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-emerald-500/20" />
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-600 shadow-md shadow-emerald-600/50" />
                  </span>
                </MarkerContent>
              </MapMarker>
            )}

            {/* Start and Destination Markers */}
            {isRoutingMode && startPt && (
              <MapMarker longitude={startPt[0]} latitude={startPt[1]}>
                <MarkerContent>
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-lg">
                      <Navigation className="h-4 w-4 rotate-45" />
                    </span>
                    <span className="mt-1 rounded bg-white/90 px-1 py-0.5 text-[9px] border border-slate-200 shadow font-mono">
                      Start
                    </span>
                  </div>
                </MarkerContent>
              </MapMarker>
            )}

            {isRoutingMode && endPt && (
              <MapMarker longitude={endPt[0]} latitude={endPt[1]}>
                <MarkerContent>
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-white shadow-lg">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="mt-1 rounded bg-white/90 px-1 py-0.5 text-[9px] border border-slate-200 shadow font-mono">
                      End
                    </span>
                  </div>
                </MarkerContent>
              </MapMarker>
            )}

            {/* Navigation marker */}
            {isNavigating && currentNavCoords && (
              <MapMarker longitude={currentNavCoords[0]} latitude={currentNavCoords[1]}>
                <MarkerContent>
                  <span className="relative flex h-8 w-8 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-emerald-500/30" />
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md">
                      <Navigation className="h-3 w-3 fill-current" />
                    </span>
                  </span>
                </MarkerContent>
              </MapMarker>
            )}

            {/* Display backend route paths */}
            {isRoutingMode &&
              endPt &&
              !isNavigating &&
              !ppoScoring &&
              apiRoutes &&
              apiRoutes.map((apiRoute) => {
                const active = routeType === apiRoute.type;
                return (
                  <EnvironmentalRouteLine
                    key={`api-${apiRoute.type}`}
                    route={apiRoute}
                    active={active}
                    onClick={() => setRouteType(apiRoute.type)}
                  />
                );
              })}

            {/* Display Navigating Active Path */}
            {isNavigating &&
              validCoords(navPath).length > 0 &&
              (selectedApiRoute?.risk_segments?.length ? (
                <EnvironmentalRouteLine route={selectedApiRoute} active idPrefix="active-nav" />
              ) : null)}

            {/* Environmental Overlay Layers */}
            <EnvironmentalOverlays activeLayers={activeLayers} forecastHours={forecastHours} />

            {/* Stubble burning & NASA fire hotspots */}
            {activeLayers.stubble &&
              stubbleHotspots.map((spot) => (
                <MapMarker key={spot.id} longitude={spot.lon} latitude={spot.lat}>
                  <MarkerContent>
                    <div className="flex flex-col items-center cursor-pointer group">
                      <div className="flex items-center gap-1.5 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-xl ring-2 ring-white animate-bounce">
                        <Flame className="h-3 w-3" />
                        <span>{spot.distance_km}km</span>
                      </div>
                      <div className="mt-1 hidden group-hover:block rounded-xl bg-slate-900/90 p-2 text-left text-white shadow-xl backdrop-blur-xs w-48 text-[10px] pointer-events-auto">
                        <div className="font-bold text-rose-300">{spot.title}</div>
                        <div className="text-slate-300 mt-0.5">{spot.trajectory_status}</div>
                        <div className="text-slate-400 mt-0.5">
                          Plume: ~{spot.estimated_plume_arrival_hrs}h | FRP: {spot.fire_radiative_power_mw}MW
                        </div>
                      </div>
                    </div>
                  </MarkerContent>
                </MapMarker>
              ))}
          </MapComponent>
        )}

        {/* ==================== NORMAL MAP MODE HUD ==================== */}
        {!isNavigating && (
          <>
            {/* Top search & directions panel */}
            <div className="absolute left-4 top-4 z-20 w-[calc(100%-2rem)] max-w-[340px]">
              {!isDirectionsExpanded ? (
                /* SINGLE SEARCH BAR MODE */
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/50 bg-white/80 px-4 py-3 shadow-lg backdrop-blur-md">
                  <Search className="h-4 w-4 text-slate-500 ml-1" />
                  <input
                    type="text"
                    value={destText}
                    onChange={(e) => setDestText(e.target.value)}
                    onFocus={() => {
                      setIsDirectionsExpanded(true);
                      setShowDestSuggestions(true);
                      if (!originCoords && userLocation) {
                        setOriginCoords(userLocation);
                        setOriginText("My Location");
                      }
                    }}
                    placeholder="Where are you going?"
                    className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    suppressHydrationWarning
                  />
                  {destText && (
                    <button
                      onClick={() => {
                        setDestText("");
                        setDestCoords(null);
                        setIsRoutingMode(false);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                      suppressHydrationWarning
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="h-5 w-[1px] bg-slate-200" />
                  <button
                    onClick={() => {
                      setIsDirectionsExpanded(true);
                    }}
                    className="p-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                    suppressHydrationWarning
                  >
                    <Navigation className="h-4 w-4 fill-current rotate-45" />
                  </button>
                </div>
              ) : (
                /* EXPANDED DIRECTIONS MODE (TWO INPUTS) */
                <div className="rounded-3xl border border-white/35 bg-white/70 p-5 shadow-xl backdrop-blur-lg flex flex-col gap-4 text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-slate-800 font-sans">
                      Plan EcoRoute
                    </span>
                    <div className="flex items-center gap-2">
                      {fetchingRoutes && (
                        <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                          Loading...
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setIsDirectionsExpanded(false);
                          setIsRoutingMode(false);
                          setDestCoords(null);
                          setDestText("");
                        }}
                        className="p-1.5 hover:bg-slate-100/50 rounded-full text-slate-600 hover:text-slate-800 transition-colors"
                        suppressHydrationWarning
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Origin input capsule */}
                    <div className="relative flex items-center gap-3 rounded-xl bg-white border border-slate-200/80 px-4 py-2.5 shadow-xs">
                      <Navigation className="h-4 w-4 text-slate-600 rotate-45" />
                      <input
                        type="text"
                        value={originText}
                        onFocus={() => {
                          setShowOriginSuggestions(true);
                          setShowDestSuggestions(false);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowOriginSuggestions(false), 250);
                        }}
                        onChange={(e) => {
                          setOriginText(e.target.value);
                          setShowOriginSuggestions(true);
                        }}
                        placeholder="Enter start location..."
                        className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 font-sans"
                        suppressHydrationWarning
                      />
                      {originText && originText !== "My Location" && (
                        <X
                          className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-600"
                          onClick={() => {
                            setOriginText("");
                            setOriginCoords(null);
                          }}
                        />
                      )}
                    </div>

                    {/* Destination input capsule */}
                    <div className="relative flex items-center gap-3 rounded-xl bg-white border border-slate-200/80 px-4 py-2.5 shadow-xs">
                      <MapPin className="h-4 w-4 text-slate-600" />
                      <input
                        type="text"
                        value={destText}
                        onFocus={() => {
                          setShowDestSuggestions(true);
                          setShowOriginSuggestions(false);
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowDestSuggestions(false), 250);
                        }}
                        onChange={(e) => {
                          setDestText(e.target.value);
                          setShowDestSuggestions(true);
                        }}
                        placeholder="Search destination..."
                        className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 font-sans"
                        suppressHydrationWarning
                      />
                      {destText && (
                        <X
                          className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-600"
                          onClick={() => {
                            setDestText("");
                            setDestCoords(null);
                            setIsRoutingMode(false);
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Swap button helper */}
                  {isRoutingMode && (
                    <div className="flex justify-end -mt-1">
                      <button
                        onClick={() => {
                          const tempText = originText;
                          const tempCoords = originCoords;
                          setOriginText(destText);
                          setOriginCoords(destCoords);
                          setDestText(tempText);
                          setDestCoords(tempCoords as [number, number]);
                        }}
                        className="flex items-center gap-1 font-mono text-[9px] text-emerald-600 hover:underline"
                        suppressHydrationWarning
                      >
                        <RefreshCw className="h-3 w-3" /> Swap Locations
                      </button>
                    </div>
                  )}

                  {/* Suggestion Dropdown: Start / Origin */}
                  {showOriginSuggestions &&
                    originText.trim().length >= 2 &&
                    originText !== "My Location" && (
                      <div className="mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200/50 bg-white/95 p-2 shadow-xl pointer-events-auto flex flex-col gap-1">
                        {loadingOrigin && (
                          <div className="px-3 py-2 text-xs text-slate-500 font-sans">
                            Searching...
                          </div>
                        )}
                        {!loadingOrigin && originSuggestions.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500 font-mono">
                            No matching locations found
                          </div>
                        )}
                        {originSuggestions.map((item, idx) => (
                          <button
                            key={"origin-" + idx}
                            onClick={() => selectSuggestion("origin", item)}
                            className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-slate-800 transition-colors"
                          >
                            <MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate text-slate-800">{item.name}</div>
                              {item.address && (
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.address}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Suggestion Dropdown: Destination */}
                  {showDestSuggestions && destText.trim().length >= 2 && (
                    <div className="mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200/50 bg-white/95 p-2 shadow-xl pointer-events-auto flex flex-col gap-1">
                      {loadingDest && (
                        <div className="px-3 py-2 text-xs text-slate-500 font-sans">Searching...</div>
                      )}
                      {!loadingDest && destSuggestions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-500 font-mono">
                          No matching locations found
                        </div>
                      )}
                      {destSuggestions.map((item, idx) => (
                        <button
                          key={"dest-" + idx}
                          onClick={() => selectSuggestion("dest", item)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 text-slate-800 transition-colors"
                        >
                          <MapPin className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate text-slate-800">{item.name}</div>
                            {item.address && (
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.address}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Left side panel: EcoScore Indicator */}
            {liveEcoScore != null && (
              <div className="absolute left-4 top-[440px] z-10 flex flex-col gap-3 pointer-events-auto">
                <div
                  className="flex h-14 w-16 flex-col items-center justify-center rounded-2xl border border-white/35 bg-white/70 text-slate-800 shadow-lg backdrop-blur-md"
                  title={`Current Location EcoScore: ${liveEcoScore}`}
                >
                  <span className="text-lg font-bold text-emerald-600 leading-none">
                    {liveEcoScore}
                  </span>
                  <span className="text-[7px] font-mono font-semibold uppercase text-slate-500 leading-none mt-1.5">
                    EcoScore
                  </span>
                </div>
              </div>
            )}

            {/* Quick Floating Map Utilities (Right side) */}
            <div className="absolute right-4 bottom-24 z-20 flex flex-col gap-2.5 items-end">
              {/* Environment Overlay Sub-Panel */}
              {layerOpen && (
                <div className="w-[180px] rounded-3xl border border-white/35 bg-white/70 p-4 shadow-xl backdrop-blur-lg flex flex-col gap-3.5 text-slate-800 animate-in slide-in-from-right-4 duration-200">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-600 animate-pulse" />
                    <span>Map Overlays</span>
                  </div>
                  <div className="flex flex-col gap-3 font-sans">
                    {Object.entries({
                      air: { label: "Air Quality", color: "border-emerald-500 text-emerald-500 bg-emerald-500" },
                      stubble: { label: "Stubble Fires", color: "border-rose-500 text-rose-500 bg-rose-500" },
                      carbon: { label: "Carbon", color: "border-blue-500 text-blue-500 bg-blue-500" },
                      heat: { label: "Temperature", color: "border-orange-500 text-orange-500 bg-orange-500" },
                      wind: { label: "Wind", color: "border-cyan-500 text-cyan-500 bg-cyan-500" },
                    }).map(([key, info]) => {
                      const active = activeLayers[key as keyof typeof activeLayers];
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setActiveLayers((prev) => {
                              const next = {
                                air: false,
                                stubble: false,
                                carbon: false,
                                heat: false,
                                cloud: false,
                                wind: false,
                              };
                              next[key as keyof typeof activeLayers] = !active;
                              return next;
                            })
                          }
                          className="flex cursor-pointer items-center gap-3 text-left transition-colors"
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${info.color.split(" ")[0]}`}>
                            {active && (
                              <span className={`w-2 h-2 rounded-full ${info.color.split(" ")[2]}`} />
                            )}
                          </span>
                          <span className="font-sans text-xs text-slate-700 font-medium">{info.label}</span>
                        </button>
                      );
                    })}
                    {Object.values(activeLayers).some(Boolean) && (
                      <div className="mt-2 border-t border-slate-200/50 pt-3">
                        <div className="mb-1.5 font-mono text-[8px] uppercase tracking-wider text-slate-500 flex justify-between">
                          <span>Forecast View</span>
                          <span className="text-emerald-600 font-bold">
                            {forecastHours === 0 ? "Now" : `+${forecastHours}h`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="48"
                          step="2"
                          value={forecastHours}
                          onChange={(e) => setForecastHours(parseInt(e.target.value))}
                          className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                        />
                        <div className="flex justify-between font-mono text-[7px] text-slate-400 mt-1">
                          <span>Now</span>
                          <span>+24h</span>
                          <span>+48h</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Zoom Buttons vertical pill */}
              <div className="flex flex-col rounded-xl border border-slate-200/50 bg-white/90 shadow-md divide-y divide-slate-100 overflow-hidden shrink-0">
                <button
                  onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
                  className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                  title="Zoom In"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
                  className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                  title="Zoom Out"
                >
                  <Minus className="h-5 w-5" />
                </button>
              </div>

              {/* Recenter / Refresh FAB */}
              <button
                onClick={handleLocateMe}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200/50 bg-white/90 shadow-md text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shrink-0"
                title="Recenter Map"
                suppressHydrationWarning
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>

            {/* BOTTOM SHEET: Routes list overlay if destination selected */}
            {isRoutingMode && endPt && !ppoScoring && (
              <div
                className="absolute inset-x-4 bottom-24 z-20 rounded-3xl border border-white/35 bg-white/80 shadow-2xl backdrop-blur-lg flex flex-col text-slate-800"
                style={{ maxHeight: "40%" }}
              >
                {/* Fixed header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-4 pb-3 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800 font-sans">Recommended Routes</h3>
                  {fetchingRoutes && (
                    <span className="flex items-center gap-1 font-mono text-[9px] text-emerald-600">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                      Loading...
                    </span>
                  )}
                </div>

                {/* Scrollable route cards */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 scrollbar-hide">
                  {!fetchingRoutes && routeOptions.length === 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
                      Could not load routes from the backend.
                    </div>
                  )}
                  {routeOptions.map((opt) => {
                    const active = routeType === opt.id;
                    const stripColor = opt.recommended
                      ? "bg-emerald-500"
                      : opt.id === "cleanest_air" || opt.id === "lowest_exposure"
                        ? "bg-emerald-500"
                        : opt.id === "lowest_carbon"
                          ? "bg-blue-500"
                          : opt.id === "highest_safety"
                            ? "bg-purple-500"
                            : "bg-orange-500";
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setRouteType(opt.id)}
                        className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? "border-emerald-500 bg-white/90 shadow-sm"
                            : "border-slate-100 bg-white/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${stripColor}`} />
                          <span className="text-xs font-semibold text-slate-800 flex-1">{opt.label}</span>
                          {opt.recommended && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-emerald-600 font-bold border border-emerald-200">
                              Recommended by PPO
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              opt.ecoscore >= 70
                                ? "bg-emerald-100 text-emerald-700"
                                : opt.ecoscore >= 45
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {opt.ecoscore}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 ml-4">
                          <div>
                            {formatDuration(opt.duration)} ·{" "}
                            {opt.distance.toFixed(opt.distance >= 100 ? 0 : 1)} km
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5">
                              <Leaf className="h-3 w-3 text-emerald-600" /> {opt.pm25}µg
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Award className="h-3 w-3 text-blue-600" /> {opt.co2}g
                            </span>
                          </div>
                        </div>
                        {opt.warning && (
                          <div className="ml-4 rounded-full bg-orange-100 px-2 py-0.5 font-mono text-[9px] uppercase text-orange-700 w-fit">
                            {opt.warning}
                          </div>
                        )}
                        {opt.forecastNote && (
                          <p className="ml-4 text-[10px] leading-snug text-slate-500">
                            {opt.forecastNote}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {routeHasHazard && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 flex items-start gap-2 animate-in fade-in duration-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
                      <div className="flex-1 leading-normal text-slate-700 text-xs">
                        <strong className="block font-mono text-[9px] uppercase tracking-wider mb-0.5 text-red-600">
                          Intelligent Re-routing Suggestion
                        </strong>
                        Critical pollution spike detected along this path. We recommend choosing the{" "}
                        <strong>Lowest Exposure</strong> route to bypass toxic exposure hotspots.
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Start Navigation button with Simulation Toggle — always visible */}
                <div className="shrink-0 px-4 pb-4 pt-2.5 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Play className="h-3.5 w-3.5 text-emerald-600" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">Simulate Drive</span>
                        <span className="text-[9px] text-slate-500">
                          {isSimulatedNav ? "Auto-step route simulation" : "Live GPS device tracking"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSimulatedNav((prev) => {
                          const next = !prev;
                          localStorage.setItem("ecolens:simulated_nav", String(next));
                          return next;
                        });
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                        isSimulatedNav ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                          isSimulatedNav ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={startNav}
                    disabled={selectedPath.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700"
                  >
                    <Navigation className="h-4 w-4 fill-current" />
                    {selectedPath.length === 0
                      ? "Loading route…"
                      : isSimulatedNav
                        ? "Start Simulation"
                        : "Start Navigation (Real GPS)"}
                  </button>
                </div>
              </div>
            )}

            {/* PPO SCORING ANIMATION OVERLAY */}
            {isRoutingMode && endPt && ppoScoring && (
              <div
                className="absolute inset-x-4 bottom-24 z-20 rounded-3xl border border-white/35 bg-white/80 p-5 shadow-2xl backdrop-blur-lg flex flex-col pointer-events-auto text-slate-800"
                style={{ height: "350px" }}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-50 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-50"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      AI Route Optimization
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-500 uppercase">
                    Agent: Ecolens-RL-v4
                  </span>
                </div>

                {/* Description */}
                <p className="mt-2 text-xs text-slate-500 leading-normal shrink-0">
                  Evaluating live air quality levels, carbon emissions, and microclimate indices to
                  converge on the healthiest route.
                </p>

                {/* Step List Container */}
                <div className="mt-4 flex-1 flex flex-col gap-3 min-h-0 justify-center">
                  {[
                    {
                      label: "Analyzing environmental layers (AQI, Heat, Carbon)",
                      start: 0,
                      end: 20,
                    },
                    {
                      label: "Sampling commute paths on the urban street graph",
                      start: 20,
                      end: 40,
                    },
                    {
                      label: "Running PPO policy optimizer (reward iterations)",
                      start: 40,
                      end: 60,
                    },
                    {
                      label: "Applying exposure and traffic safety constraints",
                      start: 60,
                      end: 80,
                    },
                    { label: "Compiling optimal greenway routes", start: 80, end: 100 },
                  ].map((step, idx) => {
                    const isCompleted = ppoProgress >= step.end;
                    const isActive = ppoProgress >= step.start && ppoProgress < step.end;

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 animate-in fade-in duration-200"
                      >
                        {isCompleted ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle className="h-3 w-3" />
                          </span>
                        ) : isActive ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <Loader2 className="h-3 w-3 animate-spin" />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          </span>
                        )}
                        <span
                          className={`text-[11px] leading-tight transition-colors ${
                            isCompleted
                              ? "text-slate-700 font-medium"
                              : isActive
                                ? "text-emerald-600 font-semibold"
                                : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Neural Net Metrics Grid */}
                <div className="mt-3 grid grid-cols-3 gap-2 shrink-0 border-t border-slate-100 pt-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-center">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-slate-500">
                      Entropy
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-slate-700">
                      {(1.42 - ppoProgress * 0.009).toFixed(3)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-center border-emerald-100">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-slate-500">
                      KL Div
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-emerald-600">
                      {(0.001 + ppoProgress * 0.00005).toFixed(5)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-center">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-slate-500">
                      Critic Loss
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-red-500">
                      {Math.max(0.005, 0.124 - ppoProgress * 0.0012).toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 shrink-0">
                  <div className="flex justify-between font-mono text-[9px] text-slate-500 mb-1">
                    <span className="animate-pulse">Optimizing trajectories...</span>
                    <span>{ppoProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${ppoProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== ACTIVE NAVIGATION HUD OVERLAYS ==================== */}
        {isNavigating && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(6rem,env(safe-area-inset-bottom))]">
            {/* Top directions instruction card */}
            {(() => {
              const direction = activeDirection;
              return (
                <div className="w-full rounded-2xl border border-white/35 bg-white/80 p-4 shadow-xl backdrop-blur-lg pointer-events-auto flex items-center gap-3 animate-in slide-in-from-top duration-300 text-slate-800">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition-all duration-300">
                    {direction.type === "right" ? (
                      <Navigation className="h-5 w-5 fill-current rotate-90" />
                    ) : direction.type === "left" ? (
                      <Navigation className="h-5 w-5 fill-current -rotate-90" />
                    ) : direction.type === "arrive" ? (
                      <MapPin className="h-5 w-5" />
                    ) : (
                      <Navigation className="h-5 w-5 fill-current" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                      Upcoming turn
                    </span>
                    <div className="text-xs font-semibold leading-tight text-slate-800 truncate">
                      {direction.text}
                    </div>
                  </div>
                  <button
                    onClick={exitNavigation}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                    title="Exit navigation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={toggleVoice}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                      voiceEnabled
                        ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                    }`}
                    title={voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <Link
                    to="/assistant"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    title="Switch to AI Assistant"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })()}

            {/* Bottom active HUD sheet */}
            <div className="w-full rounded-2xl border border-white/35 bg-white/80 p-4 shadow-xl backdrop-blur-lg pointer-events-auto flex flex-col gap-3 text-slate-800">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-600 animate-pulse">
                    ● Navigating
                  </span>
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-[9px] text-slate-700 font-semibold">
                    {isSimulatedNav ? "⚡ Simulation" : "📍 Real GPS"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {routeType.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <Link
                  to="/assistant"
                  className="flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  AI Assistant
                </Link>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-800">
                    {selectedApiRoute
                      ? `${Math.max(1, Math.round(selectedApiRoute.duration_min * (1 - navProgress / Math.max(1, navPath.length))))} min remaining`
                      : "— min remaining"}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase">
                    {selectedApiRoute
                      ? `${(selectedApiRoute.distance_km * (1 - navProgress / Math.max(1, navPath.length))).toFixed(1)} km left`
                      : "— km left"}
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    PM2.5 Exposure
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Leaf className="h-4 w-4" />
                    {selectedApiRoute ? `${Math.round(selectedApiRoute.pm25_exposure)} µg` : "—"}
                  </div>
                </div>
              </div>

              {/* Progress bar of trip */}
              <div className="relative h-1.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                <div
                  className="h-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${(navProgress / navPath.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TRIP SUMMARY COMPLETION MODAL */}
        {tripCompleted && (
          <div className="absolute inset-0 z-40 bg-slate-900/40 flex items-center justify-center p-6 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl border border-white/35 bg-white/90 p-6 shadow-2xl text-center flex flex-col gap-4 animate-in zoom-in-95 duration-300 text-slate-800">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle className="h-10 w-10" />
              </span>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Trip Completed!</h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Ecolens Carbon Summary
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-4 my-2">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-emerald-600">
                    {tripResult != null ? tripResult.ecoscore : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-slate-500">
                    EcoScore
                  </span>
                </div>
                <div className="flex flex-col items-center border-x border-slate-100">
                  <span className="text-lg font-bold text-emerald-600">
                    {tripResult != null ? `${tripResult.pm25_avoided.toFixed(0)} µg` : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-slate-500">
                    PM2.5 Saved
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-blue-600">
                    {tripResult != null ? `${tripResult.co2_grams.toFixed(0)} g` : "—"}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-slate-500">
                    CO₂ Saved
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                {tripResult != null
                  ? `Great work! Your ${routeType.replace("_", " ")} route earned you an EcoScore of ${tripResult.ecoscore}.`
                  : "Trip data is being processed. Check your dashboard for updated stats."}
              </p>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={exitNavigation}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    exitNavigation();
                    navigate({ to: "/dashboard" });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                >
                  <Award className="h-4 w-4" /> Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MobileShell>
  );
}
const ENV_NUMERIC_DEFAULTS: Record<string, number> = {
  pm25: 50,
  no2: 20,
  co2_per_min: 1.5,
  ndvi: 0.5,
  noise_db: 55,
  heat_anomaly: 1.0,
  cloud_cover: 30,
  wind_speed: 5.0,
};

function isValidCoordPair(coord: unknown): coord is [number, number] {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === "number" &&
    typeof coord[1] === "number" &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1])
  );
}

function validCoords(coords: [number, number][]): [number, number][] {
  return coords.filter(isValidCoordPair);
}

/**
 * Returns a hex colour for a route card/polyline based on route type and index.
 * Green = cleanest air, Blue = lowest carbon, Orange = fastest.
 */
function routeColor(route: { type?: string; ppo_recommended?: boolean }, index: number): string {
  if (route?.ppo_recommended) return "#10b981"; // emerald for PPO pick!
  if (route?.type === "cleanest_air") return "#22c55e"; // eco-green
  if (route?.type === "lowest_carbon") return "#3b82f6"; // eco-blue
  if (route?.type === "fastest") return "#f97316"; // eco-orange
  const palette = ["#3b82f6", "#f97316", "#a855f7"];
  return palette[index % palette.length];
}

function nearestRoutePointIndex(route: [number, number][], point: [number, number]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  route.forEach(([lng, lat], index) => {
    const distance = (lng - point[0]) ** 2 + (lat - point[1]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** Format decimal minutes → "X h Y min" or "Y min" */
function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

/**
 * Renders a MapRoute polyline per backend route.
 * Colours each segment green/orange/red based on environmental risk data (like Google Maps traffic).
 */
function EnvironmentalRouteLine({
  route,
  active,
  idPrefix,
  onClick,
}: {
  route: import("@/lib/api/routes").RouteOption;
  active: boolean;
  idPrefix?: string;
  onClick?: () => void;
}) {
  const prefix = idPrefix ?? `route-${route.type}`;

  // If the route has risk_segments, render each segment with its own environmental colour.
  if (route.risk_segments && route.risk_segments.length > 0) {
    return (
      <>
        {route.risk_segments.map((seg: any, i: number) => {
          const coords: [number, number][] = validCoords(seg.coordinates ?? []);
          if (coords.length < 2) return null;
          // Determine colour from segment risk level (mirrors Google Maps green/orange/red traffic)
          // risk_segments use: "safe" | "moderate" | "worst" — see routes.ts
          let color = "#22c55e"; // green = safe
          if (seg.risk === "moderate" || seg.score < 60) color = "#f97316"; // orange
          if (seg.risk === "worst" || seg.score < 30) color = "#ef4444"; // red
          return (
            <MapRoute
              key={`${prefix}-seg-${i}`}
              id={`${prefix}-seg-${i}`}
              coordinates={coords}
              color={color}
              width={active ? 6 : 4}
              opacity={active ? 0.95 : 0.65}
              onClick={onClick}
            />
          );
        })}
      </>
    );
  }

  return null;
}

function sanitizeEnvironmentFeatures(data: any) {
  if (!data?.features) {
    return { type: "FeatureCollection" as const, features: [] };
  }

  const features: any[] = [];
  data.features.forEach((feature: any) => {
    const coords = (feature.geometry?.coordinates ?? []).filter(isValidCoordPair);
    if (coords.length < 2) return;

    const props = { ...(feature.properties ?? {}) };
    for (const [key, defaultValue] of Object.entries(ENV_NUMERIC_DEFAULTS)) {
      const value = props[key];
      if (value == null || typeof value !== "number" || !Number.isFinite(value)) {
        props[key] = defaultValue;
      }
    }

    // Add points along the line string to create density for the heatmap
    coords.forEach((coord: [number, number]) => {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: props,
      });
    });

    // Also add midpoints for extra smoothness
    if (coords.length >= 2) {
      for (let i = 0; i < coords.length - 1; i++) {
        const mid: [number, number] = [
          (coords[i][0] + coords[i + 1][0]) / 2,
          (coords[i][1] + coords[i + 1][1]) / 2,
        ];
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: mid },
          properties: props,
        });
      }
    }
  });

  return {
    type: "FeatureCollection" as const,
    features,
    ...(data.updated_at ? { updated_at: data.updated_at } : {}),
  };
}

function isMapStyleReady(map: { getStyle: () => unknown } | null) {
  if (!map) return false;
  try {
    return !!map.getStyle();
  } catch {
    return false;
  }
}

function envNumericExpr(property: string, defaultValue: number) {
  return ["coalesce", ["to-number", ["get", property], defaultValue], defaultValue];
}

interface EnvironmentalOverlaysProps {
  activeLayers: {
    air: boolean;
    carbon: boolean;
    heat: boolean;
    cloud: boolean;
    wind: boolean;
  };
  forecastHours: number;
}

function EnvironmentalOverlays({ activeLayers, forecastHours }: EnvironmentalOverlaysProps) {
  const { map, isLoaded } = useMap();
  const [features, setFeatures] = useState<any>(null);

  // Get active layer key
  const activeKey = Object.keys(activeLayers).find(
    (key) => activeLayers[key as keyof typeof activeLayers],
  ) as "air" | "carbon" | "heat" | "cloud" | "wind" | undefined;

  useEffect(() => {
    if (!isLoaded || !map || !activeKey) {
      setFeatures(null);
      return;
    }

    const fetchFeatures = async () => {
      const bounds = map.getBounds();
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

      const layerMap = {
        air: "pm25,no2",
        carbon: "co2_per_min,carbon_intensity",
        heat: "heat_anomaly",
        cloud: "cloud_cover",
        wind: "wind_speed",
      };

      try {
        const url = `/api/tiles/environment?bbox=${bbox}&layers=${layerMap[activeKey]}&forecast_hours=${forecastHours}`;
        const data = await apiFetch<any>(url);
        setFeatures(sanitizeEnvironmentFeatures(data));
      } catch (err) {
        console.warn("Failed to fetch environmental overlay features:", err);
      }
    };

    fetchFeatures();

    const handleMove = () => {
      fetchFeatures();
    };

    map.on("moveend", handleMove);
    return () => {
      map.off("moveend", handleMove);
    };
  }, [isLoaded, map, activeKey, forecastHours]);

  if (!features || !features.features || features.features.length === 0 || !activeKey) {
    return null;
  }

  return (
    <MapEnvironmentalLayer id={`env-layer-${activeKey}`} data={features} activeKey={activeKey} />
  );
}

interface MapEnvironmentalLayerProps {
  id: string;
  data: any;
  activeKey: "air" | "carbon" | "heat" | "cloud" | "wind";
}

function MapEnvironmentalLayer({ id, data, activeKey }: MapEnvironmentalLayerProps) {
  const { map, isLoaded } = useMap();
  const sourceId = `${id}-source`;
  const layerId = `${id}-heatmap`;

  useEffect(() => {
    if (!isLoaded || !map || !data) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: data,
      });
    } else {
      const source = map.getSource(sourceId) as { setData?: (data: unknown) => void };
      source.setData?.(data);
    }

    let weightExpr: unknown;
    let colorExpr: unknown;

    if (activeKey === "air") {
      weightExpr = ["interpolate", ["linear"], ["get", "pm25"], 10, 0.1, 180, 1.0];
      colorExpr = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(34, 197, 94, 0)",
        0.15,
        "rgba(34, 197, 94, 0.35)",
        0.4,
        "rgba(234, 179, 8, 0.55)",
        0.65,
        "rgba(249, 115, 22, 0.7)",
        0.85,
        "rgba(239, 68, 68, 0.8)",
        1.0,
        "rgba(236, 72, 153, 0.9)",
      ];
    } else if (activeKey === "carbon") {
      weightExpr = ["interpolate", ["linear"], ["get", "co2_per_min"], 0.5, 0.1, 6.0, 1.0];
      colorExpr = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(59, 130, 246, 0)",
        0.2,
        "rgba(59, 130, 246, 0.35)",
        0.5,
        "rgba(96, 165, 250, 0.55)",
        0.8,
        "rgba(168, 85, 247, 0.75)",
        1.0,
        "rgba(236, 72, 153, 0.9)",
      ];
    } else if (activeKey === "heat") {
      weightExpr = ["interpolate", ["linear"], ["get", "heat_anomaly"], 0.1, 0.1, 4.0, 1.0];
      colorExpr = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(253, 224, 71, 0)",
        0.2,
        "rgba(253, 224, 71, 0.35)",
        0.5,
        "rgba(249, 115, 22, 0.6)",
        0.8,
        "rgba(239, 68, 68, 0.8)",
        1.0,
        "rgba(153, 27, 27, 0.9)",
      ];
    } else if (activeKey === "cloud") {
      weightExpr = ["interpolate", ["linear"], ["get", "cloud_cover"], 20, 0.1, 90, 1.0];
      colorExpr = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(203, 213, 225, 0)",
        0.3,
        "rgba(203, 213, 225, 0.35)",
        0.6,
        "rgba(148, 163, 184, 0.55)",
        0.9,
        "rgba(71, 85, 105, 0.75)",
        1.0,
        "rgba(30, 41, 59, 0.85)",
      ];
    } else if (activeKey === "wind") {
      weightExpr = ["interpolate", ["linear"], ["get", "wind_speed"], 2.0, 0.1, 27.0, 1.0];
      colorExpr = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(34, 211, 238, 0)",
        0.2,
        "rgba(34, 211, 238, 0.35)",
        0.5,
        "rgba(14, 165, 233, 0.55)",
        0.8,
        "rgba(37, 99, 235, 0.75)",
        1.0,
        "rgba(79, 70, 229, 0.85)",
      ];
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "heatmap",
        source: sourceId,
        paint: {
          "heatmap-weight": weightExpr as any,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3] as any,
          "heatmap-color": colorExpr as any,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 15, 35] as any,
          "heatmap-opacity": 0.75,
        },
      });
    } else {
      map.setPaintProperty(layerId, "heatmap-weight", weightExpr);
      map.setPaintProperty(layerId, "heatmap-color", colorExpr);
    }

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore
      }
    };
  }, [isLoaded, map, data, sourceId, layerId, activeKey]);

  return null;
}
