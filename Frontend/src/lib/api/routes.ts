/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { apiFetch } from "./client";

export interface RouteOption {
  rank?: number;
  route_id?: string;
  type: string;
  label: string;
  duration_min: number;
  distance_km: number;
  pm25_exposure: number;
  co2_grams: number;
  ecoscore: number;
  ecoscore_now?: number;
  ecoscore_t10?: number;
  ecoscore_t20?: number;
  ecoscore_t30?: number;
  heat_score?: number;
  noise_db?: number;
  current_users_on_route?: number;
  ppo_recommended?: boolean;
  degradation_warning?: string | null;
  forecast_note?: string | null;
  risk_segments?: {
    coordinates: [number, number][];
    risk: "safe" | "moderate" | "worst";
    color: string;
    score: number;
  }[];
  /** Array of [lng, lat] coordinate pairs forming the route polyline */
  polyline: [number, number][];
  segment_ids: string[];
  recommended: boolean;
}

export interface GenerateRoutesResponse {
  routes: RouteOption[];
  recommended_index?: number;
  total_routes_found?: number;
  routes_shown?: number;
  load_distribution_active?: boolean;
  city_avg_pm25_now?: number;
  city_avg_pm25_t10?: number;
  generated_at?: string;
}

export async function generateRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteOption[]> {
  const data = await apiFetch<GenerateRoutesResponse | RouteOption[]>("/api/routes/generate", {
    method: "POST",
    body: JSON.stringify({ origin, destination }),
  });
  // Backend may return { routes: [...] } or directly an array
  if (Array.isArray(data)) return data;
  return (data as GenerateRoutesResponse).routes ?? [];
}

export async function rerouteFromPosition(
  current_position: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  original_route_type: string,
  reason: "off_route" | "pollution_spike" | "user_requested",
): Promise<RouteOption> {
  return apiFetch<RouteOption>("/api/routes/reroute", {
    method: "POST",
    body: JSON.stringify({
      current_position,
      destination,
      original_route_type,
      reason,
    }),
  });
}
