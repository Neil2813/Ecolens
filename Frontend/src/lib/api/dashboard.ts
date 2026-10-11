/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { apiFetch } from "./client";

export interface DashboardSummary {
  // Flat top-level fields
  pm25_inhaled: number;
  pm25_avoided: number;
  co2_grams: number;
  ecoscore: number;
  heat_exposure?: number;
  noise_avg_db?: number;
  no2_inhaled?: number;
  trips_today?: number;
  city_avg_co2?: number;
  co2_vs_avg_percent?: number | null;
  ecoscore_delta?: number | null;

  // Nested "today" block (mirrors flat fields)
  today?: {
    date: string;
    pm25_inhaled: number;
    pm25_avoided: number;
    co2_grams: number;
    city_avg_co2: number;
    co2_vs_avg_percent: number | null;
    ecoscore: number;
    heat_exposure: number;
    noise_avg_db: number;
    no2_inhaled: number;
    trips_today: number;
  };

  // Weekly breakdowns
  weekly_trend?: { date: string; pm25: number; ecoscore: number }[];
  weekly_pollution?: {
    day: string;
    level: number;
    status: "safe" | "moderate" | "high";
    empty?: boolean;
    is_ambient?: boolean;
  }[];
  ecoscore_trend?: number[];

  // Tomorrow's forecast
  forecast?: {
    forecast_date?: string;
    risk_level: string;
    pct_higher?: number | null;
    recommended_departure: string;
    recommended_route: string;
    predicted_pm25: number;
    reason?: string | null;
  } | null;

  // Earned badges
  badges?: {
    id: string;
    label: string;
    icon: string;
    color: string;
    earned_at: string;
  }[];
}

export async function getDashboardSummary(date?: string, lat?: number, lon?: number): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (lat !== undefined && lat !== null) params.set("lat", String(lat));
  if (lon !== undefined && lon !== null) params.set("lon", String(lon));
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<DashboardSummary>(`/api/dashboard/summary${query}`);
}
