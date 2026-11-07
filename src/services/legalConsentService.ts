// Recording acceptance of the Privacy Notice and Terms of Use. The Firestore rules accept
// users/{uid}.legalConsent {version, acceptedAt} only together with the consent log entry
// users/{uid}/legalConsents/{version} in the same commit, both at server time, and only
// for the current version (currentLegalVersion() in firestore.rules = LEGAL_VERSION).

import { LEGAL_VERSION } from '@/constants/legal';
import { COLLECTIONS, firestore } from '@/firebase';
import { doc, serverTimestamp, writeBatch, WriteBatch } from 'firebase/firestore';

/** Subcollection of users/{uid}: one create-only entry per accepted version. */
export const LEGAL_CONSENTS_SUBCOLLECTION = 'legalConsents';

/** The legalConsent field value for the current version, stamped at server time. */
export function newLegalConsentField() {
  return { version: LEGAL_VERSION, acceptedAt: serverTimestamp() };
}

/** Adds the consent log entry for the current version to a batch that also sets legalConsent. */
export function addConsentLogToBatch(batch: WriteBatch, uid: string): void {
  batch.set(
    doc(firestore, COLLECTIONS.users, uid, LEGAL_CONSENTS_SUBCOLLECTION, LEGAL_VERSION),
    newLegalConsentField(),
  );
}

/**
 * Re-consent (any role): accept the current version. Only legalConsent and updatedAt change
 * on the profile, with the log entry in the same commit.
 */
export async function acceptCurrentLegalVersion(uid: string): Promise<void> {
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, COLLECTIONS.users, uid), {
    legalConsent: newLegalConsentField(),
    updatedAt: serverTimestamp(),
  });
  addConsentLogToBatch(batch, uid);
  await batch.commit();
}
