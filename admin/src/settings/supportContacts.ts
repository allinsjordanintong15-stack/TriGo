import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase/config';

// supportContacts/{contactId}: shown on the app's Help screen (active ones, tap to call).
// firestore.rules: admins write the complete document and may delete; signed-in users
// read active contacts only.
const CONTACTS = collection(db, 'supportContacts');

export type SupportContactInput = {
  label: string;
  phone: string;
  active: boolean;
  sortOrder: number;
};

export type SupportContact = SupportContactInput & {
  id: string;
  updatedAt: Date | null;
};

export const LABEL_MAX_LENGTH = 60;
export const SORT_ORDER_RANGE = { min: 0, max: 99 } as const;

/** Lowest sortOrder first, then by label (the app's Help screen uses the same order). */
export function compareContacts(a: SupportContactInput, b: SupportContactInput): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

export async function loadSupportContacts(): Promise<SupportContact[]> {
  const snapshot = await getDocs(CONTACTS);
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        label: typeof data.label === 'string' ? data.label : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        active: data.active === true,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
      };
    })
    .sort(compareContacts);
}

/** Creates a contact (no id) or replaces an existing one with the complete document. */
export async function saveSupportContact(id: string | null, contact: SupportContactInput, uid: string): Promise<void> {
  const write = { ...contact, updatedAt: serverTimestamp(), updatedBy: uid };
  if (id) {
    await setDoc(doc(CONTACTS, id), write);
  } else {
    await addDoc(CONTACTS, write);
  }
}

export async function deleteSupportContact(id: string): Promise<void> {
  await deleteDoc(doc(CONTACTS, id));
}

/** Trims and collapses spaces; returns the label or an error message. */
export function parseLabel(input: string): { value: string } | { error: string } {
  const value = input.trim().replace(/\s+/g, ' ');
  if (!value) return { error: 'Required.' };
  if (value.length > LABEL_MAX_LENGTH) return { error: `At most ${LABEL_MAX_LENGTH} characters.` };
  return { value };
}

/**
 * Digits with optional spaces, dashes and brackets, an optional leading +, 7 to 15 digits,
 * ending in a digit (firestore.rules checks the same shape). Returns the trimmed number.
 */
export function parsePhone(input: string): { value: string } | { error: string } {
  const value = input.trim().replace(/\s+/g, ' ');
  if (!value) return { error: 'Required.' };
  const digits = value.replace(/\D/g, '').length;
  if (!/^\+?[0-9 ()-]{6,19}[0-9]$/.test(value) || digits < 7 || digits > 15) {
    return { error: 'Enter a phone number, e.g. 0917 123 4567 or (038) 123-4567.' };
  }
  return { value };
}

/** Parses a whole-number display order within SORT_ORDER_RANGE. */
export function parseSortOrder(input: string): { value: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Required.' };
  if (!/^\d+$/.test(text)) return { error: 'Enter a whole number.' };
  const value = Number(text);
  if (value < SORT_ORDER_RANGE.min || value > SORT_ORDER_RANGE.max) {
    return { error: `Must be ${SORT_ORDER_RANGE.min} to ${SORT_ORDER_RANGE.max}.` };
  }
  return { value };
}
