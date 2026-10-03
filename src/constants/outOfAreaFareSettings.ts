import { OutOfAreaFareSettings } from '@/types';

/**
 * Configurable out-of-area tariff rules.
 * Adjust values here when official tariffs are defined — no UI changes required.
 */
/**
 * Longest request lifetime the app writes. firestore.rules accepts expiresAt up to
 * 35 minutes after the server time (this cap + 5 minutes of client clock-skew grace),
 * so a larger fareSettings value is clamped here instead of failing the create.
 */
export const MAX_REQUEST_EXPIRY_MINUTES = 30;

export const OUT_OF_AREA_FARE_SETTINGS: OutOfAreaFareSettings = {
  enabled: true,
  maximumAdditionalPercentage: null,
  minimumFare: null,
  allowDriverNegotiation: true,
  requestExpiryMinutes: 30,
  driverSearchRadiusKm: 15,
};
