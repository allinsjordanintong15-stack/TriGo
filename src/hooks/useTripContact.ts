import { Contact, subscribeToContact } from '@/services/contactService';
import { BookingStatus } from '@/types';
import { useEffect, useState } from 'react';

const CONTACT_SHARED_STATUSES: BookingStatus[] = ['accepted', 'arrived', 'in_progress'];

/**
 * The other party's contact card for a trip, or null when it is not readable. Subscribes
 * only while the booking is active (when Firestore rules allow the read) and again on each
 * status change, so a listener denied while pending is retried once the driver accepts.
 */
export function useTripContact(uid: string | null, status: BookingStatus | null): Contact | null {
  const [contact, setContact] = useState<Contact | null>(null);
  const shared = status !== null && CONTACT_SHARED_STATUSES.includes(status);

  useEffect(() => {
    setContact(null);
    if (!uid || !shared) return;
    return subscribeToContact(uid, setContact);
  }, [uid, shared, status]);

  return shared ? contact : null;
}
