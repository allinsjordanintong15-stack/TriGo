// The in-app inbox ("Messages from TriGo"): one list of items of different kinds, newest
// first: warnings (warnings/{id}), messages from TriGo (adminMessages/{id}: suspension and
// verification notices, and system notices for application, payment, report and account
// deletion decisions) and announcements (announcements/{id}, one document for many users,
// read state in users/{uid}/inboxState/announcements). Each kind has its own `xToInboxItem`
// and is merged with `buildInbox`, so the screen and the unread count need no rework.
// Alias-free on purpose, so plain Node tests load it.

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

/**
 * adminMessages/{id} kinds the app knows. Any other value (a kind added later) is kept as
 * 'other' and shown with its own title and body.
 */
export type InboxMessageKind =
  | 'suspended'
  | 'suspension_lifted'
  | 'revoked'
  | 'restored'
  | 'application_approved'
  | 'application_rejected'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'report_resolved'
  | 'deletion_declined'
  | 'other';

export const INBOX_MESSAGE_KINDS: readonly InboxMessageKind[] = [
  'suspended',
  'suspension_lifted',
  'revoked',
  'restored',
  'application_approved',
  'application_rejected',
  'payment_confirmed',
  'payment_rejected',
  'report_resolved',
  'deletion_declined',
];

/** The fields of adminMessages/{id} the app reads (src/services/adminMessageService.ts). */
export interface InboxMessage {
  messageId: string;
  userId: string;
  kind: InboxMessageKind;
  title: string;
  /** Empty when cleared (account deletion). */
  body: string;
  /** The admin's reason or remarks; empty when there is none or it was cleared. */
  reason: string;
  /** Suspensions: when it ends; null = until lifted (and for other kinds). */
  until: Date | null;
  /** The payment or complaint the notice is about; null for other kinds. */
  refId: string | null;
  createdAt: Date | null;
  readAt: Date | null;
}

export interface MessageInboxItem extends InboxItemBase {
  kind: 'message';
  message: InboxMessage;
}

export type AnnouncementAudience = 'all' | 'passengers' | 'drivers';

/** The fields of announcements/{id} the app reads (src/services/announcementService.ts). */
export interface InboxAnnouncement {
  announcementId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  /** Hidden from the inbox after this time; null = until withdrawn. */
  showUntil: Date | null;
  createdAt: Date | null;
}

/** users/{uid}/inboxState/announcements: which announcements the user has read. */
export interface AnnouncementReadState {
  /** "Mark all as read": every announcement created up to then counts as read. */
  lastReadAllAt: Date | null;
  /** Announcements opened one by one (only IDs of announcements still shown are kept). */
  readIds: readonly string[];
}

export const EMPTY_ANNOUNCEMENT_READ_STATE: AnnouncementReadState = { lastReadAllAt: null, readIds: [] };

export interface AnnouncementInboxItem extends InboxItemBase {
  kind: 'announcement';
  announcement: InboxAnnouncement;
}

export type InboxItem = WarningInboxItem | MessageInboxItem | AnnouncementInboxItem;

export const MESSAGE_FALLBACK_TITLE = 'Message from TriGo';
export const ANNOUNCEMENT_FALLBACK_TITLE = 'Announcement from TriGo';

export function readMessageKind(value: unknown): InboxMessageKind {
  return INBOX_MESSAGE_KINDS.includes(value as InboxMessageKind) ? (value as InboxMessageKind) : 'other';
}

export function readAnnouncementAudience(value: unknown): AnnouncementAudience | null {
  return value === 'all' || value === 'passengers' || value === 'drivers' ? value : null;
}

export function messageToInboxItem(message: InboxMessage): MessageInboxItem {
  return {
    kind: 'message',
    key: `message:${message.messageId}`,
    createdAt: message.createdAt,
    unread: message.readAt === null,
    title: message.title.trim() || MESSAGE_FALLBACK_TITLE,
    preview: previewText(message.body) || previewText(message.reason) || 'Open to read this message.',
    message,
  };
}

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

/** Shown until its "show until" time passes (withdrawn ones are not loaded at all). */
export function isVisibleAnnouncement(announcement: InboxAnnouncement, nowMillis: number): boolean {
  return announcement.showUntil === null || announcement.showUntil.getTime() > nowMillis;
}

export function isUnreadAnnouncement(announcement: InboxAnnouncement, read: AnnouncementReadState): boolean {
  if (read.readIds.includes(announcement.announcementId)) return false;
  if (read.lastReadAllAt === null) return true;
  // Pending server time = just created, so newer than any "mark all".
  return announcement.createdAt === null || announcement.createdAt.getTime() > read.lastReadAllAt.getTime();
}

export function announcementToInboxItem(
  announcement: InboxAnnouncement,
  read: AnnouncementReadState,
): AnnouncementInboxItem {
  return {
    kind: 'announcement',
    key: `announcement:${announcement.announcementId}`,
    createdAt: announcement.createdAt,
    unread: isUnreadAnnouncement(announcement, read),
    title: announcement.title.trim() || ANNOUNCEMENT_FALLBACK_TITLE,
    preview: previewText(announcement.body) || 'Open to read this announcement.',
    announcement,
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
export function buildInbox(
  warnings: readonly InboxWarning[],
  messages: readonly InboxMessage[] = [],
  announcements: readonly InboxAnnouncement[] = [],
  announcementRead: AnnouncementReadState = EMPTY_ANNOUNCEMENT_READ_STATE,
  nowMillis: number = Date.now(),
): InboxItem[] {
  return [
    ...warnings.filter(isVisibleWarning).map(warningToInboxItem),
    ...messages.map(messageToInboxItem),
    ...announcements
      .filter((a) => isVisibleAnnouncement(a, nowMillis))
      .map((a) => announcementToInboxItem(a, announcementRead)),
  ].sort(newestFirst);
}

export function unreadCount(items: readonly InboxItem[]): number {
  return items.filter((item) => item.unread).length;
}

/** Bell badge text: "1"…"9", then "9+"; null when nothing is unread. */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

/** The newest unread warning; null when there is none. */
export function newestUnreadWarning(items: readonly InboxItem[]): InboxWarning | null {
  const item = items.find((i): i is WarningInboxItem => i.kind === 'warning' && i.unread);
  return item ? item.warning : null;
}

/** The newest unread item of any kind, for the driver Home banner; null when there is none. */
export function newestUnreadItem(items: readonly InboxItem[]): InboxItem | null {
  return items.find((i) => i.unread) ?? null;
}

// ─── Sections, look and actions ──────────────────────────────────────────────

export interface InboxSection {
  title: 'Today' | 'Earlier';
  items: InboxItem[];
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today" (this phone's calendar day, and items whose time is pending) and "Earlier"; empty sections are left out. */
export function groupInbox(items: readonly InboxItem[], nowMillis: number): InboxSection[] {
  const now = new Date(nowMillis);
  const today: InboxItem[] = [];
  const earlier: InboxItem[] = [];
  for (const item of items) {
    if (item.createdAt === null || isSameLocalDay(item.createdAt, now)) today.push(item);
    else earlier.push(item);
  }
  const sections: InboxSection[] = [];
  if (today.length) sections.push({ title: 'Today', items: today });
  if (earlier.length) sections.push({ title: 'Earlier', items: earlier });
  return sections;
}

/** Colour family of an item's icon (InboxScreen maps it to theme colours). */
export type InboxTone = 'success' | 'danger' | 'warning' | 'info' | 'announcement';

/** Ionicons name and tone per kind (names are plain strings so Node tests load this file). */
export function inboxItemLook(item: InboxItem): { icon: string; tone: InboxTone } {
  if (item.kind === 'warning') return { icon: 'warning-outline', tone: 'warning' };
  if (item.kind === 'announcement') return { icon: 'megaphone-outline', tone: 'announcement' };
  switch (item.message.kind) {
    case 'application_approved':
    case 'payment_confirmed':
    case 'suspension_lifted':
    case 'restored':
      return { icon: 'checkmark-circle-outline', tone: 'success' };
    case 'application_rejected':
    case 'payment_rejected':
      return { icon: 'close-circle-outline', tone: 'danger' };
    case 'suspended':
    case 'revoked':
      return { icon: 'ban-outline', tone: 'danger' };
    case 'deletion_declined':
      return { icon: 'person-remove-outline', tone: 'danger' };
    case 'report_resolved':
      return { icon: 'information-circle-outline', tone: 'info' };
    default:
      return { icon: 'mail-outline', tone: 'info' };
  }
}

/** Where a message's button goes (InboxScreen maps targets to routes). */
export type InboxActionTarget = 'driver_mode' | 'driver_application' | 'driver_earnings' | 'privacy';

export interface InboxAction {
  label: string;
  target: InboxActionTarget;
}

/** The button on a message's detail screen; null for kinds without one. */
export function inboxMessageAction(kind: InboxMessageKind): InboxAction | null {
  switch (kind) {
    case 'application_approved':
      return { label: 'Switch to Driver Mode', target: 'driver_mode' };
    case 'application_rejected':
      return { label: 'Resubmit application', target: 'driver_application' };
    case 'payment_confirmed':
    case 'payment_rejected':
      return { label: 'View earnings', target: 'driver_earnings' };
    case 'deletion_declined':
      return { label: 'Open Privacy & Terms', target: 'privacy' };
    default:
      return null;
  }
}

/** Label above a message's reason on the detail screen. */
export function messageReasonLabel(kind: InboxMessageKind): string {
  return kind === 'application_rejected' ? 'Remarks from TriGo' : 'Reason';
}

// ─── Phone notifications for new items (while the app runs) ─────────────────

/**
 * Which items to post a phone notification for. `known` is the set of item keys seen so far
 * for this user, or null before the first full load: that load only records what is
 * already there (no notification for old messages). Later, an item is posted once, when it
 * first appears unread.
 */
export function planInboxNotifications(
  known: ReadonlySet<string> | null,
  items: readonly InboxItem[],
): { post: InboxItem[]; known: Set<string> } {
  const next = new Set(known ?? []);
  const post: InboxItem[] = [];
  for (const item of items) {
    if (next.has(item.key)) continue;
    next.add(item.key);
    if (known !== null && item.unread) post.push(item);
  }
  return { post, known: next };
}

const NOTIFICATION_PREFIX = 'inbox:';

/** Notification ID: one per item, so a repeat replaces rather than stacks. */
export function inboxNotificationId(key: string): string {
  return `${NOTIFICATION_PREFIX}${key}`;
}

export function isInboxNotificationId(identifier: string): boolean {
  return identifier.startsWith(NOTIFICATION_PREFIX);
}

/** The notification's data: who it is for and which item it opens. */
export function buildInboxNotificationData(item: InboxItem, userId: string): Record<string, string> {
  return { type: 'inbox', userId, key: item.key };
}

export type InboxTarget =
  | { kind: 'warning'; id: string }
  | { kind: 'message'; id: string }
  | { kind: 'announcement'; id: string };

const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** A tapped notification's item, or null when it is not an inbox notification for this user. */
export function parseInboxNotificationData(data: unknown, signedInUserId: string | null): InboxTarget | null {
  if (typeof data !== 'object' || data === null || signedInUserId === null) return null;
  const record = data as Record<string, unknown>;
  if (record.type !== 'inbox' || record.userId !== signedInUserId || typeof record.key !== 'string') return null;
  const [kind, id, extra] = record.key.split(':');
  if (extra !== undefined || id === undefined || !DOCUMENT_ID.test(id)) return null;
  if (kind === 'warning' || kind === 'message' || kind === 'announcement') return { kind, id };
  return null;
}

/**
 * The notification's text: the item's title only, with a fixed body, so reasons and remarks
 * never appear outside the app (notification shade, lock screen, smartwatch).
 */
export function inboxNotificationContent(item: InboxItem): { title: string; body: string } {
  return { title: item.title, body: 'Tap to read it in TriGo.' };
}
