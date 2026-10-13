import { COLLECTIONS, firestore } from '@/firebase';
import { User } from '@/types';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, WriteBatch } from 'firebase/firestore';

/**
 * A user's name and mobile number at contacts/{uid}. Firestore rules let only the owner
 * write it (equal to users/{uid}) and let the other party read it only during an active
 * trip (accepted, arrived or in progress) between that passenger and assigned driver.
 */
export interface Contact {
  fullName: string;
  mobileNumber: string;
}

function contactRef(uid: string) {
  return doc(firestore, COLLECTIONS.contacts, uid);
}

function contactData(fullName: string, mobileNumber: string) {
  return { fullName, mobileNumber, updatedAt: serverTimestamp() };
}

/** Adds the owner's contact card update to a profile-edit batch (values as written to users/{uid}). */
export function addOwnContactToBatch(
  batch: WriteBatch,
  uid: string,
  fullName: string,
  mobileNumber: string,
): void {
  batch.set(contactRef(uid), contactData(fullName, mobileNumber));
}

/**
 * Creates or refreshes the signed-in user's card so it matches their profile. Run after
 * the profile loads; it backfills accounts created before contact cards existed and fixes
 * any card that missed a profile edit.
 */
export async function syncOwnContact(user: User): Promise<void> {
  if (!user.fullName || !user.mobileNumber) return;

  const ref = contactRef(user.uid);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  if (data && data.fullName === user.fullName && data.mobileNumber === user.mobileNumber) return;

  await setDoc(ref, contactData(user.fullName, user.mobileNumber));
}

/**
 * The other party's card during an active trip. Emits null whenever it cannot be read
 * (no active trip between the two, not created yet, offline); callers hide the contact.
 */
export function subscribeToContact(
  uid: string,
  onUpdate: (contact: Contact | null) => void,
): () => void {
  return onSnapshot(
    contactRef(uid),
    (snapshot) => {
      const data = snapshot.data();
      onUpdate(
        data && typeof data.mobileNumber === 'string'
          ? {
              fullName: typeof data.fullName === 'string' ? data.fullName : '',
              mobileNumber: data.mobileNumber,
            }
          : null,
      );
    },
    () => onUpdate(null),
  );
}
