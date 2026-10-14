// Passenger search, done in the browser because Firestore has no text search. Kept free
// of Firebase imports so it can be tested on its own.

export type Passenger = {
  uid: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  createdAt: Date | null;
};

/** Last 10 digits, so "09171234567", "+63 917 123 4567" and "9171234567" all match. */
function mobileKey(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

export function matchesSearch(passenger: Passenger, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  if (passenger.fullName.toLowerCase().includes(text) || passenger.email.toLowerCase().includes(text)) {
    return true;
  }
  // Drop a leading "63" or "0" so "0917…", "+63917…" and "917…" all search the same way.
  const digits = text.replace(/\D/g, '').replace(/^(63|0)/, '');
  // Need a few digits so "1" does not match every number.
  return digits.length >= 3 && mobileKey(passenger.mobileNumber).includes(digits);
}
