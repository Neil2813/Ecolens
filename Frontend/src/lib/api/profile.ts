/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
import { apiFetch } from "./client";
import type { AuthUser } from "./auth";

export type UserProfile = AuthUser;

export async function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/profile");
}
