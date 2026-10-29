import { BARANGAYS } from '@/constants/barangays';
import { COLLECTIONS, firestore } from '@/firebase';
import { BarangayTariffRow, BarangayTariffs } from '@/utils/fareQuote';
import { collection, getDocs } from 'firebase/firestore';

/** A slow read counts as failed, so Book Ride never waits longer than this for tariffs. */
export const TARIFF_LOAD_TIMEOUT_MS = 5000;

/** Barangay tariffs as the booking draft holds them: no tariffs while loading or unavailable. */
export type TariffsStatus = 'loading' | 'ready' | 'unavailable';

const KNOWN_IDS = new Set<string>(BARANGAYS.map((barangay) => barangay.id));

function readTariff(data: Record<string, unknown>): BarangayTariffRow | null {
  if (
    typeof data.tricycle === 'number' &&
    typeof data.motorcycle === 'number' &&
    typeof data.active === 'boolean'
  ) {
    return { tricycle: data.tricycle, motorcycle: data.motorcycle, active: data.active };
  }
  return null;
}

/**
 * Reads barangayTariffs/* (rows for unknown IDs or with missing fields are skipped).
 * Null when the read fails or takes longer than the timeout; callers then quote per-km,
 * which the booking rules always accept.
 */
export async function fetchBarangayTariffs(
  timeoutMs: number = TARIFF_LOAD_TIMEOUT_MS,
): Promise<BarangayTariffs | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const read = getDocs(collection(firestore, COLLECTIONS.barangayTariffs))
    .then((snapshot) => {
      const tariffs: Record<string, BarangayTariffRow> = {};
      for (const document of snapshot.docs) {
        const row = KNOWN_IDS.has(document.id) ? readTariff(document.data()) : null;
        if (row) tariffs[document.id] = row;
      }
      return tariffs as BarangayTariffs;
    })
    .catch(() => null);

  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
