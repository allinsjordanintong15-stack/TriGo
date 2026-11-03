// Writes the Privacy Notice and Terms of Use from shared/legal to docs/legal/*.md.
// Run after changing the legal text: `npm run legal:export` (Node 22.18+ runs .ts directly).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGAL_DOCUMENTS, LEGAL_MARKDOWN_FILES, legalDocumentToMarkdown } from '../shared/legal/index.ts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'legal');
mkdirSync(outDir, { recursive: true });
for (const doc of LEGAL_DOCUMENTS) {
  const file = join(outDir, LEGAL_MARKDOWN_FILES[doc.id]);
  writeFileSync(file, legalDocumentToMarkdown(doc), 'utf8');
  console.log(`Wrote ${file}`);
}
