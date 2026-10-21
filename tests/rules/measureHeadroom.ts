/// <reference types="node" />

// Measures how far heavy commits are from Firestore's limit of 1000 rules expressions per
// request, in the limit's own units. Not a test (not *.test.ts); run it under the emulator:
//   npx firebase emulators:exec --only firestore --project demo-trigo-rules "node tests/rules/measureHeadroom.ts"
// (TRIGO_HEADROOM=payments in the environment: commission payment and cash-out scenarios only;
// TRIGO_HEADROOM=enforcement: T1 accept, propose, claim and the out-of-area confirm only.)
// Method: a test-only copy of firestore.rules (never written to disk) adds `&& pad()` to the
// one rule each commit is sure to pass through, where pad() is N trivially true terms. A
// binary search finds the largest N at which the valid commit still succeeds. The same
// search on a rule that does nothing else (calibration) shows how many terms fit in a whole
// budget of 1000, so margin = N(commit) / N(calibration) = share of the budget left over.
// Self-contained on purpose: Node's type stripping does not resolve the "@/..." aliases.

import { readFileSync } from 'node:fs';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  account,
  accountDoc,
  ADMIN,
  APPLICANT_DRIVER,
  appWrites,
  availableDriverRecord,
  baseDocs,
  BOOKING,
  cashOutWrites,
  claimDocs,
  commitAccept,
  commitCashOut,
  commitClaim,
  commitConfirm,
  commitPropose,
  commitSubmit,
  commitWrites,
  confirmWrites,
  DAY_MS,
  DRIVER,
  HOUR_MS,
  ledgerDoc,
  multiPeriodDocs,
  openBooking,
  openRequest,
  outOfAreaInProgressBooking,
  PASSENGER,
  PAYMENT,
  periodDoc,
  REFERENCE,
  REQUEST as OPEN_REQUEST,
  submittedDocs,
  submitWrites,
  tripDocs,
  unpaidFrom,
  type Period,
  type Writes,
} from './commissionFixtures.ts';

const PROJECT_ID = 'demo-trigo-rules';
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const BASE_RULES = readFileSync('firestore.rules', 'utf8');
const MAX_TERMS = 1200;

setLogLevel('silent');

const testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: BASE_RULES } });

// ─── Padded rules ───────────────────────────────────────────────────────────

// Where pad() goes: the rule one write of the commit passes through.
type Target =
  | 'booking T4'
  | 'driver record'
  | 'commission'
  | 'account create'
  | 'account update'
  | 'period'
  | 'T1 accept'
  | 'propose'
  | 'claim'
  | 'confirm: request accept'
  | 'confirm: booking create'
  | 'payment submit'
  | 'reference create'
  | 'payment review'
  | 'account credit'
  | 'ledger create'
  | 'ledger update'
  | 'reference free'
  | 'cash-out create'
  | 'ledger cash-out'
  | 'calibration';

const ANCHORS: Record<Exclude<Target, 'calibration'>, [string, string]> = {
  'booking T4': [
    '            && (!exists(commissionSettingsPath()) || existsAfter(commissionPath(bookingId)))\n',
    '            && (!exists(commissionSettingsPath()) || existsAfter(commissionPath(bookingId)))\n            && pad()\n',
  ],
  'driver record': [
    '        && isValidCurrentBookingChange()\n        && isValidCurrentRequestChange();',
    '        && isValidCurrentBookingChange()\n        && isValidCurrentRequestChange()\n        && pad();',
  ],
  commission: ['      allow create: if isValidCommissionCreate();', '      allow create: if isValidCommissionCreate() && pad();'],
  'account create': [
    "      allow create: if isOwner(driverId)\n        && request.resource.data.keys().hasAll([\n          'driverId', 'accruedCentavos'",
    "      allow create: if isOwner(driverId)\n        && pad()\n        && request.resource.data.keys().hasAll([\n          'driverId', 'accruedCentavos'",
  ],
  'account update': [
    '      allow update: if isOwner(driverId)\n        && recordsNewCommission()',
    '      allow update: if isOwner(driverId)\n        && pad()\n        && recordsNewCommission()',
  ],
  period: ['      allow create: if isValidPeriodCreate();', '      allow create: if isValidPeriodCreate() && pad();'],
  'T1 accept': [
    "        && !isCommissionSuspended()\n        && request.resource.data.status == 'accepted'",
    "        && !isCommissionSuspended()\n        && pad()\n        && request.resource.data.status == 'accepted'",
  ],
  propose: [
    "        && !isCommissionSuspended()\n        && request.resource.data.status == 'negotiating'",
    "        && !isCommissionSuspended()\n        && pad()\n        && request.resource.data.status == 'negotiating'",
  ],
  claim: [
    '        && get(requestPath(bookingId)).data.driverId == request.auth.uid\n',
    '        && get(requestPath(bookingId)).data.driverId == request.auth.uid\n        && pad()\n',
  ],
  'confirm: request accept': [
    "            && getAfter(bookingPath(requestId)).data.bookingType == 'out_of_area'\n",
    "            && getAfter(bookingPath(requestId)).data.bookingType == 'out_of_area'\n            && pad()\n",
  ],
  'confirm: booking create': [
    '        && isValidOutOfAreaBookingCreate();',
    '        && isValidOutOfAreaBookingCreate()\n        && pad();',
  ],
  'payment submit': ['      allow create: if isValidPaymentCreate();', '      allow create: if isValidPaymentCreate() && pad();'],
  'reference create': ['      allow create: if isValidReferenceCreate();', '      allow create: if isValidReferenceCreate() && pad();'],
  'payment review': ['      allow update: if isValidPaymentReview();', '      allow update: if isValidPaymentReview() && pad();'],
  'account credit': [
    "      allow update: if isAdmin()\n        && onlyChanged(['paidCentavos'",
    "      allow update: if isAdmin()\n        && pad()\n        && onlyChanged(['paidCentavos'",
  ],
  'ledger create': [
    "      allow create: if isAdmin()\n        && request.resource.data.keys().hasAll(['collectedCentavos'",
    "      allow create: if isAdmin()\n        && pad()\n        && request.resource.data.keys().hasAll(['collectedCentavos'",
  ],
  'ledger update': [
    "      allow update: if isAdmin()\n        && onlyChanged(['collectedCentavos'",
    "      allow update: if isAdmin()\n        && pad()\n        && onlyChanged(['collectedCentavos'",
  ],
  'cash-out create': ['      allow create: if isValidCashOutCreate();', '      allow create: if isValidCashOutCreate() && pad();'],
  'ledger cash-out': [
    "      allow update: if isAdmin()\n        && onlyChanged(['cashedOutCentavos'",
    "      allow update: if isAdmin()\n        && pad()\n        && onlyChanged(['cashedOutCentavos'",
  ],
  'reference free': [
    '      allow delete: if isAdmin()\n        && get(paymentPath(resource.data.paymentId))',
    '      allow delete: if isAdmin()\n        && pad()\n        && get(paymentPath(resource.data.paymentId))',
  ],
};

// The rules compiler rejects one very long && chain, so the terms are split into helper
// functions of CHUNK terms each. The scenarios and the calibration use the same helpers, so
// the cost per term (including the calls) is the same on both sides.
const CHUNK = 50;

function padFunction(terms: number): string {
  if (terms === 0) return '    function pad() {\n      return true;\n    }\n\n';
  const chunks: string[] = [];
  for (let start = 0; start < terms; start += CHUNK) {
    const size = Math.min(CHUNK, terms - start);
    chunks.push(Array.from({ length: size }, () => '1 == 1').join(' && '));
  }
  const helpers = chunks.map((body, index) => `    function pad${index}() {\n      return ${body};\n    }\n`).join('');
  const calls = chunks.map((_, index) => `pad${index}()`).join(' && ');
  return `${helpers}    function pad() {\n      return ${calls};\n    }\n\n`;
}

function paddedRules(target: Target, terms: number): string {
  let rules = BASE_RULES.replace(/\r\n/g, '\n');
  rules = replaceOnce(rules, '    // ─── Helpers ───', `${padFunction(terms)}    // ─── Helpers ───`);
  if (target === 'calibration') {
    return replaceOnce(
      rules,
      '    // Deny everything else by default.',
      '    match /padProbe/{id} {\n      allow create: if pad();\n    }\n\n    // Deny everything else by default.',
    );
  }
  const [find, replacement] = ANCHORS[target];
  return replaceOnce(rules, find, replacement);
}

function replaceOnce(text: string, find: string, replacement: string): string {
  const index = text.indexOf(find);
  if (index < 0 || text.indexOf(find, index + 1) >= 0) throw new Error(`Rules anchor not found exactly once: ${find}`);
  return text.slice(0, index) + replacement + text.slice(index + find.length);
}

async function loadRules(content: string): Promise<void> {
  const response = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });
  if (!response.ok) throw new Error(`Loading rules failed: ${response.status} ${await response.text()}`);
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

function db(uid: string, claims: Record<string, unknown> = {}): Firestore {
  return testEnv.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

async function seed(docs: Record<string, DocumentData>): Promise<void> {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries({ ...baseDocs(), ...docs })) {
      await setDoc(doc(firestore, path), data);
    }
  });
}

type Scenario = { label: string; targets: Target[]; run: () => Promise<void> };

function completion(
  label: string,
  docs: () => Record<string, DocumentData>,
  writes: () => Writes,
  driverId = DRIVER,
): Scenario {
  const sample = writes();
  const targets: Target[] = ['booking T4', 'driver record'];
  if (sample.commission) targets.push('commission');
  if (sample.account) targets.push(sample.account.kind === 'set' ? 'account create' : 'account update');
  if (sample.period) targets.push('period');
  return {
    label,
    targets,
    run: async () => {
      await seed(docs());
      await commitWrites(db(driverId), writes(), driverId);
    },
  };
}

const olderUnpaid = (): Period => ({
  seq: 1,
  startAt: Timestamp.fromMillis(Date.now() - 20 * DAY_MS),
  periodDays: 7,
  graceDays: 3,
});

// Fixed per scenario so the seeded account and the writes agree.
const running = account(HOUR_MS);
const endedPaidUp = account(10 * DAY_MS, { paidCentavos: 900 });
const endedOwing = account(10 * DAY_MS, { paidCentavos: 500 });
const endedOlderUnpaid = account(10 * DAY_MS, { paidCentavos: 100, unpaid: olderUnpaid() });

// Out-of-area confirm, as acceptProposalAndCreateBooking writes it (outOfAreaRequests.test.ts).
const REQUEST = 'request1';
const FARE = 520;
const location = (address: string) => ({ latitude: 9.97, longitude: 124.48, address });

function fareAgreement(overrides: DocumentData = {}): DocumentData {
  return {
    standardEstimatedFare: FARE,
    driverProposedFare: FARE,
    agreedFare: FARE,
    agreedByPassenger: false,
    agreedByDriver: true,
    agreedAt: null,
    ...overrides,
  };
}

const confirm: Scenario = {
  label: 'out-of-area confirm (accept + booking create)',
  targets: ['confirm: request accept', 'confirm: booking create'],
  run: async () => {
    await seed({
      [`drivers/${DRIVER}`]: {
        isVerified: true,
        isOnline: true,
        isAvailable: false,
        vehicleType: 'tricycle',
        currentBookingId: null,
        currentRequestId: REQUEST,
      },
      [`outOfAreaRequests/${REQUEST}`]: {
        passengerId: PASSENGER,
        pickupLocation: location('Poblacion, Trinidad'),
        destination: location('Tagbilaran City'),
        vehicleType: 'tricycle',
        distanceKm: 48.5,
        standardEstimatedFare: FARE,
        suggestedAgreementFare: FARE,
        agreedFare: null,
        status: 'negotiating',
        driverId: DRIVER,
        fareAgreement: fareAgreement(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
      },
    });
    const firestore = db(PASSENGER);
    const accepted = fareAgreement({ agreedByPassenger: true, agreedAt: serverTimestamp() });
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'outOfAreaRequests', REQUEST), {
      status: 'accepted',
      agreedFare: FARE,
      fareAgreement: accepted,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, 'bookings', REQUEST), {
      passengerId: PASSENGER,
      driverId: null,
      vehicleType: 'tricycle',
      bookingType: 'out_of_area',
      pickupLocation: location('Poblacion, Trinidad'),
      destination: location('Tagbilaran City'),
      distanceKm: 48.5,
      estimatedFare: FARE,
      driverProposedFare: FARE,
      agreedFare: FARE,
      fareAgreement: accepted,
      finalFare: null,
      status: 'pending',
      outOfAreaRequestId: REQUEST,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      acceptedAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      paymentMethod: null,
      cancelledBy: null,
      cancellationReason: null,
    });
    await batch.commit();
  },
};

// New work (commissionEnforcement.test.ts) with the costliest account that still passes
// isCommissionSuspended(): an unpaid closed period inside its grace period, so both halves
// of the check are evaluated.
const inGrace = account(2 * DAY_MS, { unpaid: unpaidFrom(periodDoc(1, 0, 8 * DAY_MS)) });

function newWork(
  label: string,
  target: 'T1 accept' | 'propose',
  withAccount: boolean,
  driverId = DRIVER,
): Scenario {
  return {
    label,
    targets: [target, 'driver record'],
    run: async () => {
      await seed({
        [`drivers/${driverId}`]: availableDriverRecord(),
        [`bookings/${BOOKING}`]: openBooking(),
        [`outOfAreaRequests/${OPEN_REQUEST}`]: openRequest(),
        ...(withAccount ? { [`commissionAccounts/${driverId}`]: accountDoc(inGrace, driverId) } : {}),
      });
      if (target === 'T1 accept') await commitAccept(db(driverId), driverId);
      else await commitPropose(db(driverId), driverId);
    },
  };
}

const claim: Scenario = {
  label: 'out-of-area claim (rules unchanged), account inside grace',
  targets: ['claim', 'driver record'],
  run: async () => {
    await seed({ ...claimDocs(), [`commissionAccounts/${DRIVER}`]: accountDoc(inGrace) });
    await commitClaim(db(DRIVER));
  },
};

// Commission payments (commissionPayments.test.ts): periods 1–3 closed (start totals 0,
// 300, 600), period 4 running from 900, period 1 unpaid.
const { docs: MULTI, periods: PERIODS } = multiPeriodDocs();
const LEDGER = { collectedCentavos: 5000, cashedOutCentavos: 0, lastPaymentId: 'old', updatedAt: Timestamp.now() };

function paymentConfirm(label: string, amount: number, unpaid: Period | null, withLedger: boolean): Scenario {
  return {
    label,
    targets: ['payment review', 'account credit', withLedger ? 'ledger update' : 'ledger create'],
    run: async () => {
      await seed({ ...MULTI, ...submittedDocs(amount), ...(withLedger ? { 'earningsLedger/totals': LEDGER } : {}) });
      await commitConfirm(
        db(ADMIN, { admin: true }),
        confirmWrites({ amountCentavos: amount, paidAfter: amount, unpaid, collectedBefore: withLedger ? 5000 : null }),
      );
    },
  };
}

const paymentSubmit: Scenario = {
  label: 'payment submit (payment + reference lock)',
  targets: ['payment submit', 'reference create'],
  run: async () => {
    await seed(MULTI);
    await commitSubmit(db(DRIVER), submitWrites(700));
  },
};

const paymentReject: Scenario = {
  label: 'payment reject (payment + reference freed)',
  targets: ['payment review', 'reference free'],
  run: async () => {
    await seed({ ...MULTI, ...submittedDocs(700) });
    const firestore = db(ADMIN, { admin: true });
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'commissionPayments', PAYMENT), {
      status: 'rejected',
      rejectionReason: 'No GCash payment with this reference',
      reviewedAt: serverTimestamp(),
      reviewedBy: ADMIN,
    });
    batch.delete(doc(firestore, 'paymentReferences', REFERENCE));
    await batch.commit();
  },
};

const cashOut: Scenario = {
  label: 'payment ledger: cash-out (cash-out + ledger update)',
  targets: ['cash-out create', 'ledger cash-out'],
  run: async () => {
    await seed({ 'earningsLedger/totals': ledgerDoc() });
    await commitCashOut(db(ADMIN, { admin: true }), cashOutWrites(2500));
  },
};

const SCENARIOS: Scenario[] = [
  completion('completion: no commission settings', () => tripDocs({ settings: null }), () => appWrites({ settings: null })),
  completion('completion: standard, first trip (account create)', () => tripDocs(), () => appWrites()),
  completion(
    'completion: standard, first trip, approved-applicant driver',
    () => tripDocs({ driverId: APPLICANT_DRIVER }),
    () => appWrites({ driverId: APPLICANT_DRIVER }),
    APPLICANT_DRIVER,
  ),
  completion('completion: standard, same period', () => tripDocs({ account: running }), () => appWrites({ before: running })),
  completion(
    'completion: standard, period roll, paid up',
    () => tripDocs({ account: endedPaidUp }),
    () => appWrites({ before: endedPaidUp, openNextPeriod: true }),
  ),
  completion(
    'completion: standard, period roll, closing period unpaid',
    () => tripDocs({ account: endedOwing }),
    () => appWrites({ before: endedOwing, openNextPeriod: true }),
  ),
  completion(
    'completion: standard, period roll, older unpaid period',
    () => tripDocs({ account: endedOlderUnpaid }),
    () => appWrites({ before: endedOlderUnpaid, openNextPeriod: true }),
  ),
  completion(
    'completion: out-of-area, same period',
    () => tripDocs({ account: running, booking: outOfAreaInProgressBooking(DRIVER, FARE) }),
    () => appWrites({ before: running, finalFare: FARE, bookingType: 'out_of_area' }),
  ),
  completion(
    'completion: out-of-area, period roll',
    () => tripDocs({ account: endedOwing, booking: outOfAreaInProgressBooking(DRIVER, FARE) }),
    () => appWrites({ before: endedOwing, finalFare: FARE, bookingType: 'out_of_area', openNextPeriod: true }),
  ),
  completion(
    'completion: out-of-area, first trip, approved-applicant driver',
    () => tripDocs({ driverId: APPLICANT_DRIVER, booking: outOfAreaInProgressBooking(APPLICANT_DRIVER, FARE) }),
    () => appWrites({ driverId: APPLICANT_DRIVER, finalFare: FARE, bookingType: 'out_of_area' }),
    APPLICANT_DRIVER,
  ),
  newWork('T1 accept: no commission account', 'T1 accept', false),
  newWork('T1 accept: account inside grace', 'T1 accept', true),
  newWork('T1 accept: account inside grace, approved-applicant driver', 'T1 accept', true, APPLICANT_DRIVER),
  newWork('propose: no commission account', 'propose', false),
  newWork('propose: account inside grace', 'propose', true),
  newWork('propose: account inside grace, approved-applicant driver', 'propose', true, APPLICANT_DRIVER),
  claim,
  confirm,
  paymentSubmit,
  paymentConfirm('payment confirm: pointer stays on period 1 (reads periods 1 and 2), first ledger', 299, unpaidFrom(PERIODS[0]), false),
  paymentConfirm('payment confirm: pointer 1 → 3 (reads period 3; next is current), ledger update', 700, unpaidFrom(PERIODS[2]), true),
  paymentConfirm('payment confirm: all closed periods paid (pointer cleared), ledger update', 900, null, true),
  paymentReject,
  cashOut,
];

// TRIGO_HEADROOM=payments measures only the payment scenarios (and the calibration).
const ONLY_PAYMENTS = process.env.TRIGO_HEADROOM === 'payments';
const ONLY_ENFORCEMENT = process.env.TRIGO_HEADROOM === 'enforcement';
const ENFORCEMENT_LABELS = /^(T1 accept|propose|out-of-area claim|out-of-area confirm)/;

const calibration: Scenario = {
  label: 'calibration (rule with only pad())',
  targets: ['calibration'],
  run: async () => {
    await testEnv.clearFirestore();
    await setDoc(doc(db(DRIVER), 'padProbe', 'x'), { a: 1 });
  },
};

// ─── Search ─────────────────────────────────────────────────────────────────

async function passes(scenario: Scenario, target: Target, terms: number): Promise<{ ok: boolean; message: string }> {
  await loadRules(paddedRules(target, terms));
  try {
    await scenario.run();
    return { ok: true, message: '' };
  } catch (error) {
    return { ok: false, message: String((error as Error).message ?? error) };
  }
}

/** Largest number of pad terms with which the scenario still succeeds. */
async function maxTerms(scenario: Scenario, target: Target): Promise<{ terms: number; failure: string }> {
  const base = await passes(scenario, target, 0);
  if (!base.ok) throw new Error(`${scenario.label} fails without padding: ${base.message}`);
  const top = await passes(scenario, target, MAX_TERMS);
  if (top.ok) throw new Error(`${scenario.label} still passes with ${MAX_TERMS} terms`);
  let low = 0;
  let high = MAX_TERMS;
  let failure = top.message;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const result = await passes(scenario, target, mid);
    if (result.ok) low = mid;
    else {
      high = mid;
      failure = result.message;
    }
  }
  return { terms: low, failure };
}

try {
  const cal = await maxTerms(calibration, 'calibration');
  console.log(`${calibration.label}: ${cal.terms} terms fit in a whole budget of 1000`);
  const selected = SCENARIOS.filter(
    (s) =>
      (!ONLY_PAYMENTS || s.label.startsWith('payment')) &&
      (!ONLY_ENFORCEMENT || ENFORCEMENT_LABELS.test(s.label)),
  );
  for (const scenario of selected) {
    console.log(scenario.label);
    for (const target of scenario.targets) {
      const result = await maxTerms(scenario, target);
      const margin = (result.terms / cal.terms) * 100;
      const used = Math.round(1000 * (1 - result.terms / cal.terms));
      const cause = /maximum of 1000/.test(result.failure) ? 'limit' : `OTHER: ${result.failure.slice(0, 120)}`;
      console.log(
        `  pad at ${target}: ${result.terms} terms left, margin ${margin.toFixed(1)}%, ~${used}/1000 used (fails above: ${cause})`,
      );
    }
  }
} finally {
  await loadRules(BASE_RULES);
  await testEnv.cleanup();
}
