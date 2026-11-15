/** Original TriGo lines shown under the passenger Home greeting (no famous quotes). */
export const TAGLINES = [
  'Sakay na! Your ride around Trinidad is a tap away.',
  'Safe rides with verified local drivers.',
  'From Poblacion to every barangay, TriGo gets you there.',
  'Plan ahead, ride easy.',
  'Your town, your ride.',
] as const;

/** Picked once when the app starts, so it stays the same until the next app open. */
export const APP_OPEN_TAGLINE: string = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
