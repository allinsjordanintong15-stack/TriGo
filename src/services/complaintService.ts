import { COLLECTIONS, firestore } from '@/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

export type ComplaintRole = 'passenger' | 'driver';

export type ComplaintCategory =
  | 'driver_behavior'
  | 'passenger_behavior'
  | 'fare_or_payment'
  | 'safety'
  | 'lost_item'
  | 'app_problem'
  | 'other';

export type ComplaintStatus = 'open' | 'in_review' | 'resolved';

export const COMPLAINT_MESSAGE_MAX_LENGTH = 1000;

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  driver_behavior: 'Driver behavior',
  passenger_behavior: 'Passenger behavior',
  fare_or_payment: 'Fare or payment',
  safety: 'Safety concern',
  lost_item: 'Lost item',
  app_problem: 'Problem with the app',
  other: 'Something else',
};

/** Categories each side can choose (firestore.rules: nobody reports their own role's behavior). */
export const COMPLAINT_CATEGORIES: Record<ComplaintRole, ComplaintCategory[]> = {
  passenger: ['driver_behavior', 'fare_or_payment', 'safety', 'lost_item', 'app_problem', 'other'],
  driver: ['passenger_behavior', 'fare_or_payment', 'safety', 'lost_item', 'app_problem', 'other'],
};

/** How the reporter sees the admin's status. */
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Received',
  in_review: 'Being reviewed',
  resolved: 'Resolved',
};

export interface OwnComplaint {
  category: ComplaintCategory | null;
  message: string;
  status: ComplaintStatus;
  createdAt: Date | null;
}

export class ComplaintServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComplaintServiceError';
  }
}

/**
 * complaints/{bookingId}_{uid}: one report per booking per person. Firestore rules let
 * the booking's passenger or assigned driver create it once, and only them (and admins)
 * read it. Admin notes are never shown in the app.
 */
function complaintRef(bookingId: string, uid: string) {
  return doc(firestore, COLLECTIONS.complaints, `${bookingId}_${uid}`);
}

/** The signed-in user's report for this booking, or null when they have not reported it. */
export async function getOwnComplaint(bookingId: string, uid: string): Promise<OwnComplaint | null> {
  const snapshot = await getDoc(complaintRef(bookingId, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    category:
      typeof data.category === 'string' && data.category in COMPLAINT_CATEGORY_LABELS
        ? (data.category as ComplaintCategory)
        : null,
    message: typeof data.message === 'string' ? data.message : '',
    status:
      data.status === 'in_review' || data.status === 'resolved' ? data.status : 'open',
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

export async function submitComplaint(
  bookingId: string,
  uid: string,
  role: ComplaintRole,
  category: ComplaintCategory,
  message: string,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new ComplaintServiceError('Please describe the problem.');
  }
  if (trimmed.length > COMPLAINT_MESSAGE_MAX_LENGTH) {
    throw new ComplaintServiceError(
      `Please keep your message to ${COMPLAINT_MESSAGE_MAX_LENGTH} characters or fewer.`,
    );
  }

  try {
    await setDoc(complaintRef(bookingId, uid), {
      bookingId,
      reporterId: uid,
      reporterRole: role,
      category,
      message: trimmed,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'permission-denied') {
      // An existing report makes this an update, which only admins may do.
      const existing = await getOwnComplaint(bookingId, uid).catch(() => null);
      throw new ComplaintServiceError(
        existing
          ? 'You have already reported a problem for this booking.'
          : 'You can only report a problem for your own booking.',
      );
    }
    throw new ComplaintServiceError(
      'Unable to send your report. Please check your internet connection and try again.',
    );
  }
}
