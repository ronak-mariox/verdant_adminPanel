// In production this would come from an env var, e.g. import.meta.env.VITE_API_BASE_URL
export const API_BASE_URL = 'http://localhost:4000/api';

/** The backend's origin (no `/api` suffix) — for resolving relative asset URLs
 * like `/uploads/xyz.jpg` (returned by upload endpoints) into a displayable URL.
 * The admin panel is served from its own origin (the Vite dev server), so a bare
 * relative path in an <img src> would otherwise resolve against THAT origin. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Called when a request fails to recover even after a token refresh attempt. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal flag to prevent infinite refresh loops. */
  _retried?: boolean;
}

async function parseErrorMessage(res: Response): Promise<{ message: string; details?: unknown }> {
  try {
    const data = await res.json();
    return { message: data?.error ?? res.statusText, details: data?.details };
  } catch {
    return { message: res.statusText || 'Request failed' };
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // De-dupe concurrent refresh attempts (e.g. several requests 401 at once).
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retried, ...rest } = options;
  const accessToken = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retried && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
    clearTokens();
    onSessionExpired?.();
    const { message, details } = await parseErrorMessage(res);
    throw new ApiError(401, message, details);
  }

  if (!res.ok) {
    const { message, details } = await parseErrorMessage(res);
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * A handful of admin list endpoints (products, orders) are server-paginated with a
 * hard 100-per-page cap. Several admin panel pages still do their filtering/sorting/
 * pagination entirely client-side against a full in-memory list (same shape the old
 * mock data had), so this walks every page and concatenates the results instead of
 * rewriting those pages around server-side pagination. Capped at `maxPages` as a
 * safety valve for very large datasets.
 */
export async function fetchAllPaginated<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  opts: { limit?: number; maxPages?: number } = {},
): Promise<T[]> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 20;

  const buildQuery = (page: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    return qs.toString();
  };

  const first = await api.get<PaginatedResponse<T>>(`${path}?${buildQuery(1)}`);
  const items = [...first.items];
  const totalPages = Math.min(first.totalPages || 1, maxPages);
  for (let page = 2; page <= totalPages; page++) {
    const res = await api.get<PaginatedResponse<T>>(`${path}?${buildQuery(page)}`);
    items.push(...res.items);
  }
  return items;
}
