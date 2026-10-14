import { COLLECTIONS, firestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * A TriGo support line at supportContacts/{id}, managed on the admin website. Firestore
 * rules let signed-in users read only active contacts, so the query must filter on
 * active == true.
 */
export interface SupportContact {
  id: string;
  label: string;
  phone: string;
  sortOrder: number;
}

/** Active support contacts, lowest sortOrder first, then by label (as on the admin website). */
export async function fetchActiveSupportContacts(): Promise<SupportContact[]> {
  const snapshot = await getDocs(
    query(collection(firestore, COLLECTIONS.supportContacts), where('active', '==', true)),
  );

  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        label: typeof data.label === 'string' ? data.label : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      };
    })
    .filter((contact) => contact.label && contact.phone)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}
