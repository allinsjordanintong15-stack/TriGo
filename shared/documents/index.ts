// Driver application document photos as stored in Firestore: a base64 STRING field
// (`dataBase64`), never Firestore Bytes. Firebase's React Native SDK decodes every received
// Bytes value with String.fromCharCode.apply (one argument per byte), which overflows the
// Hermes stack for a photo and breaks the whole Firestore client (docs/DECISIONS.md).
// Shared by the app (compression, submit) and the admin website (viewer). No imports, so
// plain Node tests, Metro and Vite can all load it. Keep the limits in sync with
// firestore.rules (match /driverApplications/{uid}/documents/{docType}).

/** Compression stops at the first step whose decoded JPEG is at most this size. */
export const DOCUMENT_IMAGE_TARGET_BYTES = 600_000;

/** Hard limit on the decoded JPEG (rules: sizeBytes <= 700000). */
export const DOCUMENT_IMAGE_MAX_BYTES = 700_000;

/**
 * Hard limit on the stored base64 text (rules: dataBase64.size() <= 950000). A 700 000-byte
 * photo is 933 336 characters; the rest of the 1 MiB document limit is headroom.
 */
export const DOCUMENT_BASE64_MAX_LENGTH = 950_000;

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** Standard base64 with padding and no whitespace (what the app stores). */
export function isStoredBase64(text: string): boolean {
  return text.length % 4 === 0 && BASE64_PATTERN.test(text);
}

/** Number of bytes a base64 string decodes to (whitespace ignored). */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, '');
  if (clean.length === 0) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES: Record<string, number> = Object.fromEntries(
  [...BASE64_ALPHABET].map((char, index) => [char, index]),
);

/**
 * Decodes base64 (whitespace ignored) to bytes in one loop over a preallocated array, never
 * spreading the bytes into a function call (safe on Hermes and in every browser). Throws on
 * characters outside the standard alphabet or a malformed length.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  if (!isStoredBase64(clean)) {
    throw new Error(`Invalid base64 (length ${clean.length}).`);
  }
  const length = base64ByteLength(clean);
  const bytes = new Uint8Array(length);
  const value = (index: number) => BASE64_VALUES[clean[index]] ?? 0; // '=' counts as 0
  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const triple = (value(i) << 18) | (value(i + 1) << 12) | (value(i + 2) << 6) | value(i + 3);
    if (out < length) bytes[out++] = (triple >> 16) & 0xff;
    if (out < length) bytes[out++] = (triple >> 8) & 0xff;
    if (out < length) bytes[out++] = triple & 0xff;
  }
  return bytes;
}

/** A stored photo document as readers accept it; anything else is "not on file". */
export interface StoredPhotoFields {
  dataBase64: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/**
 * Reads a photo document's fields. Null for any other shape (e.g. the earlier Firestore
 * Bytes `data` field, or a size that does not match the text), so readers show
 * "No documents on file" / "Not on file".
 */
export function readStoredPhoto(data: Record<string, unknown> | undefined | null): StoredPhotoFields | null {
  if (!data) return null;
  const { dataBase64, sizeBytes, width, height } = data;
  if (typeof dataBase64 !== 'string' || dataBase64.length === 0) return null;
  if (dataBase64.length > DOCUMENT_BASE64_MAX_LENGTH || !isStoredBase64(dataBase64)) return null;
  if (typeof sizeBytes !== 'number' || sizeBytes !== base64ByteLength(dataBase64)) return null;
  return {
    dataBase64,
    sizeBytes,
    width: typeof width === 'number' ? width : 0,
    height: typeof height === 'number' ? height : 0,
  };
}
