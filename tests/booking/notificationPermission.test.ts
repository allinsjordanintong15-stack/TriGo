/// <reference types="node" />

// Ride-request notification permission decisions (src/utils/notificationPermission.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  notificationSettingAction,
  shouldExplainBeforeGoingOnline,
  toPermissionStatus,
  type NotificationPermissionState,
} from '../../src/utils/notificationPermission.ts';

const undetermined: NotificationPermissionState = { status: 'undetermined', canAskAgain: true };
const deniedOnce: NotificationPermissionState = { status: 'denied', canAskAgain: true };
const blocked: NotificationPermissionState = { status: 'denied', canAskAgain: false };
const granted: NotificationPermissionState = { status: 'granted', canAskAgain: true };

describe('shouldExplainBeforeGoingOnline', () => {
  it('explains the first time notifications are off and the system can ask', () => {
    assert.equal(shouldExplainBeforeGoingOnline(undetermined, false), true);
    assert.equal(shouldExplainBeforeGoingOnline(deniedOnce, false), true);
  });

  it('does not ask again on this device once the explanation was seen', () => {
    assert.equal(shouldExplainBeforeGoingOnline(undetermined, true), false);
  });

  it('never explains when already allowed or when the system will not ask', () => {
    assert.equal(shouldExplainBeforeGoingOnline(granted, false), false);
    assert.equal(shouldExplainBeforeGoingOnline(blocked, false), false);
  });
});

describe('notificationSettingAction', () => {
  it('offers nothing when on, the prompt while it can ask, else the phone settings', () => {
    assert.equal(notificationSettingAction(granted), 'none');
    assert.equal(notificationSettingAction(undetermined), 'request');
    assert.equal(notificationSettingAction(deniedOnce), 'request');
    assert.equal(notificationSettingAction(blocked), 'open_settings');
  });
});

describe('toPermissionStatus', () => {
  it('keeps granted and denied, anything else is undetermined', () => {
    assert.equal(toPermissionStatus('granted'), 'granted');
    assert.equal(toPermissionStatus('denied'), 'denied');
    assert.equal(toPermissionStatus('undetermined'), 'undetermined');
    assert.equal(toPermissionStatus('something-new'), 'undetermined');
  });
});
