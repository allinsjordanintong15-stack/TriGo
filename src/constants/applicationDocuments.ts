// Driver application document photos (docs/DECISIONS.md, 2026-11-17): compressed JPEGs
// stored as Firestore bytes at driverApplications/{uid}/documents/{docType}. No imports on
// purpose, so plain Node tests can load this file. The limits must stay in sync with
// firestore.rules (match /driverApplications/{uid}/documents/{docType}).

/** The required documents, in the order the app and the admin website show them. */
export const APPLICATION_DOCUMENT_TYPES = ['orCr', 'ltoLicense'] as const;

export type ApplicationDocumentType = (typeof APPLICATION_DOCUMENT_TYPES)[number];

export const APPLICATION_DOCUMENT_LABELS: Record<ApplicationDocumentType, string> = {
  orCr: 'OR/CR of Vehicle',
  ltoLicense: "LTO-Verified Driver's License",
};

/** Every stored photo is a JPEG (the app re-encodes whatever the camera or gallery gives). */
export const DOCUMENT_IMAGE_MIME_TYPE = 'image/jpeg';

/** Rules: data.size() < 900000. A photo must be strictly smaller than this. */
export const DOCUMENT_IMAGE_MAX_BYTES = 900_000;

/** Compression stops at the first step whose result is at most this size. */
export const DOCUMENT_IMAGE_TARGET_BYTES = 700_000;

/** Rules: width and height at most 1600. */
export const DOCUMENT_IMAGE_MAX_SIDE = 1600;

/**
 * Compression steps, tried in order: longest side 1600 px at JPEG quality 0.7, then lower
 * quality down to 0.5, then the longest side down to 1280 px.
 */
export const DOCUMENT_COMPRESSION_STEPS: readonly { longSide: number; quality: number }[] = [
  { longSide: 1600, quality: 0.7 },
  { longSide: 1600, quality: 0.6 },
  { longSide: 1600, quality: 0.5 },
  { longSide: 1280, quality: 0.5 },
];

export const DOCUMENT_PHOTO_HINT = 'Take a clear photo in good light; make sure all text is readable.';
