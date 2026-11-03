import type { LegalDocument } from './types.ts';

const PLACEHOLDER = /⟦TO FILL: [^⟧]+⟧/g;

/** Every ⟦TO FILL: …⟧ value still in a document (each one once), in order of appearance. */
export function findPlaceholders(doc: LegalDocument): string[] {
  const texts = [doc.title, ...doc.summary];
  for (const section of doc.sections) {
    texts.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') texts.push(block.text);
      else texts.push(...block.items);
    }
  }
  const found = texts.flatMap((text) => text.match(PLACEHOLDER) ?? []);
  return [...new Set(found)];
}
