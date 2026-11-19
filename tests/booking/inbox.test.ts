/// <reference types="node" />

// In-app inbox model (src/utils/inbox.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  badgeLabel,
  buildInbox,
  buildInboxNotificationData,
  EMPTY_ANNOUNCEMENT_READ_STATE,
  groupInbox,
  inboxItemLook,
  inboxMessageAction,
  inboxNotificationContent,
  inboxNotificationId,
  isInboxNotificationId,
  isUnreadAnnouncement,
  MESSAGE_FALLBACK_TITLE,
  messageReasonLabel,
  messageToInboxItem,
  newestUnreadItem,
  newestUnreadWarning,
  parseInboxNotificationData,
  planInboxNotifications,
  previewText,
  readMessageKind,
  unreadCount,
  WARNING_TITLE,
  type InboxAnnouncement,
  type InboxMessage,
  type InboxMessageKind,
  type InboxWarning,
} from '../../src/utils/inbox.ts';

function warning(id: string, overrides: Partial<InboxWarning> = {}): InboxWarning {
  return {
    warningId: id,
    userId: 'user1',
    role: 'driver',
    complaintId: id,
    bookingId: 'booking1',
    reason: 'Please be on time for pickups.',
    createdAt: new Date(2026, 10, 10, 9, 0),
    status: 'active',
    acknowledgedAt: null,
    ...overrides,
  };
}

describe('buildInbox', () => {
  it('lists warnings newest first', () => {
    const items = buildInbox([
      warning('old', { createdAt: new Date(2026, 10, 1) }),
      warning('new', { createdAt: new Date(2026, 10, 12) }),
      warning('mid', { createdAt: new Date(2026, 10, 5) }),
    ]);
    assert.deepEqual(
      items.map((i) => i.key),
      ['warning:new', 'warning:mid', 'warning:old'],
    );
  });

  it('puts a warning whose server time is pending first', () => {
    const items = buildInbox([warning('dated'), warning('pending', { createdAt: null })]);
    assert.equal(items[0].key, 'warning:pending');
  });

  it('hides withdrawn warnings', () => {
    const items = buildInbox([warning('a'), warning('b', { status: 'withdrawn' })]);
    assert.deepEqual(
      items.map((i) => i.key),
      ['warning:a'],
    );
  });

  it('marks unacknowledged warnings unread', () => {
    const items = buildInbox([
      warning('unread', { createdAt: new Date(2026, 10, 2) }),
      warning('read', { createdAt: new Date(2026, 10, 1), acknowledgedAt: new Date(2026, 10, 3) }),
    ]);
    assert.deepEqual(
      items.map((i) => [i.key, i.unread]),
      [
        ['warning:unread', true],
        ['warning:read', false],
      ],
    );
    assert.equal(items[0].title, WARNING_TITLE);
  });

  it('gives a cleared reason a neutral preview', () => {
    assert.equal(buildInbox([warning('x', { reason: '' })])[0].preview, 'Open to read this warning.');
  });
});

describe('unread count and badge', () => {
  it('counts only active, unacknowledged warnings', () => {
    const items = buildInbox([
      warning('a'),
      warning('b'),
      warning('c', { acknowledgedAt: new Date() }),
      warning('d', { status: 'withdrawn' }),
    ]);
    assert.equal(unreadCount(items), 2);
  });

  it('shows no badge at zero and caps at 9+', () => {
    assert.equal(badgeLabel(0), null);
    assert.equal(badgeLabel(3), '3');
    assert.equal(badgeLabel(9), '9');
    assert.equal(badgeLabel(12), '9+');
  });
});

describe('newestUnreadWarning', () => {
  it('returns the newest unread warning for the driver banner', () => {
    const items = buildInbox([
      warning('older', { createdAt: new Date(2026, 10, 1) }),
      warning('newer', { createdAt: new Date(2026, 10, 9) }),
      warning('read', { createdAt: new Date(2026, 10, 12), acknowledgedAt: new Date() }),
    ]);
    assert.equal(newestUnreadWarning(items)?.warningId, 'newer');
  });

  it('returns null when everything is acknowledged', () => {
    assert.equal(newestUnreadWarning(buildInbox([warning('a', { acknowledgedAt: new Date() })])), null);
  });
});

describe('previewText', () => {
  it('keeps the first line and shortens long text', () => {
    assert.equal(previewText('  Line one\nLine two'), 'Line one');
    const long = previewText('x'.repeat(200));
    assert.equal(long.length, 120);
    assert.ok(long.endsWith('…'));
  });
});

describe('messages from TriGo (adminMessages)', () => {
  function message(id: string, overrides: Partial<InboxMessage> = {}): InboxMessage {
    return {
      messageId: id,
      userId: 'user1',
      kind: 'suspended',
      title: 'Your account is suspended',
      body: 'TriGo suspended your driver account until Nov 20.',
      reason: 'Repeated late pickups.',
      until: new Date(2026, 10, 20),
      refId: null,
      createdAt: new Date(2026, 10, 15),
      readAt: null,
      ...overrides,
    };
  }

  it('merges messages with warnings, newest first, and counts unread ones', () => {
    const items = buildInbox(
      [warning('w', { createdAt: new Date(2026, 10, 10) })],
      [message('m', { createdAt: new Date(2026, 10, 15) }), message('read', { readAt: new Date(), createdAt: new Date(2026, 10, 1) })],
    );
    assert.deepEqual(
      items.map((i) => i.key),
      ['message:m', 'warning:w', 'message:read'],
    );
    assert.equal(unreadCount(items), 2);
    assert.equal(newestUnreadItem(items)?.key, 'message:m');
    assert.equal(newestUnreadWarning(items)?.warningId, 'w');
  });

  it('handles unknown kinds and cleared text safely', () => {
    assert.equal(readMessageKind('announcement'), 'other');
    assert.equal(readMessageKind('revoked'), 'revoked');
    const [item] = buildInbox([], [message('x', { kind: 'other', title: '', body: '', reason: '' })]);
    assert.equal(item.title, MESSAGE_FALLBACK_TITLE);
    assert.equal(item.preview, 'Open to read this message.');
  });
});

// ─── System notices, announcements, sections and phone notifications (2026-11-19) ──

describe('system notices and announcements', () => {
  function notice(id: string, kind: InboxMessageKind, overrides: Partial<InboxMessage> = {}): InboxMessage {
    return {
      messageId: id,
      userId: 'user1',
      kind,
      title: `Title ${id}`,
      body: `Body ${id}`,
      reason: '',
      until: null,
      refId: null,
      createdAt: new Date(2026, 10, 18, 9, 0),
      readAt: null,
      ...overrides,
    };
  }

  function announcement(id: string, overrides: Partial<InboxAnnouncement> = {}): InboxAnnouncement {
    return {
      announcementId: id,
      title: 'Holiday schedule',
      body: 'TriGo support is closed on Nov 30.',
      audience: 'all',
      showUntil: null,
      createdAt: new Date(2026, 10, 18, 8, 0),
      ...overrides,
    };
  }

  it('reads every new kind and keeps unknown ones as other', () => {
    for (const kind of [
      'application_approved',
      'application_rejected',
      'payment_confirmed',
      'payment_rejected',
      'report_resolved',
      'deletion_declined',
    ]) {
      assert.equal(readMessageKind(kind), kind);
    }
    assert.equal(readMessageKind('something_new'), 'other');
  });

  it('gives each kind its icon and colour family', () => {
    const look = (kind: InboxMessageKind) => inboxItemLook(messageToInboxItem(notice('m', kind)));
    assert.deepEqual(look('application_approved'), { icon: 'checkmark-circle-outline', tone: 'success' });
    assert.deepEqual(look('payment_confirmed'), { icon: 'checkmark-circle-outline', tone: 'success' });
    assert.equal(look('application_rejected').tone, 'danger');
    assert.equal(look('payment_rejected').tone, 'danger');
    assert.deepEqual(look('suspended'), { icon: 'ban-outline', tone: 'danger' });
    assert.equal(look('report_resolved').tone, 'info');
    assert.equal(look('other').tone, 'info');
    const [warningItem] = buildInbox([warning('w')]);
    assert.deepEqual(inboxItemLook(warningItem), { icon: 'warning-outline', tone: 'warning' });
    const [announcementItem] = buildInbox([], [], [announcement('a')]);
    assert.deepEqual(inboxItemLook(announcementItem), { icon: 'megaphone-outline', tone: 'announcement' });
  });

  it('links each kind to its action (deep-link targets)', () => {
    assert.deepEqual(inboxMessageAction('application_approved'), { label: 'Switch to Driver Mode', target: 'driver_mode' });
    assert.deepEqual(inboxMessageAction('application_rejected'), {
      label: 'Resubmit application',
      target: 'driver_application',
    });
    assert.equal(inboxMessageAction('payment_confirmed')?.target, 'driver_earnings');
    assert.equal(inboxMessageAction('payment_rejected')?.label, 'View earnings');
    assert.equal(inboxMessageAction('deletion_declined')?.target, 'privacy');
    assert.equal(inboxMessageAction('report_resolved'), null);
    assert.equal(inboxMessageAction('suspended'), null);
    assert.equal(messageReasonLabel('application_rejected'), 'Remarks from TriGo');
    assert.equal(messageReasonLabel('payment_rejected'), 'Reason');
  });

  it('counts unread announcements from the read state', () => {
    const list = [
      announcement('old', { createdAt: new Date(2026, 10, 10) }),
      announcement('opened', { createdAt: new Date(2026, 10, 15) }),
      announcement('new', { createdAt: new Date(2026, 10, 17) }),
      announcement('pending', { createdAt: null }),
    ];
    const read = { lastReadAllAt: new Date(2026, 10, 12), readIds: ['opened'] };
    const items = buildInbox([], [], list, read, new Date(2026, 10, 18).getTime());
    const unread = items.filter((i) => i.unread).map((i) => i.key);
    assert.deepEqual(unread.sort(), ['announcement:new', 'announcement:pending']);
    assert.equal(unreadCount(items), 2);
    assert.equal(isUnreadAnnouncement(list[0], EMPTY_ANNOUNCEMENT_READ_STATE), true);
  });

  it('hides announcements past their show-until time', () => {
    const now = new Date(2026, 10, 18, 12, 0).getTime();
    const items = buildInbox(
      [],
      [],
      [
        announcement('ended', { showUntil: new Date(2026, 10, 18, 11, 59) }),
        announcement('showing', { showUntil: new Date(2026, 10, 18, 12, 1) }),
        announcement('open-ended'),
      ],
      EMPTY_ANNOUNCEMENT_READ_STATE,
      now,
    );
    assert.deepEqual(items.map((i) => i.key).sort(), ['announcement:open-ended', 'announcement:showing']);
  });

  it('merges warnings, messages and announcements newest first', () => {
    const items = buildInbox(
      [warning('w', { createdAt: new Date(2026, 10, 16) })],
      [notice('m', 'payment_confirmed', { createdAt: new Date(2026, 10, 17) })],
      [announcement('a', { createdAt: new Date(2026, 10, 15) })],
      EMPTY_ANNOUNCEMENT_READ_STATE,
      new Date(2026, 10, 18).getTime(),
    );
    assert.deepEqual(
      items.map((i) => i.key),
      ['message:m', 'warning:w', 'announcement:a'],
    );
  });
});

describe('groupInbox', () => {
  it('splits Today and Earlier by the local day, pending times count as today', () => {
    const now = new Date(2026, 10, 18, 15, 0).getTime();
    const items = buildInbox([
      warning('today', { createdAt: new Date(2026, 10, 18, 0, 5) }),
      warning('yesterday', { createdAt: new Date(2026, 10, 17, 23, 55) }),
      warning('pending', { createdAt: null }),
    ]);
    const sections = groupInbox(items, now);
    assert.deepEqual(
      sections.map((s) => [s.title, s.items.map((i) => i.key)]),
      [
        ['Today', ['warning:pending', 'warning:today']],
        ['Earlier', ['warning:yesterday']],
      ],
    );
  });

  it('leaves out empty sections', () => {
    const now = new Date(2026, 10, 18, 15, 0).getTime();
    const sections = groupInbox(buildInbox([warning('old', { createdAt: new Date(2026, 10, 1) })]), now);
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Earlier'],
    );
    assert.deepEqual(groupInbox([], now), []);
  });
});

describe('phone notifications for new inbox items', () => {
  it('posts nothing on the first load, then each new unread item once', () => {
    const first = buildInbox([warning('a'), warning('b', { acknowledgedAt: new Date() })]);
    const initial = planInboxNotifications(null, first);
    assert.deepEqual(initial.post, []);
    assert.deepEqual([...initial.known].sort(), ['warning:a', 'warning:b']);

    const second = buildInbox([warning('a'), warning('b'), warning('c'), warning('d', { acknowledgedAt: new Date() })]);
    const next = planInboxNotifications(initial.known, second);
    assert.deepEqual(
      next.post.map((i) => i.key),
      ['warning:c'],
    );
    assert.deepEqual(planInboxNotifications(next.known, second).post, []);
  });

  it('builds and parses notification data for the signed-in user only', () => {
    const [item] = buildInbox([warning('w1')]);
    const data = buildInboxNotificationData(item, 'user1');
    assert.deepEqual(parseInboxNotificationData(data, 'user1'), { kind: 'warning', id: 'w1' });
    assert.equal(parseInboxNotificationData(data, 'someoneElse'), null);
    assert.equal(parseInboxNotificationData(data, null), null);
    assert.deepEqual(parseInboxNotificationData({ type: 'inbox', userId: 'u', key: 'message:m1' }, 'u'), {
      kind: 'message',
      id: 'm1',
    });
    assert.deepEqual(parseInboxNotificationData({ type: 'inbox', userId: 'u', key: 'announcement:a1' }, 'u'), {
      kind: 'announcement',
      id: 'a1',
    });
    assert.equal(parseInboxNotificationData({ type: 'ride-request', userId: 'u', key: 'message:m1' }, 'u'), null);
    assert.equal(parseInboxNotificationData({ type: 'inbox', userId: 'u', key: 'message:../x' }, 'u'), null);
    assert.equal(parseInboxNotificationData({ type: 'inbox', userId: 'u', key: 'other:m1' }, 'u'), null);
    assert.equal(parseInboxNotificationData('nope', 'u'), null);
  });

  it('uses inbox IDs and never puts reasons in the notification', () => {
    const [item] = buildInbox([warning('w1', { reason: 'Private reason text' })]);
    assert.equal(inboxNotificationId(item.key), 'inbox:warning:w1');
    assert.equal(isInboxNotificationId('inbox:warning:w1'), true);
    assert.equal(isInboxNotificationId('ride-request:standard:b1'), false);
    const content = inboxNotificationContent(item);
    assert.equal(content.title, WARNING_TITLE);
    assert.ok(!content.body.includes('Private reason text'));
  });
});
