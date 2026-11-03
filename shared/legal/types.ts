// Plain data shapes for TriGo's legal documents. No React, React Native or DOM imports:
// the mobile app (Metro), the admin website (Vite) and plain Node scripts/tests all load
// this folder.

/** One block of text inside a section. */
export type LegalBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: readonly string[] };

export interface LegalSection {
  /** Stable id (used for anchors such as /privacy#location). Lowercase letters, digits, hyphens. */
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  id: 'privacy-notice' | 'terms';
  title: string;
  /** Short plain-English summary shown before the sections. */
  summary: readonly string[];
  sections: readonly LegalSection[];
}
