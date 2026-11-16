// Admin actions on a driver (Drivers → All drivers "⋯" menu): the exact field values each
// write sends and the text of the message the driver receives. No imports (server time and
// timestamps are passed in), so plain Node tests and the Firestore rules tests use this code.
//
// drivers/{uid} admin suspension (firestore.rules, drivers: admin suspend / lift):
//   suspendedAt (server time), suspendedUntil (a later time, or null = until lifted),
//   suspensionReason (1–500), suspendedBy, suspensionLiftedAt, suspensionLiftedBy.
// The fields hold only the latest suspension; the history is the driver's adminMessages.
// While active, the rules refuse standard accepts and out-of-area proposals (not the claim,
// not finishing a trip, not going online). It ends by itself at suspendedUntil.
//
// adminMessages/{id} (firestore.rules, Admin messages): a "message from TriGo" in the user's
// inbox. Admins create; the user reads their own and sets readAt once; nobody deletes.

/** Same limit as warnings and the revoke reason (firestore.rules). */
export const ACTION_REASON_MAX_LENGTH = 500;

export type SuspensionDuration = '1d' | '3d' | '7d' | 'until_lifted';

export const SUSPENSION_DURATIONS: { value: SuspensionDuration; label: string; days: number | null }[] = [
  { value: '1d', label: '1 day', days: 1 },
  { value: '3d', label: '3 days', days: 3 },
  { value: '7d', label: '7 days', days: 7 },
  { value: 'until_lifted', label: 'Until lifted', days: null },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a suspension of this length starting now ends; null = until an admin lifts it. */
export function suspensionEndMillis(duration: SuspensionDuration, nowMillis: number): number | null {
  const days = SUSPENSION_DURATIONS.find((d) => d.value === duration)?.days ?? null;
  return days === null ? null : nowMillis + days * DAY_MS;
}

export type AdminMessageKind = 'suspended' | 'suspension_lifted' | 'revoked' | 'restored';

export const ADMIN_MESSAGE_KINDS: AdminMessageKind[] = ['suspended', 'suspension_lifted', 'revoked', 'restored'];

export const ADMIN_MESSAGE_KIND_LABELS: Record<AdminMessageKind, string> = {
  suspended: 'Suspended',
  suspension_lifted: 'Suspension lifted',
  revoked: 'Verification revoked',
  restored: 'Verification restored',
};

/** firestore.rules limits for adminMessages. */
export const ADMIN_MESSAGE_TITLE_MAX_LENGTH = 120;
export const ADMIN_MESSAGE_BODY_MAX_LENGTH = 1000;

/**
 * What the driver reads. `untilLabel` is the end as the admin sees it (e.g. "Nov 20, 2026,
 * 3:05 PM"), only for 'suspended'; null = until lifted.
 */
export function adminMessageText(kind: AdminMessageKind, untilLabel: string | null): { title: string; body: string } {
  switch (kind) {
    case 'suspended':
      return {
        title: 'Your account is suspended',
        body: `TriGo suspended your driver account ${
          untilLabel ? `until ${untilLabel}` : 'until the TriGo team lifts it'
        }. While suspended you can stay online and finish a current trip, but you cannot accept new requests.`,
      };
    case 'suspension_lifted':
      return {
        title: 'Your suspension was lifted',
        body: 'TriGo lifted the suspension on your driver account. You can accept new requests again.',
      };
    case 'revoked':
      return {
        title: 'Your driver verification was revoked',
        body: 'TriGo revoked your driver verification. You have been taken offline and cannot accept requests until TriGo restores it. You can still finish a current trip.',
      };
    case 'restored':
      return {
        title: 'Your driver verification was restored',
        body: 'TriGo restored your driver verification. You can go online and accept requests again.',
      };
  }
}

/** The new adminMessages/{id} document. `until` is a timestamp (suspensions) or null. */
export function newAdminMessageDoc(
  input: { userId: string; kind: AdminMessageKind; reason: string; until: unknown; untilLabel: string | null },
  adminUid: string,
  now: unknown,
) {
  const text = adminMessageText(input.kind, input.untilLabel);
  return {
    userId: input.userId,
    kind: input.kind,
    title: text.title,
    body: text.body,
    reason: input.reason.trim(),
    until: input.kind === 'suspended' ? input.until : null,
    createdBy: adminUid,
    createdAt: now,
    readAt: null,
  };
}

/** drivers/{uid} fields of a new suspension (replaces any earlier one). */
export function suspensionUpdate(reason: string, until: unknown, adminUid: string, now: unknown) {
  return {
    suspendedAt: now,
    suspendedUntil: until,
    suspensionReason: reason.trim(),
    suspendedBy: adminUid,
    suspensionLiftedAt: null,
    suspensionLiftedBy: null,
  };
}

/** drivers/{uid} fields when an admin lifts the suspension early. */
export function liftSuspensionUpdate(adminUid: string, now: unknown) {
  return { suspensionLiftedAt: now, suspensionLiftedBy: adminUid };
}

/** Account deletion: the message stays, its reason and body are cleared in the anonymizing commit. */
export function clearedAdminMessageUpdate(now: unknown) {
  return { reason: '', body: '', reasonClearedAt: now };
}

/** Error text, or null when the reason can be saved. */
export function validateActionReason(text: string): string | null {
  const reason = text.trim();
  if (!reason) return 'Write the reason the driver will read.';
  if (reason.length > ACTION_REASON_MAX_LENGTH) {
    return `Keep the reason to ${ACTION_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
