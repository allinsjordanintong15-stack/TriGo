// Letters (including accented, e.g. "Peña"), spaces, periods, apostrophes and hyphens.
const NAME_PATTERN = /^[\p{L}][\p{L} .'-]*$/u;
const NAME_MAX_LENGTH = 50;

const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{0,10}[A-Z0-9]$/;

/** Image types accepted for driver application documents. */
export const ACCEPTED_DOCUMENT_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/** Must stay in sync with the limit in storage.rules. */
export const MAX_DOCUMENT_IMAGE_BYTES = 10 * 1024 * 1024;

/** Trim and collapse inner whitespace: "  juan   carlo " → "juan carlo". */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validatePersonName(
  value: string,
  label: string,
  required: boolean,
): string | null {
  const normalized = normalizePersonName(value);
  if (!normalized) return required ? `${label} is required.` : null;
  if (normalized.length > NAME_MAX_LENGTH) {
    return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (!NAME_PATTERN.test(normalized)) {
    return `${label} can only contain letters, spaces, periods, apostrophes and hyphens.`;
  }
  return null;
}

/** Uppercase, trim and collapse spaces, e.g. " abc  1234 " → "ABC 1234". */
export function normalizeVehiclePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function validateVehiclePlate(plate: string): string | null {
  const normalized = normalizeVehiclePlate(plate);
  if (!normalized) return 'Plate number is required.';
  if (!PLATE_PATTERN.test(normalized)) {
    return 'Enter a valid plate number (2–12 letters or numbers; spaces and hyphens allowed).';
  }
  return null;
}

/**
 * Validate a picked image using the metadata the picker provides. Missing metadata is
 * allowed (not every platform reports it); Storage rules enforce type and size again.
 */
export function validateDocumentImage(image: {
  mimeType?: string | null;
  fileSize?: number | null;
}): string | null {
  const mimeType = image.mimeType?.toLowerCase();
  if (mimeType && !(ACCEPTED_DOCUMENT_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    return 'Unsupported file type. Please use a JPG, PNG, WEBP or HEIC image.';
  }
  if (image.fileSize && image.fileSize > MAX_DOCUMENT_IMAGE_BYTES) {
    return 'This image is larger than 10 MB. Please take a new photo or choose a smaller image.';
  }
  return null;
}
