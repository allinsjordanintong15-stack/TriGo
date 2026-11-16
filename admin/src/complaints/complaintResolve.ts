// Resolving a complaint in one step: the outcome, the admin note and the exact field values
// the complaint update sends (firestore.rules, complaints: isValidOutcome). No imports (the
// server time is passed in), so plain Node tests and the Firestore rules tests use this code.

export type ComplaintOutcome = 'no_action' | 'warned' | 'suspended';

/** Shown under "Resolved" in the list and on the panel. */
export const OUTCOME_LABELS: Record<ComplaintOutcome, string> = {
  no_action: 'No action',
  warned: 'Warned',
  suspended: 'Driver suspended',
};

export function readOutcome(value: unknown): ComplaintOutcome | null {
  return value === 'no_action' || value === 'warned' || value === 'suspended' ? value : null;
}

/** The admin note on resolve (admin-only; the rules allow up to 1000 on older notes). */
export const RESOLVE_NOTE_MAX_LENGTH = 500;

export const QUICK_NOTES = [
  'Reviewed — no violation found',
  'Spoke with both parties',
  'Warning issued',
  'Repeated behavior',
] as const;

/** A quick note added to what is already typed (on its own line), not replacing it. */
export function addQuickNote(current: string, note: string): string {
  const text = current.trim();
  if (!text) return note;
  if (text.split('\n').some((line) => line.trim() === note)) return text;
  return `${text}\n${note}`;
}

export type ResolveContext = {
  /** Stored on complaints filed from 2026-11-10; older ones have none. */
  reportedUserId: string | null | undefined;
  /** Who filed it: a passenger (about the driver) or a driver (about the passenger). */
  reporterRole: 'passenger' | 'driver' | null;
  /** warnings/{complaintId} already exists. */
  warningExists: boolean;
};

/** Why "Warn" can't be chosen, in one line; null when it can. */
export function warnBlockReason(ctx: ResolveContext): string | null {
  if (typeof ctx.reportedUserId !== 'string' || !ctx.reportedUserId) {
    return ctx.reportedUserId === null
      ? 'Nobody to warn: the trip had no driver.'
      : 'Filed before Nov 10, 2026, so it does not record who was reported.';
  }
  if (ctx.warningExists) return 'A warning was already sent for this complaint.';
  return null;
}

/** Why "Suspend driver" can't be chosen; null when it can. Only drivers are suspended. */
export function suspendBlockReason(ctx: ResolveContext): string | null {
  if (ctx.reporterRole !== 'passenger') return 'Only drivers can be suspended.';
  if (typeof ctx.reportedUserId !== 'string' || !ctx.reportedUserId) {
    return ctx.reportedUserId === null
      ? 'Nobody to suspend: the trip had no driver.'
      : 'Filed before Nov 10, 2026: suspend the driver from their page instead.';
  }
  return null;
}

/** Whether "Suspend driver" is offered at all (complaints about a driver). */
export function offersSuspend(reporterRole: 'passenger' | 'driver' | null): boolean {
  return reporterRole === 'passenger';
}

/** The complaint update when resolving with an outcome. */
export function resolvedComplaintUpdate(outcome: ComplaintOutcome, note: string, adminUid: string, now: unknown) {
  return {
    status: 'resolved' as const,
    outcome,
    adminNotes: note.trim(),
    resolvedAt: now,
    resolvedBy: adminUid,
    updatedAt: now,
    updatedBy: adminUid,
  };
}

/** Reopen (back to In review): the outcome is cleared, the note kept. */
export function reopenedComplaintUpdate(adminNotes: string, adminUid: string, now: unknown) {
  return {
    status: 'in_review' as const,
    outcome: null,
    resolvedAt: null,
    resolvedBy: null,
    adminNotes,
    updatedAt: now,
    updatedBy: adminUid,
  };
}

/** Error text, or null when the note can be saved (it is optional). */
export function validateResolveNote(note: string): string | null {
  return note.trim().length > RESOLVE_NOTE_MAX_LENGTH ? `At most ${RESOLVE_NOTE_MAX_LENGTH} characters.` : null;
}
