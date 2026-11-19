// Announcements (Admin Website → Announcements): one announcements/{id} document per
// announcement, read by every signed-in user of its audience in the app inbox. Payloads and
// checks only; no imports (server time and timestamps are passed in), so plain Node tests
// and the Firestore rules tests use this code. Limits match firestore.rules.

export type AnnouncementAudience = 'all' | 'passengers' | 'drivers';

export const ANNOUNCEMENT_AUDIENCES: { value: AnnouncementAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'All users', hint: 'Every passenger and driver.' },
  { value: 'passengers', label: 'Passengers', hint: 'Every passenger account (also passengers who drive).' },
  { value: 'drivers', label: 'Drivers', hint: 'Driver accounts and approved driver applicants.' },
];

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 120;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 1000;

export type AnnouncementDraft = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  /** 'YYYY-MM-DD' (shown through the end of that day, Philippine time), or '' for no end. */
  showUntilDate: string;
};

export type AnnouncementErrors = Partial<Record<'title' | 'body' | 'showUntilDate', string>>;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The end of a 'YYYY-MM-DD' day in the Philippines (23:59:59.999 at UTC+8), in milliseconds;
 * null when the text is not a real date.
 */
export function endOfManilaDayMillis(date: string): number | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  // Next day's 00:00 in Manila (UTC+8) minus 1 ms.
  return utc + 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000 - 1;
}

export function validateAnnouncement(draft: AnnouncementDraft, nowMillis: number): AnnouncementErrors {
  const errors: AnnouncementErrors = {};
  const title = draft.title.trim();
  const body = draft.body.trim();
  if (!title) errors.title = 'Write a title.';
  else if (title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH)
    errors.title = `Keep the title to ${ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`;
  if (!body) errors.body = 'Write the message.';
  else if (body.length > ANNOUNCEMENT_BODY_MAX_LENGTH)
    errors.body = `Keep the message to ${ANNOUNCEMENT_BODY_MAX_LENGTH} characters or fewer.`;
  if (draft.showUntilDate) {
    const end = endOfManilaDayMillis(draft.showUntilDate);
    if (end === null) errors.showUntilDate = 'Choose a valid date.';
    else if (end <= nowMillis) errors.showUntilDate = 'Choose today or a later date.';
  }
  return errors;
}

export function hasAnnouncementErrors(errors: AnnouncementErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The new announcements/{id} document. `showUntil` is a timestamp or null (until withdrawn). */
export function newAnnouncementDoc(
  draft: AnnouncementDraft,
  showUntil: unknown,
  adminUid: string,
  now: unknown,
) {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.audience,
    showUntil,
    status: 'active' as const,
    createdBy: adminUid,
    createdAt: now,
    withdrawnAt: null,
    withdrawnBy: null,
  };
}

/** Withdrawing: it leaves every inbox at once; the text stays for the record. */
export function withdrawnAnnouncementUpdate(adminUid: string, now: unknown) {
  return { status: 'withdrawn' as const, withdrawnAt: now, withdrawnBy: adminUid };
}

export type AnnouncementState = 'showing' | 'ended' | 'withdrawn';

/** What users see now: withdrawn, past its "show until" (ended), or still showing. */
export function announcementState(
  status: string,
  showUntilMillis: number | null,
  nowMillis: number,
): AnnouncementState {
  if (status === 'withdrawn') return 'withdrawn';
  if (showUntilMillis !== null && showUntilMillis <= nowMillis) return 'ended';
  return 'showing';
}
