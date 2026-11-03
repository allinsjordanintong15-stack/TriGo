// Shared legal module: privacy contact, legal version, Privacy Notice and Terms of Use.
// Used by the mobile app (src/constants/legal.ts), the admin website
// (admin/src/lib/legal.ts), scripts/exportLegal.ts and the unit tests.
// Plain TypeScript only (no React / React Native / DOM), with .ts import extensions so
// Node can run it directly.

export {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  legalVersionLine,
  PRIVACY_CONTACT,
  privacyContactLine,
} from './meta.ts';
export { LEGAL_MARKDOWN_FILES, legalDocumentToMarkdown } from './markdown.ts';
export { findPlaceholders } from './placeholders.ts';
export { PRIVACY_NOTICE } from './privacyNotice.ts';
export { TERMS } from './terms.ts';
export type { LegalBlock, LegalDocument, LegalSection } from './types.ts';

import { PRIVACY_NOTICE } from './privacyNotice.ts';
import { TERMS } from './terms.ts';

/** Both documents, in the order they are shown. */
export const LEGAL_DOCUMENTS = [PRIVACY_NOTICE, TERMS] as const;
