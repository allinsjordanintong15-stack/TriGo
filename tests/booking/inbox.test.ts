/// <reference types="node" />

// In-app inbox model (src/utils/inbox.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  badgeLabel,
  buildInbox,
  MESSAGE_FALLBACK_TITLE,
  newestUnreadItem,
  newestUnreadWarning,
  previewText,
  readMessageKind,
  unreadCount,
  WARNING_TITLE,
  type InboxMessage,
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
