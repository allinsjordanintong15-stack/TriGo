/// <reference types="node" />

// Complaints list and one-step resolve helpers (admin/src/complaints/complaintsTable.ts,
// complaintResolve.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addQuickNote,
  offersSuspend,
  readOutcome,
  reopenedComplaintUpdate,
  resolvedComplaintUpdate,
  suspendBlockReason,
  validateResolveNote,
  warnBlockReason,
} from '../../admin/src/complaints/complaintResolve.ts';
import {
  complaintParams,
  DEFAULT_COMPLAINT_FILTERS,
  emptyComplaintsText,
  firstLine,
  matchesComplaintSearch,
  outcomeText,
  readComplaintFilters,
} from '../../admin/src/complaints/complaintsTable.ts';

describe('URL state', () => {
  it('defaults to Open, 10 rows, no panel', () => {
    assert.deepEqual(readComplaintFilters(new URLSearchParams('')), DEFAULT_COMPLAINT_FILTERS);
    assert.deepEqual(complaintParams(DEFAULT_COMPLAINT_FILTERS, 1), {});
  });

  it('round-trips status, search, rows, page and the open complaint', () => {
    const filters = { status: 'resolved', search: 'ana', pageSize: 20, open: 'booking1_p1' } as const;
    const params = complaintParams(filters, 2);
    assert.deepEqual(params, { status: 'resolved', q: 'ana', rows: '20', page: '2', open: 'booking1_p1' });
    assert.deepEqual(readComplaintFilters(new URLSearchParams(params)), filters);
  });

  it('keeps All explicit and ignores unknown values', () => {
    assert.equal(readComplaintFilters(new URLSearchParams('status=all')).status, 'all');
    assert.deepEqual(readComplaintFilters(new URLSearchParams('status=closed&rows=3&open=a/b')), DEFAULT_COMPLAINT_FILTERS);
  });
});

describe('list text', () => {
  it('searches reporter or reported names', () => {
    assert.equal(matchesComplaintSearch('Ana Santos', 'Carlo Bautista', 'carlo'), true);
    assert.equal(matchesComplaintSearch('Ana Santos', null, 'carlo'), false);
    assert.equal(matchesComplaintSearch('Ana Santos', null, ''), true);
  });

  it('shows the outcome under Resolved', () => {
    assert.equal(outcomeText('no_action'), 'No action');
    assert.equal(outcomeText('warned'), 'Warned');
    assert.equal(outcomeText('suspended'), 'Driver suspended');
    assert.equal(outcomeText(null), null);
    assert.equal(readOutcome('banned'), null);
  });

  it('first line and empty states', () => {
    assert.equal(firstLine('  Late again.\nSecond line'), 'Late again.');
    assert.equal(emptyComplaintsText('open', false), 'No open complaints — all caught up.');
    assert.equal(emptyComplaintsText('open', true), 'No complaints match your search.');
  });
});

describe('resolve options', () => {
  const newer = { reportedUserId: 'd1', reporterRole: 'passenger' as const, warningExists: false };

  it('allows Warn and Suspend on a newer complaint about a driver', () => {
    assert.equal(warnBlockReason(newer), null);
    assert.equal(suspendBlockReason(newer), null);
    assert.equal(offersSuspend('passenger'), true);
    assert.equal(offersSuspend('driver'), false);
  });

  it('explains why Warn is not possible', () => {
    assert.match(warnBlockReason({ ...newer, reportedUserId: undefined }) ?? '', /before Nov 10, 2026/);
    assert.match(warnBlockReason({ ...newer, reportedUserId: null }) ?? '', /no driver/);
    assert.match(warnBlockReason({ ...newer, warningExists: true }) ?? '', /already sent/);
  });

  it('suspends drivers only, and only on newer complaints', () => {
    assert.match(suspendBlockReason({ ...newer, reporterRole: 'driver' }) ?? '', /Only drivers/);
    assert.match(suspendBlockReason({ ...newer, reportedUserId: undefined }) ?? '', /driver from their page/);
  });

  it('adds quick notes on their own line, once', () => {
    assert.equal(addQuickNote('', 'Warning issued'), 'Warning issued');
    assert.equal(addQuickNote('Called him', 'Warning issued'), 'Called him\nWarning issued');
    assert.equal(addQuickNote('Warning issued', 'Warning issued'), 'Warning issued');
  });

  it('builds the resolve and reopen updates', () => {
    assert.deepEqual(resolvedComplaintUpdate('warned', '  Repeated behavior ', 'a1', 'now'), {
      status: 'resolved',
      outcome: 'warned',
      adminNotes: 'Repeated behavior',
      resolvedAt: 'now',
      resolvedBy: 'a1',
      updatedAt: 'now',
      updatedBy: 'a1',
    });
    assert.deepEqual(reopenedComplaintUpdate('note', 'a1', 'now'), {
      status: 'in_review',
      outcome: null,
      resolvedAt: null,
      resolvedBy: null,
      adminNotes: 'note',
      updatedAt: 'now',
      updatedBy: 'a1',
    });
    assert.equal(validateResolveNote('x'.repeat(500)), null);
    assert.ok(validateResolveNote('x'.repeat(501)));
  });
});
