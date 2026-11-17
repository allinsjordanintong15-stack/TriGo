// Shared fare formula, used by the app (src/utils/fareQuote.ts) and the admin website
// (admin/src/lib/fares.ts, Fare settings preview). No imports, so plain Node tests, Metro
// and Vite can all load it.

/** One vehicle's per-km settings (fareSettings/active.fares.<vehicle>). */
export interface PerKmRate {
  baseFare: number;
  perKm: number;
}

/** Admin per-km fare: base fare + rate × road distance in km, kept to the centavo. */
export function perKmFare(rate: PerKmRate, distanceKm: number): number {
  return Math.round((rate.baseFare + rate.perKm * distanceKm) * 100) / 100;
}
