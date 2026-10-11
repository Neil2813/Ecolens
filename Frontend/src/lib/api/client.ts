/* Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza */
/**
 * Ecolens API client
 * All requests go through the Vite dev-proxy (/api → http://127.0.0.1:8000).
 * In production, /api should be served by the backend directly or a reverse proxy.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("ecolens:auth_token");
}

function isDemo(): boolean {
  return localStorage.getItem("ecolens:auth") === "demo";
}

export function clearAuth() {
  localStorage.removeItem("ecolens:auth");
  localStorage.removeItem("ecolens:auth_token");
  localStorage.removeItem("ecolens:user");
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    if (isDemo()) {
      throw new ApiError(401, "Unauthorized – running in demo mode.");
    }
    clearAuth();
    // Redirect to sign-in without breaking the module
    if (typeof window !== "undefined") {
      window.location.href = "/auth/signin";
    }
    throw new ApiError(401, "Unauthorized – please sign in again.");
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

/** Returns true when running in demo/offline mode (no real backend token) */
export { isDemo };
