/// <reference types="node" />

// System notices and announcements written by the admin website (admin/src/inbox/
// noticePlan.ts, announcementPlan.ts). The Firestore rules tests check the same payloads
// against firestore.rules. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addRemarkChip,
  APPLICATION_REJECT_REMARKS,
  newNoticeDoc,
  NOTICE_KINDS,
  noticeText,
  PAYMENT_REJECT_REASONS,
  pesoText,
} from '../../admin/src/inbox/noticePlan.ts';
import {
  announcementState,
  endOfManilaDayMillis,
  hasAnnouncementErrors,
  newAnnouncementDoc,
  validateAnnouncement,
  withdrawnAnnouncementUpdate,
} from '../../admin/src/inbox/announcementPlan.ts';

const NOW = 'serverTime';

describe('newNoticeDoc', () => {
  it('approval: no reason, no refId, until null', () => {
    const doc = newNoticeDoc({ kind: 'application_approved', userId: 'u1' }, 'admin1', NOW);
    assert.deepEqual(Object.keys(doc).sort(), [
      'body',
      'createdAt',
      'createdBy',
      'kind',
      'readAt',
      'reason',
      'refId',
      'title',
      'until',
      'userId',
    ]);
    assert.equal(doc.title, 'Your driver application was approved');
    assert.equal(doc.reason, '');
    assert.equal(doc.refId, null);
    assert.equal(doc.until, null);
    assert.equal(doc.readAt, null);
    assert.equal(doc.createdBy, 'admin1');
    assert.equal(doc.createdAt, NOW);
  });

  it('rejection: the remarks are the reason, exactly as given', () => {
    const doc = newNoticeDoc({ kind: 'application_rejected', userId: 'u1', remarks: 'Document is expired' }, 'a', NOW);
    assert.equal(doc.title, 'Your driver application was not approved');
    assert.equal(doc.reason, 'Document is expired');
  });

  it('payments: amount and reference in the body, refId = payment ID', () => {
    const confirmed = newNoticeDoc(
      { kind: 'payment_confirmed', userId: 'd1', paymentId: 'p1', amountCentavos: 123450, reference: '1234567890' },
      'a',
      NOW,
    );
    assert.equal(confirmed.refId, 'p1');
    assert.equal(confirmed.reason, '');
    assert.match(confirmed.body, /₱1,234\.50/);
    assert.match(confirmed.body, /1234567890/);
    const rejected = newNoticeDoc(
      {
        kind: 'payment_rejected',
        userId: 'd1',
        paymentId: 'p1',
        amountCentavos: 700,
        reference: '1234567890',
        reason: 'Amount does not match',
      },
      'a',
      NOW,
    );
    assert.equal(rejected.reason, 'Amount does not match');
    assert.match(rejected.body, /₱7\.00/);
  });

  it('report resolved: only the trip date, never a reason', () => {
    const doc = newNoticeDoc(
      { kind: 'report_resolved', userId: 'p1', complaintId: 'b1_p1', tripDateLabel: 'Nov 18, 2026' },
      'a',
      NOW,
    );
    assert.equal(doc.reason, '');
    assert.equal(doc.refId, 'b1_p1');
    assert.equal(doc.body, 'We reviewed your report about your trip on Nov 18, 2026. Thank you for helping keep TriGo safe.');
    const noDate = noticeText({ kind: 'report_resolved', userId: 'p1', complaintId: 'c', tripDateLabel: null });
    assert.equal(noDate.body, 'We reviewed your report about your trip. Thank you for helping keep TriGo safe.');
  });

  it('deletion declined: the note is the reason', () => {
    const doc = newNoticeDoc({ kind: 'deletion_declined', userId: 'u1', note: 'Not the account holder.' }, 'a', NOW);
    assert.equal(doc.reason, 'Not the account holder.');
    assert.equal(doc.refId, null);
  });

  it('every kind fits the rules limits (title ≤ 120, body 1–1000)', () => {
    assert.equal(NOTICE_KINDS.length, 6);
    const inputs = [
      { kind: 'application_approved', userId: 'u' },
      { kind: 'application_rejected', userId: 'u', remarks: 'r' },
      { kind: 'payment_confirmed', userId: 'u', paymentId: 'p', amountCentavos: 99999999, reference: '12345678901234567890' },
      { kind: 'payment_rejected', userId: 'u', paymentId: 'p', amountCentavos: 1, reference: '1234567890', reason: 'r' },
      { kind: 'report_resolved', userId: 'u', complaintId: 'c', tripDateLabel: 'Nov 18, 2026' },
      { kind: 'deletion_declined', userId: 'u', note: 'n' },
    ] as const;
    for (const input of inputs) {
      const { title, body } = noticeText(input);
      assert.ok(title.length > 0 && title.length <= 120, input.kind);
      assert.ok(body.length > 0 && body.length <= 1000, input.kind);
    }
  });
});

describe('pesoText', () => {
  it('formats centavos with thousands separators', () => {
    assert.equal(pesoText(0), '₱0.00');
    assert.equal(pesoText(100), '₱1.00');
    assert.equal(pesoText(123456789), '₱1,234,567.89');
  });
});

describe('remark chips', () => {
  it('lists the quick-fill texts', () => {
    assert.ok(APPLICATION_REJECT_REMARKS.includes('Photo is blurry — please retake'));
    assert.ok(APPLICATION_REJECT_REMARKS.includes('Plate number does not match'));
    assert.deepEqual([...PAYMENT_REJECT_REASONS], ['Reference number not found', 'Amount does not match']);
  });

  it('adds a chip on its own, on a new line, and never twice', () => {
    assert.equal(addRemarkChip('', 'Document is expired'), 'Document is expired');
    assert.equal(addRemarkChip('  ', 'Document is expired'), 'Document is expired');
    assert.equal(addRemarkChip('Please retake.', 'Document is expired'), 'Please retake.\nDocument is expired');
    assert.equal(addRemarkChip('Document is expired', 'Document is expired'), 'Document is expired');
  });
});

describe('announcements', () => {
  const now = Date.UTC(2026, 10, 19, 4, 0); // Nov 19, 12:00 noon in Manila

  it('ends a show-until day at 23:59:59.999 Philippine time', () => {
    assert.equal(endOfManilaDayMillis('2026-11-19'), Date.UTC(2026, 10, 19, 15, 59, 59, 999));
    assert.equal(endOfManilaDayMillis('2026-02-30'), null);
    assert.equal(endOfManilaDayMillis('19/11/2026'), null);
  });

  it('validates title, message and date', () => {
    const ok = { title: 'Holiday', body: 'Closed on Nov 30.', audience: 'all' as const, showUntilDate: '' };
    assert.equal(hasAnnouncementErrors(validateAnnouncement(ok, now)), false);
    assert.equal(hasAnnouncementErrors(validateAnnouncement({ ...ok, showUntilDate: '2026-11-19' }, now)), false);
    assert.deepEqual(validateAnnouncement({ ...ok, title: ' ' }, now), { title: 'Write a title.' });
    assert.ok(validateAnnouncement({ ...ok, body: 'x'.repeat(1001) }, now).body);
    assert.ok(validateAnnouncement({ ...ok, title: 'x'.repeat(121) }, now).title);
    assert.deepEqual(validateAnnouncement({ ...ok, showUntilDate: '2026-11-18' }, now), {
      showUntilDate: 'Choose today or a later date.',
    });
  });

  it('builds the exact create and withdraw payloads', () => {
    const doc = newAnnouncementDoc(
      { title: ' Holiday ', body: ' Closed. ', audience: 'drivers', showUntilDate: '' },
      null,
      'admin1',
      NOW,
    );
    assert.deepEqual(doc, {
      title: 'Holiday',
      body: 'Closed.',
      audience: 'drivers',
      showUntil: null,
      status: 'active',
      createdBy: 'admin1',
      createdAt: NOW,
      withdrawnAt: null,
      withdrawnBy: null,
    });
    assert.deepEqual(withdrawnAnnouncementUpdate('admin1', NOW), {
      status: 'withdrawn',
      withdrawnAt: NOW,
      withdrawnBy: 'admin1',
    });
  });

  it('shows the state the users see', () => {
    assert.equal(announcementState('active', null, now), 'showing');
    assert.equal(announcementState('active', now + 1, now), 'showing');
    assert.equal(announcementState('active', now, now), 'ended');
    assert.equal(announcementState('withdrawn', null, now), 'withdrawn');
  });
});
