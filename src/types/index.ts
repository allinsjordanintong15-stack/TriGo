export type UserRole = 'passenger' | 'driver' | 'admin';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export type VehicleType = 'tricycle' | 'motorcycle';

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'out_of_area_searching'
  | 'driver_interested'
  | 'fare_negotiation'
  | 'awaiting_passenger_confirmation'
  | 'confirmed';

export type BookingType = 'standard' | 'out_of_area';

export type OutOfAreaRequestStatus =
  | 'searching'
  | 'driver_interested'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface FareAgreement {
  standardEstimatedFare: number;
  driverProposedFare: number;
  agreedFare: number;
  agreedByPassenger: boolean;
  agreedByDriver: boolean;
  agreedAt: Date | null;
}

export interface OutOfAreaFareSettings {
  enabled: boolean;
  maximumAdditionalPercentage: number | null;
  minimumFare: number | null;
  allowDriverNegotiation: boolean;
  requestExpiryMinutes: number;
  driverSearchRadiusKm: number;
}

export interface OutOfAreaRequest {
  requestId: string;
  passengerId: string;
  pickupLocation: Location;
  destination: Location;
  vehicleType: VehicleType;
  distanceKm: number;
  standardEstimatedFare: number;
  suggestedAgreementFare: number | null;
  agreedFare: number | null;
  status: OutOfAreaRequestStatus;
  driverId: string | null;
  fareAgreement: FareAgreement | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface AvailableDriver {
  driverId: string;
  fullName: string;
  profileImage: string | null;
  vehicleType: VehicleType;
  vehiclePlate: string;
  rating: number;
  distanceToPickupKm: number;
  isOnline: boolean;
  isVerified: boolean;
}

export interface User {
  uid: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Passenger extends User {
  role: 'passenger';
}

export type DriverApplicationStatus = 'pending' | 'approved' | 'rejected';

export type DriverApplicationDocumentType = 'orCr' | 'ltoLicense';

/** A verification image in Cloud Storage; the file itself is never stored in Firestore. */
export interface DriverApplicationDocument {
  /** `driverApplications/{uid}/{orCr | ltoLicense}` in Cloud Storage. */
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  contentType: string;
  uploadedAt: Date | null;
}

export interface DriverApplicationDocuments {
  /** OR/CR of the registered vehicle. */
  orCr: DriverApplicationDocument | null;
  /** LTO-verified driver's license. */
  ltoLicense: DriverApplicationDocument | null;
}

/**
 * A passenger's application to become a TriGo driver, stored at `driverApplications/{uid}`
 * (one per Firebase Auth account, so one per email). `status`, `adminRemarks` and
 * `reviewedAt` are controlled by administrators only.
 */
export interface DriverApplication {
  uid: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  /** "First Middle Last", kept for screens and admin tools that expect a single name. */
  fullName: string;
  /** The applicant's Firebase Auth email (the same account they use as a passenger). */
  email: string;
  /** Snapshot of `users/{uid}.mobileNumber` at submission. */
  mobileNumber: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  documents: DriverApplicationDocuments;
  status: DriverApplicationStatus;
  adminRemarks: string | null;
  submittedAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
}

/** Roles that have an interface in the TriGo mobile app (admins use the Admin Website). */
export type MobileUserRole = 'passenger' | 'driver';

export interface DriverUser extends User {
  role: 'driver';
}

/**
 * Driver record stored at `drivers/{uid}` (managed by TriGo admins).
 * Account details (email, mobile number) stay in `users/{uid}` and are not duplicated here.
 */
export interface DriverRecord {
  driverId: string;
  fullName: string;
  profileImage: string | null;
  vehicleType: VehicleType;
  vehiclePlate: string;
  rating: number;
  isOnline: boolean;
  isVerified: boolean;
  isAvailable: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
}

export interface Booking {
  bookingId: string;
  passengerId: string;
  driverId: string | null;
  vehicleType: VehicleType;
  bookingType: BookingType;
  pickupLocation: Location;
  destination: Location;
  distanceKm: number;
  estimatedFare: number;
  driverProposedFare: number | null;
  agreedFare: number | null;
  fareAgreement: FareAgreement | null;
  finalFare: number | null;
  status: BookingStatus;
  outOfAreaRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

export interface Rating {
  ratingId: string;
  bookingId: string;
  passengerId: string;
  driverId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export type NotificationType =
  | 'booking_created'
  | 'driver_accepted'
  | 'driver_arriving'
  | 'ride_started'
  | 'ride_completed'
  | 'booking_cancelled';

export interface AppNotification {
  notificationId: string;
  userId: string;
  bookingId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

export interface RegisterPassengerInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  mobileNumber: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface FareSettings {
  tricycle: {
    baseFare: number;
    perKm: number;
  };
  motorcycle: {
    baseFare: number;
    perKm: number;
  };
}

export interface TripQuote {
  pickupLocation: Location;
  destination: Location;
  vehicleType: VehicleType;
  distanceKm: number;
  standardEstimatedFare: number;
  bookingType: BookingType;
  isOutOfArea: boolean;
}
