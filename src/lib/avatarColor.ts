// Vendor/Driver/Customer records have no stored avatar color server-side — this
// derives a stable one from the record's id so avatars stay consistent across
// reloads and renders instead of re-rolling randomly (same idea as Categories.tsx's
// gradientFor, shared here since it's needed by both the list and detail pages for
// vendors, drivers and customers).
const AVATAR_PALETTE = ['#1CA672', '#3B82F6', '#F79009', '#7C3AED', '#0891B2', '#DC2626', '#4338CA', '#EA580C'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarColorFor(id: string): string {
  return AVATAR_PALETTE[hashString(id) % AVATAR_PALETTE.length];
}
