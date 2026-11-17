/// <reference types="node" />

// The phone never reads or listens to driver application photo documents
// (driverApplications/{uid}/documents/*). Receiving one crashed the React Native Firestore
// client (2026-11-17) and costs nearly 1 MB per photo. A static check over src/, so a new
// read of the subcollection fails here. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, it } from 'node:test';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const FILES = sourceFiles('src').map((path) => ({
  path: path.split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}));
const NAMES_SUBCOLLECTION = new RegExp(`["']documents["']`);
const READS = /\b(getDoc|getDocs|getDocFromServer|getDocsFromServer|onSnapshot|collectionGroup|query)\s*\(/;

describe('no photo document reads in the app', () => {
  it('only the photo store names the documents subcollection', () => {
    const naming = FILES.filter(({ text }) => NAMES_SUBCOLLECTION.test(text)).map(({ path }) => path);
    assert.deepEqual(naming, ['src/services/applicationDocumentService.ts']);
  });

  it('the photo store only writes (no reads, listeners or queries)', () => {
    const store = FILES.find(({ path }) => path === 'src/services/applicationDocumentService.ts');
    assert.ok(store);
    assert.doesNotMatch(store.text, READS);
    assert.doesNotMatch(store.text, /transaction\.get\(/);
  });

  it('no collection group queries anywhere in the app', () => {
    for (const { path, text } of FILES) assert.doesNotMatch(text, /collectionGroup\s*\(/, path);
  });

  it('the app never builds Firestore Bytes for photos', () => {
    for (const { path, text } of FILES) assert.doesNotMatch(text, /Bytes\.from(Base64String|Uint8Array)\s*\(/, path);
  });
});
