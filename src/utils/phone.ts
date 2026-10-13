/**
 * A `tel:` link for a stored mobile number, or null when it has no digits. Spaces, dashes
 * and brackets are dropped; a leading +63 (or 63, which gains the +) or 0 is kept, e.g.
 * "+63 917 123 4567" → "tel:+639171234567", "0917-123-4567" → "tel:09171234567".
 */
export function toTelUri(mobileNumber: string): string | null {
  const trimmed = mobileNumber.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) return `tel:+${digits}`;
  if (digits.startsWith('63') && digits.length === 12) return `tel:+${digits}`;
  return `tel:${digits}`;
}
