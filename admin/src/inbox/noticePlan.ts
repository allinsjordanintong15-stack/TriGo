// System notices: the adminMessages/{id} an admin decision writes to the affected user's
// in-app inbox, in the SAME transaction as the decision (firestore.rules, Admin messages,
// checks each against the document the decision changes). No imports (server time is passed
// in), so plain Node tests and the Firestore rules tests use this code.
//
//   application_approved / application_rejected → the applicant (driverApplications/{uid});
//     the rejection's reason is the admin's remarks, exactly as stored on the application.
//   payment_confirmed / payment_rejected → the paying driver; refId = commissionPayments ID;
//     the rejection's reason is the payment's rejectionReason.
//   report_resolved → the complaint's reporter; refId = complaint ID. Never the admin's note
//     or what happened to the other person: reason is always ''.
//   deletion_declined → the user (deletionRequests/{uid}); reason = the decline note.

export type NoticeKind =
  | 'application_approved'
  | 'application_rejected'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'report_resolved'
  | 'deletion_declined';

export const NOTICE_KINDS: NoticeKind[] = [
  'application_approved',
  'application_rejected',
  'payment_confirmed',
  'payment_rejected',
  'report_resolved',
  'deletion_declined',
];

export const NOTICE_KIND_LABELS: Record<NoticeKind, string> = {
  application_approved: 'Application approved',
  application_rejected: 'Application not approved',
  payment_confirmed: 'Payment confirmed',
  payment_rejected: 'Payment not accepted',
  report_resolved: 'Report reviewed',
  deletion_declined: 'Deletion request declined',
};

/** "₱1,234.50" from centavos (the admin website's own formatter is not imported here). */
export function pesoText(centavos: number): string {
  const [whole, cents] = (Math.max(0, centavos) / 100).toFixed(2).split('.');
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

export type NoticeInput =
  | { kind: 'application_approved'; userId: string }
  | { kind: 'application_rejected'; userId: string; remarks: string }
  | { kind: 'payment_confirmed'; userId: string; paymentId: string; amountCentavos: number; reference: string }
  | {
      kind: 'payment_rejected';
      userId: string;
      paymentId: string;
      amountCentavos: number;
      reference: string;
      reason: string;
    }
  | { kind: 'report_resolved'; userId: string; complaintId: string; tripDateLabel: string | null }
  | { kind: 'deletion_declined'; userId: string; note: string };

/** Title and body the user reads (reason is shown separately, under "Reason"/"Remarks"). */
export function noticeText(input: NoticeInput): { title: string; body: string } {
  switch (input.kind) {
    case 'application_approved':
      return {
        title: 'Your driver application was approved',
        body: 'Welcome to TriGo as a driver! Switch to Driver Mode to go online and start accepting ride requests.',
      };
    case 'application_rejected':
      return {
        title: 'Your driver application was not approved',
        body: 'Please read the remarks from the TriGo team, fix the details or photos, and send your application again.',
      };
    case 'payment_confirmed':
      return {
        title: 'Your commission payment was confirmed',
        body: `TriGo confirmed your GCash payment of ${pesoText(input.amountCentavos)} (reference ${input.reference}). It is now applied to your commission balance.`,
      };
    case 'payment_rejected':
      return {
        title: 'Your commission payment was not accepted',
        body: `TriGo could not confirm your GCash payment of ${pesoText(input.amountCentavos)} (reference ${input.reference}). Check the reason, then submit the payment again with the correct details.`,
      };
    case 'report_resolved':
      return {
        title: 'Your report was reviewed',
        body: `We reviewed your report about your trip${
          input.tripDateLabel ? ` on ${input.tripDateLabel}` : ''
        }. Thank you for helping keep TriGo safe.`,
      };
    case 'deletion_declined':
      return {
        title: 'Your account deletion request was declined',
        body: 'TriGo did not delete your account. Read the reason below. You can ask again from Profile → Privacy Policy & Terms.',
      };
  }
}

function noticeReason(input: NoticeInput): string {
  switch (input.kind) {
    case 'application_rejected':
      return input.remarks;
    case 'payment_rejected':
      return input.reason;
    case 'deletion_declined':
      return input.note;
    default:
      return '';
  }
}

function noticeRefId(input: NoticeInput): string | null {
  switch (input.kind) {
    case 'payment_confirmed':
    case 'payment_rejected':
      return input.paymentId;
    case 'report_resolved':
      return input.complaintId;
    default:
      return null;
  }
}

/**
 * The new adminMessages/{id} document. `reason` must equal what the decision stores (the
 * caller passes the same trimmed text it writes to the application, payment or request).
 */
export function newNoticeDoc(input: NoticeInput, adminUid: string, now: unknown) {
  const text = noticeText(input);
  return {
    userId: input.userId,
    kind: input.kind,
    title: text.title,
    body: text.body,
    reason: noticeReason(input),
    until: null,
    refId: noticeRefId(input),
    createdBy: adminUid,
    createdAt: now,
    readAt: null,
  };
}

// ─── Remark chips (reject dialogs) ───────────────────────────────────────────

/** Quick-fill remarks for rejecting a driver application (shown to the applicant). */
export const APPLICATION_REJECT_REMARKS: readonly string[] = [
  'Photo is blurry — please retake',
  'Document is expired',
  'Name does not match',
  'Plate number does not match',
];

/** Quick-fill reasons for rejecting a commission payment (shown to the driver). */
export const PAYMENT_REJECT_REASONS: readonly string[] = ['Reference number not found', 'Amount does not match'];

/**
 * Adds a chip's text to what the admin already wrote: on its own when the field is empty,
 * else on a new line; a chip already in the text is not added twice.
 */
export function addRemarkChip(current: string, chip: string): string {
  const text = current.trimEnd();
  if (!text) return chip;
  if (text.split('\n').some((line) => line.trim() === chip)) return current;
  return `${text}\n${chip}`;
}
