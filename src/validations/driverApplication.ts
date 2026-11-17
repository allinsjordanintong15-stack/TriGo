// Letters (including accented, e.g. "Peña"), spaces, periods, apostrophes and hyphens.
const NAME_PATTERN = /^[\p{L}][\p{L} .'-]*$/u;
const NAME_MAX_LENGTH = 50;

const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{0,10}[A-Z0-9]$/;

// Must stay in sync with isValidVehicleDetails in firestore.rules.
export const VEHICLE_BRAND_MAX_LENGTH = 30;
export const VEHICLE_MODEL_MAX_LENGTH = 40;
export const VEHICLE_COLOR_MAX_LENGTH = 20;
const VEHICLE_BRAND_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9 ./+-]{0,28}[A-Za-z0-9.])?$/;
const VEHICLE_MODEL_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9 ./+-]{0,38}[A-Za-z0-9.])?$/;
const VEHICLE_COLOR_PATTERN = /^[A-Za-z]([A-Za-z /-]{0,18}[A-Za-z])?$/;

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

/** Trim and collapse inner whitespace: "  TMX   155 " → "TMX 155". Case is kept as typed. */
export function normalizeVehicleText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function validateVehicleText(
  value: string,
  label: string,
  maxLength: number,
  pattern: RegExp,
  allowed: string,
): string | null {
  const normalized = normalizeVehicleText(value);
  if (!normalized) return `${label} is required.`;
  if (normalized.length > maxLength) return `${label} must be ${maxLength} characters or fewer.`;
  if (!pattern.test(normalized)) return `${label} can only contain ${allowed}.`;
  return null;
}

/** e.g. "Honda", "Rusi", "TVS". */
export function validateVehicleBrand(brand: string): string | null {
  return validateVehicleText(
    brand,
    'Brand',
    VEHICLE_BRAND_MAX_LENGTH,
    VEHICLE_BRAND_PATTERN,
    'letters and numbers, with spaces or . / + - between them',
  );
}

/** e.g. "TMX 155", "Click 125i", "Barako II". */
export function validateVehicleModel(model: string): string | null {
  return validateVehicleText(
    model,
    'Model',
    VEHICLE_MODEL_MAX_LENGTH,
    VEHICLE_MODEL_PATTERN,
    'letters and numbers, with spaces or . / + - between them',
  );
}

/** e.g. "Red", "Blue/White", "Dark Green". */
export function validateVehicleColor(color: string): string | null {
  return validateVehicleText(
    color,
    'Color',
    VEHICLE_COLOR_MAX_LENGTH,
    VEHICLE_COLOR_PATTERN,
    'letters, with spaces, / or - between them',
  );
}
