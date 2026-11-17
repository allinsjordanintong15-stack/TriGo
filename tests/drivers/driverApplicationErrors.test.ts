/// <reference types="node" />

// Messages for a failed driver application submit (src/utils/driverApplicationErrors.ts).
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SUBMIT_MESSAGES, submitErrorMessage } from '../../src/utils/driverApplicationErrors.ts';

const firestoreError = (code: string, message = '') => ({ code, message, name: 'FirebaseError' });

describe('submitErrorMessage', () => {
  it('a photo whose base64 could not be decoded (the phone bug) says the photos could not be prepared', () => {
    const error = firestoreError(
      'invalid-argument',
      'Failed to construct data from Base64 string: RangeError: Maximum call stack size exceeded',
    );
    assert.equal(submitErrorMessage(error), SUBMIT_MESSAGES.photosUnreadable);
    assert.equal(submitErrorMessage(new Error('Invalid base64 (length 3).')), SUBMIT_MESSAGES.photosUnreadable);
  });

  it('permission-denied names the status found afterwards', () => {
    const denied = firestoreError('permission-denied', 'Missing or insufficient permissions.');
    assert.equal(submitErrorMessage(denied, 'pending'), SUBMIT_MESSAGES.pending);
    assert.equal(submitErrorMessage(denied, 'approved'), SUBMIT_MESSAGES.approved);
    assert.equal(submitErrorMessage(denied, 'rejected'), SUBMIT_MESSAGES.denied);
    assert.equal(submitErrorMessage(denied, null), SUBMIT_MESSAGES.denied);
  });

  it('separates too-large, quota, other invalid data and connection failures', () => {
    assert.equal(
      submitErrorMessage(firestoreError('invalid-argument', 'Document exceeds the maximum allowed size of 1 MiB')),
      SUBMIT_MESSAGES.photosTooLarge,
    );
    assert.equal(submitErrorMessage(firestoreError('resource-exhausted', 'Quota exceeded.')), SUBMIT_MESSAGES.busy);
    assert.equal(submitErrorMessage(firestoreError('invalid-argument', 'Unsupported field value')), SUBMIT_MESSAGES.rejectedData);
    assert.equal(submitErrorMessage(firestoreError('unavailable')), SUBMIT_MESSAGES.offline);
    assert.equal(submitErrorMessage(firestoreError('internal')), SUBMIT_MESSAGES.other);
    assert.equal(submitErrorMessage(undefined), SUBMIT_MESSAGES.other);
  });
});
