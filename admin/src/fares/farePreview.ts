// Fare preview on the Fares tab: what a few trip distances cost with the saved rates and
// with the rates being edited. Uses the app's fare formula (shared/fares). No Firebase
// imports (tested by tests/admin/farePreview.test.ts under plain Node).

import { perKmFare, type PerKmRate } from '../lib/fares.ts';

export const PREVIEW_DISTANCES_KM = [1, 3, 5, 10] as const;

export type PreviewCell = {
  /** Fare with the saved (or default) rates. */
  current: number;
  /** Fare with the edited rates; null while a rate is invalid. */
  next: number | null;
  /** True when the edited rates give a different fare for this distance. */
  changed: boolean;
};

export function previewCell(current: PerKmRate, draft: PerKmRate | null, distanceKm: number): PreviewCell {
  const currentFare = perKmFare(current, distanceKm);
  const nextFare = draft ? perKmFare(draft, distanceKm) : null;
  return { current: currentFare, next: nextFare, changed: nextFare !== null && nextFare !== currentFare };
}
