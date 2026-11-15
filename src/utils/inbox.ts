// The in-app inbox ("Messages from TriGo"): one list of items of different kinds, newest
// first. Today only warnings (warnings/{id}); announcements (Task B2) become another kind
// in InboxItem with its own `xToInboxItem` and are merged with `buildInbox`, so the screen
// and the unread count need no rework. Alias-free on purpose, so plain Node tests load it.

export type InboxWarningRole = 'driver' | 'passenger';

/** The fields of warnings/{id} the app reads (src/services/warningService.ts). */
export interface InboxWarning {
  warningId: string;
  userId: string;
  role: InboxWarningRole | null;
  complaintId: string | null;
  bookingId: string | null;
  /** Empty when cleared (account deletion). */
  reason: string;
  /** Null only while the server time of a just-written warning is pending. */
  createdAt: Date | null;
  status: 'active' | 'withdrawn';
  acknowledgedAt: Date | null;
}

interface InboxItemBase {
  /** Unique across kinds, e.g. "warning:abc". */
  key: string;
  createdAt: Date | null;
  /** Unread items are highlighted and counted on the bell. */
  unread: boolean;
  title: string;
  preview: string;
}

export interface WarningInboxItem extends InboxItemBase {
  kind: 'warning';
  warning: InboxWarning;
}

/** Add announcement items here (Task B2). */
export type InboxItem = WarningInboxItem;

export const WARNING_TITLE = 'Warning from TriGo';
const PREVIEW_MAX_LENGTH = 120;

/** First line of the text, shortened with "…" past PREVIEW_MAX_LENGTH characters. */
export function previewText(text: string): string {
  const line = text.trim().split(/\r?\n/)[0] ?? '';
  return line.length > PREVIEW_MAX_LENGTH ? `${line.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…` : line;
}

/** Warnings the user sees: withdrawn ones disappear from the inbox. */
export function isVisibleWarning(warning: InboxWarning): boolean {
  return warning.status === 'active';
}

/** Unread = active and not yet acknowledged ("I understand"). */
export function isUnreadWarning(warning: InboxWarning): boolean {
  return warning.status === 'active' && warning.acknowledgedAt === null;
}

export function warningToInboxItem(warning: InboxWarning): WarningInboxItem {
  return {
    kind: 'warning',
    key: `warning:${warning.warningId}`,
    createdAt: warning.createdAt,
    unread: isUnreadWarning(warning),
    title: WARNING_TITLE,
    preview: previewText(warning.reason) || 'Open to read this warning.',
    warning,
  };
}

/** Newest first; an item whose server time is still pending counts as the newest. */
function newestFirst(a: InboxItem, b: InboxItem): number {
  const aTime = a.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTime = b.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aTime === bTime) return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  return bTime - aTime;
}

/** All visible items of every kind, newest first. */
export function buildInbox(warnings: readonly InboxWarning[]): InboxItem[] {
  return warnings.filter(isVisibleWarning).map(warningToInboxItem).sort(newestFirst);
}

export function unreadCount(items: readonly InboxItem[]): number {
  return items.filter((item) => item.unread).length;
}

/** Bell badge text: "1"…"9", then "9+"; null when nothing is unread. */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

/** The newest unread warning, for the driver Home banner; null when there is none. */
export function newestUnreadWarning(items: readonly InboxItem[]): InboxWarning | null {
  const item = items.find((i) => i.kind === 'warning' && i.unread);
  return item ? item.warning : null;
}
