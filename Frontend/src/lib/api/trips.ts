/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { apiFetch } from "./client";

export interface TripRecord {
  id: string;
  route_type: "fastest" | "cleanest_air" | "lowest_carbon";
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  distance_km: number | null;
  pm25_inhaled: number | null;
  pm25_avoided: number | null;
  co2_grams: number | null;
  ecoscore: number | null;
  heat_exposure?: number | null;
  noise_avg_db?: number | null;
  polyline?: [number, number][] | null;
  vs_fastest?: {
    pm25_fastest: number;
    pm25_reduction_percent: number;
    co2_fastest: number;
    time_added_min: number;
  } | null;
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
}

export interface TripHistoryResponse {
  trips: TripRecord[];
  total: number;
  page: number;
  limit: number;
}

export async function getTripHistory(page = 1, filter = "all"): Promise<TripHistoryResponse> {
  return apiFetch<TripHistoryResponse>(`/api/trips/history?page=${page}&filter=${filter}`);
}

export async function getTripDetail(tripId: string): Promise<TripRecord> {
  return apiFetch<TripRecord>(`/api/trips/${tripId}`);
}
