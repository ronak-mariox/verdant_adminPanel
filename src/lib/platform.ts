// Platform-wide constants hard-coded on the backend (lib/commission.ts,
// lib/pricing.ts, lib/driverEarnings.ts). There is no settings endpoint — these
// are shown read-only and must be kept in sync by hand if the backend changes.

/** Fraction of an order's grand total taken as platform commission. */
export const PLATFORM_COMMISSION_RATE = 0.08;
/** GST charged on the commission amount, as a fraction. */
export const GST_ON_COMMISSION_RATE = 0.18;

export const MIN_ORDER_VALUE = 99;
export const DELIVERY_FEE = 30;
export const PLATFORM_FEE = 5;

/** Flat amount (₹) a driver earns per completed delivery. */
export const DRIVER_BASE_PAY = 30;
export const DRIVER_PER_KM_RATE = 5;
export const DRIVER_ON_TIME_BONUS = 10;
export const DRIVER_ON_TIME_WINDOW_MINUTES = 45;
