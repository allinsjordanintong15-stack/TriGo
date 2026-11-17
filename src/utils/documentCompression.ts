// Choosing the compression step for a driver application document photo. Pure logic with
// relative imports only, so plain Node tests can load it (tests/drivers/documentCompression.test.ts).
// The service (src/services/applicationDocumentService.ts) supplies the real JPEG encoder.

import {
  DOCUMENT_COMPRESSION_STEPS,
  DOCUMENT_IMAGE_MAX_BYTES,
  DOCUMENT_IMAGE_TARGET_BYTES,
} from '../constants/applicationDocuments.ts';

export interface CompressionStep {
  longSide: number;
  quality: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface EncodedImage extends Dimensions {
  sizeBytes: number;
}

export type CompressionOutcome<T extends EncodedImage> =
  | { ok: true; image: T; step: CompressionStep }
  | { ok: false; reason: 'too-large'; smallestBytes: number };

/**
 * The size to resize to so the longest side is at most `longSide`, keeping the aspect ratio.
 * Never enlarges a smaller photo.
 */
export function fitLongSide(original: Dimensions, longSide: number): Dimensions {
  const longest = Math.max(original.width, original.height);
  if (longest <= longSide) return { width: original.width, height: original.height };
  const scale = longSide / longest;
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  };
}

/**
 * Tries the steps in order and stops at the first result of at most the target size.
 * When none reaches the target, the smallest result is used if it is under the hard limit;
 * otherwise the photo is too large (never uploaded).
 */
export async function compressWithSteps<T extends EncodedImage>(
  encode: (step: CompressionStep, size: Dimensions) => Promise<T>,
  original: Dimensions,
  steps: readonly CompressionStep[] = DOCUMENT_COMPRESSION_STEPS,
  limits: { targetBytes: number; maxBytes: number } = {
    targetBytes: DOCUMENT_IMAGE_TARGET_BYTES,
    maxBytes: DOCUMENT_IMAGE_MAX_BYTES,
  },
): Promise<CompressionOutcome<T>> {
  let smallest: { image: T; step: CompressionStep } | null = null;

  for (const step of steps) {
    const image = await encode(step, fitLongSide(original, step.longSide));
    if (image.sizeBytes <= limits.targetBytes && image.sizeBytes < limits.maxBytes) {
      return { ok: true, image, step };
    }
    if (!smallest || image.sizeBytes < smallest.image.sizeBytes) smallest = { image, step };
  }

  if (smallest && smallest.image.sizeBytes < limits.maxBytes) {
    return { ok: true, image: smallest.image, step: smallest.step };
  }
  return { ok: false, reason: 'too-large', smallestBytes: smallest?.image.sizeBytes ?? 0 };
}

/** Number of bytes a base64 string decodes to. */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/[\r\n\s]/g, '');
  if (clean.length === 0) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
