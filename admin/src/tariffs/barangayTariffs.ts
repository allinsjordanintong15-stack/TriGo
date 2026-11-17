import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../firebase/config';
import { BARANGAYS, type BarangayId } from './barangays';

// barangayTariffs/{barangayId}: { name, tricycle, motorcycle, active, updatedAt, updatedBy }.
// firestore.rules only accepts complete rows for the known IDs.
const COLLECTION = 'barangayTariffs';

export type BarangayTariff = { tricycle: number; motorcycle: number; active: boolean };

/** Saved row per barangay, or null when that barangay has no tariff saved yet. */
export type SavedTariffs = Record<BarangayId, BarangayTariff | null>;

const KNOWN_IDS = new Set<string>(BARANGAYS.map((b) => b.id));

function readTariff(data: Record<string, unknown> | undefined): BarangayTariff | null {
  if (
    data &&
    typeof data.tricycle === 'number' &&
    typeof data.motorcycle === 'number' &&
    typeof data.active === 'boolean'
  ) {
    return { tricycle: data.tricycle, motorcycle: data.motorcycle, active: data.active };
  }
  return null;
}

export type LoadedTariffs = {
  saved: SavedTariffs;
  /** The most recent save of any row, and who made it (null when no row is saved). */
  updatedAt: Date | null;
  updatedBy: string | null;
};

export async function loadTariffs(): Promise<LoadedTariffs> {
  const saved = Object.fromEntries(BARANGAYS.map((b) => [b.id, null])) as SavedTariffs;
  let updatedAt: Date | null = null;
  let updatedBy: string | null = null;
  const snapshot = await getDocs(collection(db, COLLECTION));
  for (const document of snapshot.docs) {
    if (KNOWN_IDS.has(document.id)) {
      const data = document.data();
      saved[document.id as BarangayId] = readTariff(data);
      const at: Date | null = data.updatedAt?.toDate?.() ?? null;
      if (at && (!updatedAt || at > updatedAt)) {
        updatedAt = at;
        updatedBy = typeof data.updatedBy === 'string' ? data.updatedBy : null;
      }
    }
  }
  return { saved, updatedAt, updatedBy };
}

export function tariffsEqual(a: BarangayTariff | null, b: BarangayTariff | null): boolean {
  if (!a || !b) return a === b;
  return a.tricycle === b.tricycle && a.motorcycle === b.motorcycle && a.active === b.active;
}

export class StaleTariffsError extends Error {
  constructor() {
    super('Barangay tariffs were changed by someone else. Reload the page and try again.');
  }
}

export type TariffChange = { id: BarangayId; name: string; before: BarangayTariff | null; after: BarangayTariff };

/**
 * Writes each changed row in full, in one transaction. Re-reads those rows first and fails
 * with StaleTariffsError when any of them is no longer what the admin confirmed against.
 */
export async function saveTariffs(changes: TariffChange[], uid: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const refs = changes.map((change) => doc(db, COLLECTION, change.id));
    // All reads must happen before any write in a transaction.
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    changes.forEach((change, i) => {
      if (!tariffsEqual(readTariff(snapshots[i].data()), change.before)) {
        throw new StaleTariffsError();
      }
    });
    changes.forEach((change, i) => {
      transaction.set(refs[i], {
        name: change.name,
        ...change.after,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    });
  });
}
