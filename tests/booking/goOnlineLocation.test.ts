/// <reference types="node" />

// Going online without a position (src/utils/goOnlineLocation.ts): which problem stops the
// driver, and the message and action shown. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyLocationProblem,
  locationProblemMessage,
  type LocationCheck,
  type LocationProblem,
} from '../../src/utils/goOnlineLocation.ts';

const OK: LocationCheck = { granted: true, canAskAgain: true, servicesEnabled: true, gotPosition: true };

describe('classifyLocationProblem', () => {
  it('nothing stops the driver when allowed, switched on and a position came in', () => {
    assert.equal(classifyLocationProblem(OK), null);
  });

  it('permission first: denied while the system can still ask', () => {
    assert.equal(classifyLocationProblem({ ...OK, granted: false }), 'permission-denied');
  });

  it('permission blocked once the system will not ask again', () => {
    assert.equal(classifyLocationProblem({ ...OK, granted: false, canAskAgain: false }), 'permission-blocked');
  });

  it('permission is reported before services or the fix', () => {
    assert.equal(
      classifyLocationProblem({ granted: false, canAskAgain: false, servicesEnabled: false, gotPosition: false }),
      'permission-blocked',
    );
  });

  it('location services off', () => {
    assert.equal(classifyLocationProblem({ ...OK, servicesEnabled: false, gotPosition: false }), 'services-off');
  });

  it('no GPS fix in time', () => {
    assert.equal(classifyLocationProblem({ ...OK, gotPosition: false }), 'no-fix');
  });
});

describe('locationProblemMessage', () => {
  const problems: LocationProblem[] = ['permission-denied', 'permission-blocked', 'services-off', 'no-fix'];

  it('every problem has a title, an explanation and one action with a label', () => {
    for (const problem of problems) {
      const text = locationProblemMessage(problem);
      assert.ok(text.title.length > 0, problem);
      assert.ok(text.message.length > 20, problem);
      assert.ok(text.actionLabel.length > 0, problem);
      assert.doesNotMatch(`${text.title} ${text.message}`, /unable to go online|try again later|error/i, problem);
    }
  });

  it('says what to do and which action fixes it', () => {
    assert.deepEqual(
      problems.map((p) => [p, locationProblemMessage(p).action, locationProblemMessage(p).actionLabel]),
      [
        ['permission-denied', 'request-permission', 'Allow location'],
        ['permission-blocked', 'open-app-settings', 'Open settings'],
        ['services-off', 'enable-location-services', 'Turn on location'],
        ['no-fix', 'retry', 'Try again'],
      ],
    );
    assert.equal(locationProblemMessage('permission-blocked').title, 'Turn on location to go online');
    assert.equal(locationProblemMessage('services-off').title, 'Turn on location to go online');
    assert.match(locationProblemMessage('services-off').message, /location \(GPS\) is off/);
  });

  it('tells the driver they stay offline where it is not obvious', () => {
    assert.match(locationProblemMessage('permission-denied').message, /stay offline/);
    assert.match(locationProblemMessage('no-fix').message, /still offline/);
  });
});
