/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { apiFetch } from "@/lib/api/client";

// ── Travel Planner ─────────────────────────────────────────────────────────────

export interface TravelPlanResponse {
  itinerary: string;
  research_summary: string | null;
  destination: string;
  num_days: number;
}

export async function planTrip(
  destination: string,
  numDays: number,
): Promise<TravelPlanResponse> {
  return apiFetch<TravelPlanResponse>("/api/travel/plan", {
    method: "POST",
    body: JSON.stringify({ destination, num_days: numDays }),
  });
}

export async function downloadCalendar(itineraryText: string): Promise<Blob> {
  const token = localStorage.getItem("ecolens:auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/travel/calendar", {
    method: "POST",
    headers,
    body: JSON.stringify({ itinerary_text: itineraryText }),
  });

  if (!res.ok) throw new Error(`Calendar download failed: ${res.status}`);
  return res.blob();
}

// ── Audio Tour ─────────────────────────────────────────────────────────────────

export interface TourResponse {
  narration: string;
  audio_url: string | null;
  sections: Record<string, string>;
  location: string;
  interests: string[];
  duration_minutes: number;
}

export async function generateTour(
  location: string,
  interests: string[],
  durationMinutes: number,
): Promise<TourResponse> {
  return apiFetch<TourResponse>("/api/tour/generate", {
    method: "POST",
    body: JSON.stringify({
      location,
      interests,
      duration_minutes: durationMinutes,
    }),
  });
}
