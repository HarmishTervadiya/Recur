const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("recur_access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("recur_refresh_token");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("recur_access_token", accessToken);
  localStorage.setItem("recur_refresh_token", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("recur_access_token");
  localStorage.removeItem("recur_refresh_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const json: ApiResponse<{ accessToken: string; refreshToken: string }> =
      await res.json();

    if (json.success && json.data) {
      setTokens(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken;
    }

    clearTokens();
    return null;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  let token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  // If 401, try refresh
  if (res.status === 401 && getRefreshToken()) {
    token = await refreshAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    json = {
      success: false,
      data: null,
      error: { code: "PARSE_ERROR", message: `Server returned ${res.status} with non-JSON body` },
    };
  }
  return json;
}
