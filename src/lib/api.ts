export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

/** The backend's origin (no `/api` suffix) — for resolving relative asset URLs
 * like `/uploads/xyz.jpg` (returned by upload endpoints) into a displayable URL.
 * The admin panel is served from its own origin (the Vite dev server), so a bare
 * relative path in an <img src> would otherwise resolve against THAT origin. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

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

interface ErrorBody {
  message: string;
  details?: unknown;
  reason?: string;
}

async function parseErrorMessage(res: Response): Promise<ErrorBody> {
  try {
    const data = await res.json();
    return { message: data?.error ?? res.statusText, details: data?.details, reason: data?.reason };
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
    const { message, details, reason } = await parseErrorMessage(res);
    if (res.status === 403 && reason === 'account_restricted') {
      clearTokens();
      onSessionExpired?.();
    }
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

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** List endpoints may answer with a bare array or a `{ items, ... }` envelope. */
export function unwrapList<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Fetches one server page and normalises a bare-array answer into the envelope shape. */
export async function fetchPage<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<PaginatedResponse<T>> {
  const res = await api.get<T[] | PaginatedResponse<T>>(`${path}${buildQuery(params)}`);
  if (Array.isArray(res)) {
    return { items: res, page: 1, limit: res.length, total: res.length, totalPages: 1 };
  }
  return res;
}

export const FETCH_ALL_MAX_ITEMS = 2000;

export interface FetchAllResult<T> {
  items: T[];
  total: number;
  /** True when the server holds more rows than `FETCH_ALL_MAX_ITEMS` and the list was cut short. */
  truncated: boolean;
}

/**
 * Walks every server page of a paginated list and concatenates the results, for
 * pages that must aggregate client-side (no matching server filter exists).
 * Hard-capped at `FETCH_ALL_MAX_ITEMS`; callers should surface `truncated`.
 */
export async function fetchAllPaginatedWithMeta<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  opts: { limit?: number; maxItems?: number } = {},
): Promise<FetchAllResult<T>> {
  const limit = opts.limit ?? 100;
  const maxItems = opts.maxItems ?? FETCH_ALL_MAX_ITEMS;
  const maxPages = Math.max(1, Math.ceil(maxItems / limit));

  const first = await fetchPage<T>(path, { ...params, page: 1, limit });
  const items = [...first.items];
  const totalPages = Math.min(first.totalPages || 1, maxPages);
  for (let page = 2; page <= totalPages; page++) {
    const res = await fetchPage<T>(path, { ...params, page, limit });
    items.push(...res.items);
  }
  const total = first.total ?? items.length;
  return { items: items.slice(0, maxItems), total, truncated: total > items.length || items.length > maxItems };
}

export async function fetchAllPaginated<T>(
  path: string,
  params: Record<string, string | undefined> = {},
  opts: { limit?: number; maxItems?: number } = {},
): Promise<T[]> {
  return (await fetchAllPaginatedWithMeta<T>(path, params, opts)).items;
}

export function truncationMessage(total: number, shown: number): string {
  return `Showing the first ${shown.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} records — narrow the filters to see the rest.`;
}
