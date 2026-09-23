import { API_ORIGIN } from './api';

/** Turns a backend-relative upload path (e.g. `/uploads/xyz.jpg`) into an absolute
 * URL an <img> can actually load. Already-absolute URLs and empty strings pass through. */
export function resolveAssetUrl(url: string): string {
  if (!url || /^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}
