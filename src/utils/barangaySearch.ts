// Offline barangay matching for the pickup/destination search. Relative imports (with ".ts"
// on value imports) on purpose, so plain Node tests, which resolve neither the "@/..."
// aliases nor extensionless paths, can load this file.

import { getBarangayPinPoint } from '../constants/barangayPinPoints.ts';
import { BARANGAYS, POBLACION_ID, type BoundaryBarangayId } from '../constants/barangays.ts';
import { TRIGO_SERVICE_AREA } from '../constants/serviceArea.ts';
import type { LocationSearchResult } from '../types';

/** Barangay suggestions shown above the geocoder's places. */
const MAX_BARANGAY_RESULTS = 5;

/** How the typed text matched, best first. `exact` lets callers skip the ORS search. */
export type BarangayMatchKind = 'exact' | 'prefix' | 'word' | 'contains' | 'typo' | 'mentioned';

export interface BarangaySearchMatch {
  id: BoundaryBarangayId;
  name: string;
  match: BarangayMatchKind;
}

const MATCH_ORDER: readonly BarangayMatchKind[] = [
  'exact',
  'prefix',
  'word',
  'contains',
  'typo',
  'mentioned',
];

/** Words that say "barangay" or the town/province, not which barangay. */
const IGNORED_WORDS = new Set(['barangay', 'brgy', 'bgy', 'brg', 'trinidad', 'bohol', 'philippines']);

/** Other ways people write a barangay, on top of its official name. */
const ALIASES: Partial<Record<BoundaryBarangayId, readonly string[]>> = {
  poblacion: ['town proper', 'town center', 'centro'],
  'manuel-m-roxas': ['mm roxas'],
  'santo-tomas': ['sto tomas'],
};

const SEARCHABLE = [{ id: POBLACION_ID, name: 'Poblacion' }, ...BARANGAYS].map(({ id, name }) => ({
  id: id as BoundaryBarangayId,
  name,
  keys: [name, ...(ALIASES[id as BoundaryBarangayId] ?? [])].map(normalizeSearchText),
}));

/**
 * Lowercase words without accents, punctuation, hyphens, or the ignored words above:
 * "Brgy. Kinan-oan, Trinidad" → "kinan oan".
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !IGNORED_WORDS.has(word))
    .join(' ');
}

/** Typos allowed for a word this long: none under 4 letters, 1 up to 7, then 2. */
function allowedTypos(length: number): number {
  if (length < 4) return 0;
  return length < 8 ? 1 : 2;
}

/** Edit distance counting a swap of two neighbouring letters as one edit. */
function typoDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
}

/** True when the typed text is the key, or the start of it, with a few typos. */
function isTypoMatch(query: string, key: string): boolean {
  const allowed = allowedTypos(query.length);
  if (allowed === 0) return false;
  if (typoDistance(query, key) <= allowedTypos(Math.min(query.length, key.length))) return true;

  // Still typing: compare with the start of the key, one letter shorter or longer too.
  for (let length = query.length - 1; length <= query.length + 1; length++) {
    if (length < key.length && typoDistance(query, key.slice(0, length)) <= allowed) return true;
  }
  return false;
}

/** Best way the normalized query matches one normalized key, or null. */
function matchKey(query: string, key: string): BarangayMatchKind | null {
  const compactQuery = query.replace(/ /g, '');
  const compactKey = key.replace(/ /g, '');

  if (compactQuery === compactKey) return 'exact';
  if (compactKey.startsWith(compactQuery)) return 'prefix';
  if (` ${key}`.includes(` ${query}`)) return 'word';
  if (compactQuery.length >= 3 && compactKey.includes(compactQuery)) return 'contains';
  if (isTypoMatch(compactQuery, compactKey)) return 'typo';
  // A longer search that names the barangay, e.g. "Banlasan elementary school".
  if (` ${query} `.includes(` ${key} `) || query.split(' ').includes(compactKey)) {
    return 'mentioned';
  }
  return null;
}

/**
 * Barangays of Trinidad (Poblacion and the 19 tariff barangays) matching the typed text,
 * best match first, then by name. Case, accents, punctuation and words such as "brgy" or
 * "Trinidad" are ignored; small typos match ("banlasn" → Banlasan). Empty for text under
 * 2 letters.
 */
export function searchBarangays(text: string): BarangaySearchMatch[] {
  const query = normalizeSearchText(text);
  if (query.replace(/ /g, '').length < 2) return [];

  const matches: BarangaySearchMatch[] = [];
  for (const barangay of SEARCHABLE) {
    const kinds = barangay.keys
      .map((key) => matchKey(query, key))
      .filter((kind): kind is BarangayMatchKind => kind !== null);
    if (kinds.length === 0) continue;

    const best = kinds.reduce((a, b) => (MATCH_ORDER.indexOf(a) <= MATCH_ORDER.indexOf(b) ? a : b));
    matches.push({ id: barangay.id, name: barangay.name, match: best });
  }

  return matches.sort(
    (a, b) =>
      MATCH_ORDER.indexOf(a.match) - MATCH_ORDER.indexOf(b.match) || a.name.localeCompare(b.name),
  );
}

/** "Barangay Banlasan · Trinidad", or "Poblacion (Town proper) · Trinidad". */
export function formatBarangayResultLabel(match: { id: BoundaryBarangayId; name: string }): string {
  const place = match.id === POBLACION_ID ? `${match.name} (Town proper)` : `Barangay ${match.name}`;
  return `${place} · ${TRIGO_SERVICE_AREA.name}`;
}

/**
 * Barangay suggestions for the pickup/destination search, best first, pinned at each
 * barangay's pin point (always inside Trinidad). Instant and offline.
 */
export function searchBarangayLocations(text: string): LocationSearchResult[] {
  return searchBarangays(text)
    .slice(0, MAX_BARANGAY_RESULTS)
    .map((match) => ({
      ...getBarangayPinPoint(match.id),
      address: formatBarangayResultLabel(match),
      kind: 'barangay',
      barangayId: match.id,
      withinServiceArea: true,
    }));
}
