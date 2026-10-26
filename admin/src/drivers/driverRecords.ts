import type { DocumentData, Timestamp } from 'firebase/firestore';

import { matchesMobile } from '../passengers/search';

// drivers/{uid} as the admin Drivers page sees it. The driver writes their duty status and
// trip links from the app; admins write only isVerified, isOnline/isAvailable (forced off
// when revoking), the verification* audit fields, and vehicleType/vehiclePlate while the
// driver has no trip or request (firestore.rules). Kept free of Firebase runtime imports.

export const MAX_VERIFICATION_NOTE_LENGTH = 500;

export const DRIVER_VEHICLE_TYPES = ['tricycle', 'motorcycle'] as const;

export type DriverVehicleType = (typeof DRIVER_VEHICLE_TYPES)[number];

// Same as the driver application (src/validations/driverApplication.ts) and
// isValidVehiclePlate in firestore.rules.
const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{0,10}[A-Z0-9]$/;

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

// Same as the driver application (src/validations/driverApplication.ts) and
// isValidVehicleDetails in firestore.rules.
export const MAX_VEHICLE_BRAND_LENGTH = 30;
export const MAX_VEHICLE_MODEL_LENGTH = 40;
export const MAX_VEHICLE_COLOR_LENGTH = 20;
const VEHICLE_BRAND_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9 ./+-]{0,28}[A-Za-z0-9.])?$/;
const VEHICLE_MODEL_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9 ./+-]{0,38}[A-Za-z0-9.])?$/;
const VEHICLE_COLOR_PATTERN = /^[A-Za-z]([A-Za-z /-]{0,18}[A-Za-z])?$/;

/** The app's color chips (src/constants/vehicles.ts); any other valid color can be typed. */
export const VEHICLE_COLORS = [
  'White',
  'Black',
  'Silver',
  'Gray',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Orange',
  'Maroon',
  'Brown',
] as const;

/** Brand, model and color, as passengers see them ("Red Honda TMX 155"). */
export type VehicleDetails = { vehicleBrand: string; vehicleModel: string; vehicleColor: string };

/** Trim and collapse inner spaces; case is kept as typed. */
export function normalizeVehicleText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeVehicleDetails(details: VehicleDetails): VehicleDetails {
  return {
    vehicleBrand: normalizeVehicleText(details.vehicleBrand),
    vehicleModel: normalizeVehicleText(details.vehicleModel),
    vehicleColor: normalizeVehicleText(details.vehicleColor),
  };
}

function validateVehicleText(value: string, label: string, maxLength: number, pattern: RegExp, allowed: string) {
  const normalized = normalizeVehicleText(value);
  if (!normalized) return `${label} is required.`;
  if (normalized.length > maxLength) return `At most ${maxLength} characters.`;
  if (!pattern.test(normalized)) return `Use ${allowed}.`;
  return null;
}

export type VehicleDetailErrors = Record<keyof VehicleDetails, string | null>;

export function validateVehicleDetails(details: VehicleDetails): VehicleDetailErrors {
  const brandOrModel = 'letters and numbers, with spaces or . / + - between them';
  return {
    vehicleBrand: validateVehicleText(details.vehicleBrand, 'Brand', MAX_VEHICLE_BRAND_LENGTH, VEHICLE_BRAND_PATTERN, brandOrModel),
    vehicleModel: validateVehicleText(details.vehicleModel, 'Model', MAX_VEHICLE_MODEL_LENGTH, VEHICLE_MODEL_PATTERN, brandOrModel),
    vehicleColor: validateVehicleText(
      details.vehicleColor,
      'Color',
      MAX_VEHICLE_COLOR_LENGTH,
      VEHICLE_COLOR_PATTERN,
      'letters, with spaces, / or - between them',
    ),
  };
}

export function hasVehicleDetailErrors(errors: VehicleDetailErrors): boolean {
  return Object.values(errors).some((message) => message !== null);
}

/** A stored detail, or null when missing (records and applications from before they existed). */
export function readVehicleText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export type AdminDriver = {
  uid: string;
  fullName: string;
  vehiclePlate: string;
  /** null on records approved before brand, model and color existed. */
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  /** null when the stored value is missing or not exactly 'tricycle' or 'motorcycle'. */
  vehicleType: DriverVehicleType | null;
  isVerified: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  currentBookingId: string | null;
  currentRequestId: string | null;
  rating: number | null;
  /** Reason given when verification was revoked; null otherwise. */
  verificationNote: string | null;
  verificationUpdatedAt: Date | null;
  verificationUpdatedBy: string | null;
};

/** From users/{uid}; the driver record has no contact details. */
export type DriverContact = { email: string; mobileNumber: string };

export function readDriver(uid: string, data: DocumentData): AdminDriver {
  const vehicleType = data.vehicleType === 'tricycle' || data.vehicleType === 'motorcycle' ? data.vehicleType : null;
  return {
    uid,
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    vehiclePlate: typeof data.vehiclePlate === 'string' ? data.vehiclePlate : '',
    vehicleBrand: readVehicleText(data.vehicleBrand),
    vehicleModel: readVehicleText(data.vehicleModel),
    vehicleColor: readVehicleText(data.vehicleColor),
    vehicleType,
    isVerified: data.isVerified === true,
    isOnline: data.isOnline === true,
    isAvailable: data.isAvailable === true,
    currentBookingId: typeof data.currentBookingId === 'string' ? data.currentBookingId : null,
    currentRequestId: typeof data.currentRequestId === 'string' ? data.currentRequestId : null,
    rating: typeof data.rating === 'number' && Number.isFinite(data.rating) ? data.rating : null,
    verificationNote: typeof data.verificationNote === 'string' ? data.verificationNote : null,
    verificationUpdatedAt: (data.verificationUpdatedAt as Timestamp | undefined)?.toDate?.() ?? null,
    verificationUpdatedBy: typeof data.verificationUpdatedBy === 'string' ? data.verificationUpdatedBy : null,
  };
}

/** 'revoked' = an admin revoked verification on this page; 'unverified' = never verified. */
export type VerificationStatus = 'verified' | 'revoked' | 'unverified';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  revoked: 'Revoked',
  unverified: 'Not verified',
};

/** Reuses the driver-application badge colours (status-badge). */
export const VERIFICATION_BADGE_CLASS: Record<VerificationStatus, string> = {
  verified: 'status-approved',
  revoked: 'status-rejected',
  unverified: 'status-pending',
};

export function verificationStatus(driver: AdminDriver): VerificationStatus {
  if (driver.isVerified) return 'verified';
  return driver.verificationUpdatedAt ? 'revoked' : 'unverified';
}

export type DutyStatus = 'on_trip' | 'holding_request' | 'available' | 'online' | 'offline';

export const DUTY_LABELS: Record<DutyStatus, string> = {
  on_trip: 'On a trip',
  holding_request: 'Out-of-area request',
  available: 'Available',
  online: 'Online, busy',
  offline: 'Offline',
};

export function dutyStatus(driver: AdminDriver): DutyStatus {
  if (driver.currentBookingId) return 'on_trip';
  if (driver.currentRequestId) return 'holding_request';
  if (driver.isOnline) return driver.isAvailable ? 'available' : 'online';
  return 'offline';
}

export function matchesDriverSearch(driver: AdminDriver, contact: DriverContact | undefined, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  // Plates are compared without spaces or dashes ("ABC 1234" = "abc1234").
  const plateKey = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');
  if (driver.fullName.toLowerCase().includes(text)) return true;
  if (plateKey(text) && plateKey(driver.vehiclePlate).includes(plateKey(text))) return true;
  if (contact?.email.toLowerCase().includes(text)) return true;
  return contact ? matchesMobile(contact.mobileNumber, text) : false;
}
