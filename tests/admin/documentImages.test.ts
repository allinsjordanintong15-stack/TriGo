/// <reference types="node" />

// Document photos stored as a base64 string (shared/documents): how the admin website turns
// one into an image (admin/src/drivers/driverApplications.ts, documentImageBlob), and what
// readers treat as "not on file". Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  base64ByteLength,
  base64ToBytes,
  DOCUMENT_IMAGE_MAX_BYTES,
  readStoredPhoto,
} from '../../shared/documents/index.ts';

/** A ~700 KB JPEG-like photo: JPEG start/end markers around varied bytes. */
function jpegOf(size: number): Buffer {
  const jpeg = Buffer.alloc(size);
  for (let i = 0; i < size; i++) jpeg[i] = (i * 7919 + 13) & 0xff;
  jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
  jpeg.set([0xff, 0xd9], size - 2);
  return jpeg;
}

describe('admin document image from the stored base64 string', () => {
  it('builds the exact JPEG blob for a 700 KB photo', async () => {
    const jpeg = jpegOf(DOCUMENT_IMAGE_MAX_BYTES);
    const stored = {
      uid: 'u1',
      docType: 'orCr',
      mimeType: 'image/jpeg',
      dataBase64: jpeg.toString('base64'),
      sizeBytes: DOCUMENT_IMAGE_MAX_BYTES,
      width: 1600,
      height: 1200,
    };
    const photo = readStoredPhoto(stored);
    assert.ok(photo);
    assert.equal(photo.sizeBytes, 700_000);
    // As documentImageBlob does it.
    const blob = new Blob([base64ToBytes(photo.dataBase64) as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
    assert.equal(blob.size, 700_000);
    assert.equal(blob.type, 'image/jpeg');
    assert.ok(Buffer.from(await blob.arrayBuffer()).equals(jpeg));
  });

  it('treats any other shape as not on file', () => {
    const text = jpegOf(1_000).toString('base64');
    const ok = { dataBase64: text, sizeBytes: base64ByteLength(text), width: 10, height: 10 };
    assert.ok(readStoredPhoto(ok));
    assert.equal(readStoredPhoto(undefined), null);
    // The earlier Firestore Bytes shape (any object in `data`).
    assert.equal(readStoredPhoto({ data: { toUint8Array: () => new Uint8Array(4) }, sizeBytes: 4 }), null);
    assert.equal(readStoredPhoto({ ...ok, dataBase64: '' }), null);
    assert.equal(readStoredPhoto({ ...ok, sizeBytes: ok.sizeBytes + 1 }), null);
    assert.equal(readStoredPhoto({ ...ok, dataBase64: `${text.slice(0, -4)}-_-_` }), null);
    assert.equal(readStoredPhoto({ ...ok, dataBase64: 'A'.repeat(950_004) }), null);
  });
});
