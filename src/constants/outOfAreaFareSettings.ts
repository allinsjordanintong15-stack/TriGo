import { OutOfAreaFareSettings } from '@/types';

/**
 * Out-of-area request settings. The fare itself is the admin per-km fare and is final
 * (docs/DECISIONS.md); drivers do not choose an amount.
 */
/**
 * Longest request lifetime the app writes. firestore.rules accepts expiresAt up to
 * 35 minutes after the server time (this cap + 5 minutes of client clock-skew grace),
 * so a larger fareSettings value is clamped here instead of failing the create.
 */
export const MAX_REQUEST_EXPIRY_MINUTES = 30;

// Defaults when fareSettings/active has no outOfArea (admins edit it on the admin website's
// System settings page: expiry 1-30 min, radius 1-50 km).
export const OUT_OF_AREA_FARE_SETTINGS: OutOfAreaFareSettings = {
  enabled: true,
  requestExpiryMinutes: 30,
  driverSearchRadiusKm: 15,
};
