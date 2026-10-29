// Fare basis line shown under a standard fare. Relative imports (with ".ts" on value
// imports) on purpose, so plain Node tests, which resolve neither the "@/..." aliases nor
// extensionless paths, can load this file.

import { BARANGAYS, POBLACION_ID } from '../constants/barangays.ts';
import type { BookingType, FareBasis } from '../types';
import { formatPhilippinePeso } from './fare.ts';

/** The fields a TripQuote and a Booking share for this. */
export interface FareBasisFields {
  bookingType: BookingType;
  fareBasis: FareBasis;
  pickupBarangayId: string | null;
  destinationBarangayId: string | null;
  perKmRate: number | null;
}

/**
 * "Barangay tariff · Poblacion ↔ Bongbong", "₱8.00/km", or "Per-km fare" for bookings
 * made before the per-km rate was stored. Null for out-of-area trips, whose screens keep
 * their own fare text.
 */
export function getFareBasisLabel(fields: FareBasisFields): string | null {
  if (fields.bookingType === 'out_of_area') return null;

  if (fields.fareBasis === 'barangay_tariff') {
    const otherId =
      fields.pickupBarangayId === POBLACION_ID
        ? fields.destinationBarangayId
        : fields.pickupBarangayId;
    const name = BARANGAYS.find((barangay) => barangay.id === otherId)?.name;
    return name ? `Barangay tariff · Poblacion ↔ ${name}` : 'Barangay tariff';
  }

  return fields.perKmRate !== null ? `${formatPhilippinePeso(fields.perKmRate)}/km` : 'Per-km fare';
}
