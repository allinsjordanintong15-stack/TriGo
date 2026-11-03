// The ONE place for the privacy contact and the legal version. The app, the admin website,
// the Markdown export (docs/legal) and, in a later step, the Firestore rules' current
// legal version all follow these values.
//
// Changing the notice or terms text: raise LEGAL_VERSION (1.0 → 1.1), set
// LEGAL_EFFECTIVE_DATE, then run `npm run legal:export` (the unit tests fail until the
// Markdown in docs/legal matches).

export const PRIVACY_CONTACT = {
  name: 'TriGo Management',
  email: 'allinsjordanintong15@gmail.com',
} as const;

/** "major.minor". Users are asked to accept again whenever this changes. */
export const LEGAL_VERSION = '1.0';

/** Date the current version takes effect, YYYY-MM-DD (Philippine date). */
export const LEGAL_EFFECTIVE_DATE = '2026-11-03';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** '2026-11-03' → '3 November 2026'. Throws on anything that is not a real YYYY-MM-DD date. */
export function formatLegalDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Not a real date: ${isoDate}`);
  }
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "Version 1.0 · Effective 3 November 2026" — the line shown under every legal title. */
export function legalVersionLine(): string {
  return `Version ${LEGAL_VERSION} · Effective ${formatLegalDate(LEGAL_EFFECTIVE_DATE)}`;
}

/** "TriGo Management · allinsjordanintong15@gmail.com" */
export function privacyContactLine(): string {
  return `${PRIVACY_CONTACT.name} · ${PRIVACY_CONTACT.email}`;
}

/**
 * Values still to be filled in by the project team are written as ⟦TO FILL: …⟧ so they
 * stand out wherever the text is shown. findPlaceholders() lists them.
 */
export function toFill(what: string): string {
  return `⟦TO FILL: ${what}⟧`;
}
