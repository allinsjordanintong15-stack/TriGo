/// <reference types="node" />

// A driver application's status as read from Firestore, and the Profile "Driver" card for
// it (shared/drivers/applicationStatus.ts). Every stored value, including missing or
// unexpected ones, must give content: an undefined result crashed the Profile tab
// (DriverApplicationCard: content.icon, 2026-11-17). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APPLICATION_STATUSES,
  applicationCardContent,
  parseApplicationStatus,
  UNKNOWN_STATUS_MESSAGE,
} from '../../shared/drivers/applicationStatus.ts';

const EMOJI = '🛺';
const UNEXPECTED = [undefined, null, '', 'Pending', 'pending ', 'submitted', 'under_review', 0, 1, true, {}, []];

describe('parseApplicationStatus', () => {
  it('keeps each known status exactly', () => {
    for (const status of APPLICATION_STATUSES) assert.equal(parseApplicationStatus(status), status);
  });

  it('turns a missing or unexpected value into unknown (never trims or lowercases)', () => {
    for (const value of UNEXPECTED) assert.equal(parseApplicationStatus(value), 'unknown', String(value));
  });
});

describe('applicationCardContent', () => {
  it('no application: apply', () => {
    const content = applicationCardContent(null, false, EMOJI);
    assert.deepEqual(content.icon, { emoji: EMOJI });
    assert.equal(content.heading, 'Become a TriGo Driver');
    assert.equal(content.action, 'apply');
  });

  it('pending: pending badge, view the application', () => {
    const content = applicationCardContent('pending', false, EMOJI);
    assert.equal(content.icon, 'time-outline');
    assert.equal(content.badge, 'Pending Verification');
    assert.equal(content.badgeTone, 'pending');
    assert.equal(content.action, 'view');
  });

  it('approved: open driver mode only once the driver record is ready', () => {
    const ready = applicationCardContent('approved', true, EMOJI);
    assert.equal(ready.badge, 'Verified Driver');
    assert.equal(ready.badgeTone, 'approved');
    assert.equal(ready.action, 'open-driver-mode');
    const settingUp = applicationCardContent('approved', false, EMOJI);
    assert.equal(settingUp.action, 'view');
    assert.match(settingUp.message, /being set up/);
  });

  it('rejected: rejected badge, view the application', () => {
    const content = applicationCardContent('rejected', true, EMOJI);
    assert.equal(content.badge, 'Rejected');
    assert.equal(content.badgeTone, 'rejected');
    assert.equal(content.action, 'view');
  });

  it('unknown or missing status: a neutral card, no action, never driver mode', () => {
    for (const value of UNEXPECTED) {
      for (const driverModeReady of [false, true]) {
        const content = applicationCardContent(parseApplicationStatus(value), driverModeReady, EMOJI);
        assert.ok(content, String(value));
        assert.equal(typeof content.icon, 'string');
        assert.equal(content.badge, null);
        assert.equal(content.badgeTone, null);
        assert.equal(content.message, UNKNOWN_STATUS_MESSAGE);
        assert.equal(content.action, 'none');
      }
    }
  });

  it('always returns content with an icon, even for a value outside the type', () => {
    const content = applicationCardContent('surprise' as never, false, EMOJI);
    assert.ok(content.icon);
    assert.equal(content.message, UNKNOWN_STATUS_MESSAGE);
  });
});
