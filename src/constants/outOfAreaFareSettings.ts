import { OutOfAreaFareSettings } from '@/types';

/**
 * Configurable out-of-area tariff rules.
 * Adjust values here when official tariffs are defined — no UI changes required.
 */
export const OUT_OF_AREA_FARE_SETTINGS: OutOfAreaFareSettings = {
  enabled: true,
  maximumAdditionalPercentage: null,
  minimumFare: null,
  allowDriverNegotiation: true,
  requestExpiryMinutes: 30,
  driverSearchRadiusKm: 15,
};
