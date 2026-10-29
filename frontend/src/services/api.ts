
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: string;
  application: string;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();

        if (typeof data.access_token !== "string") {
          return null;
        }

        sessionStorage.setItem("access_token", data.access_token);
        return data.access_token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = sessionStorage.getItem("access_token");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401) {
    return response;
  }

  const newToken = await refreshAccessToken();

  if (!newToken) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user_role");
    sessionStorage.removeItem("last_activity");
    window.location.replace("/login");
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${newToken}`);

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: "include",
  });
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
