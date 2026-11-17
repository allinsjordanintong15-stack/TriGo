# TriGo — Project Status

_Last updated: 2026-11-02 (after daily acceptance quota step 6)._

TriGo is a transport booking app for tricycle and motorcycle rides in Trinidad, Bohol. It
has two parts:

- **The mobile app** (React Native + Expo, Android and iOS). Passengers and drivers use the
  same app.
- **The admin website** (React + Vite, `admin/`).

Both use Firebase Authentication and Cloud Firestore. The project is on the Spark (free)
plan, so there are **no Cloud Functions and no Firebase Storage**. Every write comes from a
client and is checked by `firestore.rules`.

Business decisions are recorded in `docs/DECISIONS.md`. This file only summarises where
things stand.

## Features done

### Passenger (mobile app)
- Register, log in and reset a forgotten password.
- Profile, personal information, settings, and Help & Support. Help & Support shows the
  admin-managed support contacts with tap-to-call.
- **Booking a ride**
  - Pickup and destination are set on a map (MapLibre with OpenFreeMap tiles).
  - **Location search:** barangays are matched in the app as the passenger types
    (typos allowed) and listed above place results; choosing one puts the pin inside
    that barangay (Poblacion: the town centre), with a "Move the pin" hint to tap the
    exact spot. Places come from OpenRouteService biased to Trinidad, labelled with
    their barangay, with the phone's geocoder as fallback.
  - The road distance comes from OpenRouteService.
  - The fare is fixed and keeps its centavos. A trip between Poblacion and a barangay
    with an active tariff is charged that barangay tariff; every other trip uses the
    admin per-km fare settings. If tariffs fail to load within about 5 seconds, the app
    uses the per-km fare.
  - A fare basis line is shown under the fare ("Barangay tariff · Poblacion ↔ …",
    "₱X/km", or "Per-km fare" for older bookings). If a tariff changes before Confirm,
    the passenger sees the new fare and must confirm again.
- **Booking status**
  - The ride goes through accepted → arrived → in progress → completed, or is cancelled.
  - A standard booking no driver accepts expires after an admin-set time (default 10
    minutes). The passenger sees "No driver accepted your request" with Try again or
    Cancel, and it shows as Expired in Activity.
  - While the trip is active, the passenger and the assigned driver can see each other's
    contact numbers.
- **Out-of-area trips** (pickup or destination outside Trinidad)
  - The request goes to one driver at a time and expires after an admin-set time.
  - The fare is the admin per-km fare and is final.
  - The passenger confirms the driver who accepted, or chooses another.
- **Activity** (ride history) with trip details. From a trip, the passenger can report a
  problem, which creates a complaint.
- **Rating the driver** (2026-11-08): a completed ride shows "Trip completed" with the
  final fare, the driver, stars (1–5), quick tags, an optional comment, Skip, and Report a
  problem. Trips can also be rated later from Booking Details for 7 days; a given rating
  is shown there. Drivers' ratings show as the average (one decimal) or "New".
- **Driver application:** personal and vehicle details, plus OR/CR and LTO license photos.
  Uploads work (2026-11-17, not deployed): photos only (no PDFs), compressed on the phone
  (at most 1600 px, under 900 KB) and stored in Firestore with the application in one
  commit. Admins see thumbnails and a zoom/rotate viewer on the application page. Needs a
  new EAS development build (expo-image-manipulator).
- **Notifications tab = inbox ("Messages from TriGo"):** the passenger's warnings, newest
  first, unread highlighted; a warning opens with its reason, date, related trip and an
  "I understand" button. The Home bell shows the number of unread warnings. Built to take
  announcements later. (Built 2026-11-15, not deployed.)

### Driver (mobile app)
- Tabs: Home, Requests, Trips, Earnings, Profile.
- An online/available toggle.
- **Requests:** accept standard bookings (only unexpired ones are listed), and accept or
  claim out-of-area requests.
- **New request alerts:** for each new unexpired request while the driver is online and
  available, with no trip and no out-of-area offer waiting (not on first load, not for
  declined requests). Before the first go-online, the app explains ride request
  notifications and asks for permission (Android 13+); Profile shows whether they are on,
  with Turn on / Open phone settings.
  - TriGo on screen: the phone vibrates once.
  - TriGo in the background: a local notification instead (Android channel "Ride
    requests"). One request shows its fare, pickup → destination and km to pickup;
    several show one summary ("3 new ride requests").
  - A notification is removed when its request is taken, cancelled, expired or declined.
    All are removed when the driver goes offline or unavailable, accepts a trip or an
    out-of-area request, or signs out.
  - Tapping opens the request (standard or out-of-area), or the Requests list for a
    summary, also when the tap starts the app. Taps for another driver account are
    ignored. An out-of-area request that timed out shows "Request expired".
- Run the active trip and complete it. Completing records the payment method (Cash or
  GCash) and the final fare.
- **Home:** fares collected, labelled "before commission", and a commission summary card.
- **Earnings tab**
  - Commission balance, status, due date and grace end.
  - Per-trip commission list.
  - A form to report a GCash payment with its reference number, plus a list of submitted
    payments.
- **Commission warnings:** an overdue or suspended banner on Home and Requests.
- **Warnings from TriGo:** a Home banner while a warning is unread (opens it); Profile →
  Messages from TriGo opens the same inbox as passengers. (Built 2026-11-15, not deployed.)
- **Suspension:** a suspended driver cannot accept standard bookings or out-of-area
  requests. They can still finish current trips, log in and pay.
- **Admin suspension and messages from TriGo:** while an admin suspension is active, Home
  shows a red banner ("Suspended until <date>" or "until TriGo lifts it", with the reason)
  and the duty switch notice says the driver can stay online and finish a trip but cannot
  accept new requests. Suspensions, lifts, revokes and restores arrive as messages in
  Messages from TriGo (unread ones count on the badge and the Home banner). (Built
  2026-11-16, not deployed.)
- **Daily acceptance quota:** each driver may accept at most the admin's daily limit of
  passengers per day (resets at 12:00 AM Manila time; default 20).
  - Home always shows "Accepted today: X of N".
  - A standard accept counts one; an out-of-area request counts when the driver claims the
    booking the passenger confirmed (never at the propose). The claim is never blocked.
  - If the passenger cancels before the trip starts, the slot is given back the same day.
  - At the limit: "Daily limit reached. You can accept again after 12:00 AM." on Home and
    Requests, Accept disabled on standard and out-of-area requests, no new-request alerts
    (shown notifications are removed), and the driver is left out of the passenger's
    out-of-area driver search. The current trip can still be finished.
  - A limit change from the admin applies at once.
- A driver whose verification an admin revoked sees "Driver access revoked".

### Admin (website)
- Login is limited to accounts with the `admin` custom claim (granted with
  `scripts/setAdminClaim.mjs`).
- **Dashboard** and **Reports**: per-day or per-month charts built with Firestore
  count/sum aggregates, with CSV export.
  - "Needs your attention": pending payments, driver applications, open complaints,
    drivers behind on commission and drivers at the daily limit. Each card links to where
    the item is handled, also when all is clear ("Review →" / "View →").
- **Complaints:** list and detail, status (open / in review / resolved) and admin notes.
- **Warnings:** "Warn <name>" on a complaint (reason + confirmation; one warning per
  complaint, shown once it exists). Driver and passenger pages show "N warnings · N
  complaints" and the warning history with Withdraw. Counted only; suspension stays the
  admin's decision. Account deletion clears warning reasons. (Built 2026-11-15, not deployed.)
- **Driver verification:** review applications, then approve or reject them with remarks.
- **Driver accounts:** revoke or restore verification. Revoking needs a reason. The vehicle
  can be edited.
- **All drivers table:** 10 per page with search and Status / Vehicle / Account / Commission
  filters kept in the URL; photo, vehicle, contact, status, commission, rating and complaint
  columns; a "⋯" menu per driver (View profile, Send warning, Suspend / Lift suspension,
  Revoke / Restore verification), each with a reason the driver reads and a message to the
  driver. The driver page shows the current suspension and the history. (Built 2026-11-16,
  not deployed.)
- **Quota** (Drivers group): the daily acceptance limit (1–100, default 20 until saved),
  edited with an old → new confirmation and shown live; a live table of verified drivers'
  accepted count today against the limit, fewest slots left first, linking to each
  driver.
- **Passengers:** list and detail.
- **Out-of-Area Trips:** read-only monitor. Expired requests are shown as Expired.
- **Booking lists** (Dashboard, passenger and driver detail, complaint detail): standard
  bookings no driver accepted in time are shown as Expired. The Dashboard "Open requests"
  count includes only unexpired standard bookings.
- **Fares:** per-km fare settings per vehicle type.
- **Barangay tariffs:** stored per barangay and applied to new standard bookings.
  Passenger and driver booking lists show each booking's fare basis.
- **Commission settings:** percentage, payment period in days and grace period in days.
- **System settings:**
  - Booking request expiry for standard bookings (1–30 minutes, default 10).
  - Out-of-area on/off, request expiry and driver search radius.
  - Support contacts.
  - TriGo's GCash account name and number, which drivers see.
- **Earnings**
  - Totals: earned, collected, outstanding, cashed out and available.
  - Driver balances with a status filter.
  - Pending GCash payments, which the admin confirms or rejects with a reason.
  - Cash-outs by GCash, Maya or bank transfer. These are only recorded; the money is moved
    in the real app, and records cannot be edited.
  - CSV exports of balances, payments and cash-outs.

### Commission (end to end)
- **Recording commission**
  - Commission is recorded in the same commit as each completed trip, standard or
    out-of-area: `round(final fare × percentage)` in integer centavos.
  - The percentage is saved on each commission record.
- **Payment periods**
  - Each driver has rolling periods that end at Manila midnight, followed by a grace
    period.
  - Payments go to the oldest debt first, and partial payments are allowed.
- **Admin bookkeeping**
  - An admin confirmation updates the driver's account and `earningsLedger/totals` in the
    same commit.
  - A cash-out can never exceed what has been collected.
- **Suspension** starts automatically when a grace period ends unpaid. It lifts as soon as
  a confirmed payment covers the overdue amount.

## What is tested and how

- **Firestore rules tests:** `npm run test:rules` runs the Firestore emulator under the
  demo project `demo-trigo-rules`.
  - **926 tests in 25 files, all passing** (2026-11-15).
  - Every rule branch has tests for both allowed and denied writes. This covers bookings,
    out-of-area requests, driver verification, fares, barangay tariffs, complaints, support
    contacts, admin reads, commission accrual, payments, enforcement, cash-outs, the
    daily acceptance quota, privacy, passenger cancellation and ratings.
- **Unit tests:** `npm run test:unit` (plain Node, no emulator): **356 tests in 35 files,
  all passing** (2026-11-15). `tests/booking/dailyQuotaSync.test.ts` checks that the
  default daily limit (20) and its range (1–100) are the same in the app, `firestore.rules`
  and the admin website; `passengerCancelSync.test.ts` and `ratingSync.test.ts` do the
  same for the late-driver cancel limit and the rating window, tags, comment length and
  the admin website's rating display.
- **Rules cost headroom:** `tests/rules/measureHeadroom.ts` measures how much of
  Firestore's 1000-expression limit each heavy valid commit uses (2026-10-21).
  - Tightest path: an out-of-area propose by an approved-applicant driver, with about 46%
    of the budget left (re-measured 2026-11-02 with the quota).
  - Quota paths (driver record, 2026-11-02): out-of-area claim about 50% left, release
    giving a slot back about 53%, T1 accept by an approved-applicant driver about 51%.
  - Payment confirm: at least 72% left. Cash-out: about 86% left.
  - Limit messages are also checked in `firestore-debug.log`.
- **Type and lint checks:** `npx tsc --noEmit` and `npx eslint src tests` for the app;
  `tsc --noEmit` and `eslint .` in `admin/`.
- **Emulator seed:** `npm run emulators`, then `npm run seed:emulator`.
  - The seed writes only to the local emulators (`demo-trigo`).
  - It loads sample data for every screen: applicants in each state, bookings, out-of-area
    requests, complaints and support contacts.
  - Commission data covers every state: Carlo **due**, Bella **paid up**, Eduardo
    **overdue** (inside grace) and Felix **suspended**.
  - It includes pending, confirmed and rejected payments and a cash-out. The ledger is
    computed from those records.
  - The seed data was checked on the emulator (2026-10-21):
    - totals agree with the records;
    - statuses match the app's `commissionStatus`;
    - the rules deny Felix's accept and allow Eduardo's;
    - a seeded pending payment can be confirmed;
    - a cash-out above the available balance is refused.
- **Device tests:** the developer tests each step by hand on a phone before committing it.
  These tests are manual; there are no automated UI or end-to-end tests.

## Known limits

- **No Firebase Storage (needs the Blaze plan).**
  - Profile photos cannot work in production; the code is parked on the branch
    `feature/profile-photo`.
  - Driver application documents no longer need Storage: they are compressed photos in
    Firestore (photos only, no PDFs; each under 900 KB). Older applications that point to
    Storage files show "No documents on file".
- **OpenRouteService dependency.**
  - Routing and reverse geocoding call the ORS public API with a client-side key (free
    tier).
  - If ORS cannot return a road route, the passenger cannot book. Straight-line fares are
    not allowed. Points far from a road are retried once with a wider snap radius.
  - Outages, rate limits or slow responses block booking.
  - Place search also uses the ORS free quota. It is queried only from 3 characters,
    after a 400 ms pause, once per text per session, and not for exact barangay names.
  - Checked 2026-10-30: 3 of 3 routing requests returned 200 in about 1.3 s, and the
    route worked on the phone. Earlier timeouts were not reproduced. An OSRM backup is
    still planned before the defense.
- **Few Trinidad landmarks in place search.** ORS uses OpenStreetMap, which has few
  Trinidad places, so many local landmarks are not found; passengers pick the barangay
  and tap the exact spot instead.
- **Curated barangay pin points not collected yet.** Only Poblacion has a hand-set point
  (the town centre); the other barangays use a computed point inside the boundary.
  Points such as barangay halls still need to be collected and added to
  `src/constants/barangayPinPoints.ts`.
- **The rules cannot check the barangay of a pin.** For a tariff booking the rules check
  that the fare equals the active admin tariff for the stored barangay, but not that the
  pickup or destination is really inside that barangay (rules have no point-in-polygon
  check), and they do not check per-km fares. A server-side check needs Cloud
  Functions (Blaze).
- **No push notifications; ride request alerts are local only.**
  - No server sends notifications (no Cloud Functions). True push, which would reach a
    closed app, needs Cloud Functions and the Blaze plan.
  - Drivers get alerts from the app's own Firestore listeners: a vibration while TriGo is
    on screen, and a local notification through `expo-notifications` while it is in the
    background.
  - Background alerts work only while the app's process is still alive. Android may
    freeze a backgrounded app or cut its network in Doze (screen off) within minutes.
  - Nothing arrives once the app is closed, swiped away or killed, or the phone restarts.
  - iOS: practically no background alerts, because iOS suspends a backgrounded app almost
    at once.
  - Battery-saver settings on some Android phones (e.g. "optimised" or "restricted" app
    battery use) stop or kill backgrounded apps sooner, so alerts can stop earlier there.
  - Tapping a ride request notification while the app is in passenger mode does nothing;
    the driver has to switch to driver mode and open Requests.
  - A summary notification keeps its posted count until all of its requests are gone
    (posting it again with a lower count would ring the phone again).
  - Future option without Blaze: an Android foreground service ("TriGo: you're online")
    to keep the listener running; it needs another native library and a Play Store
    declaration.
- **Drivers stay online after closing the app.** `drivers/{uid}.isOnline` stays true when
  the app is closed or killed, so passengers can wait on a driver who sees nothing until
  the request expires. Future fix: presence or a heartbeat (a `lastSeenAt` the app
  refreshes, with stale drivers treated as offline).
- **GCash is checked by hand.**
  - TriGo moves no money and has no payment gateway.
  - The admin checks each reported reference in TriGo's GCash account before confirming.
  - Cash-outs are only records.
  - A wrongly confirmed payment or a wrong cash-out cannot be edited; correcting them is
    not in scope yet.
- **Driver ratings (no Cloud Functions).**
  - The passenger's app raises `driverRatings/{driverId}` in the same commit as the
    rating; the rules check the exact new sum and count. Two passengers rating the same
    driver at the same moment: one commit is retried by the Firestore transaction.
  - Deploy the rules and the app together: older app builds have no rating flow, and the
    new app's ratings are refused by the old rules.
  - `drivers/{uid}.rating` (admin-only) is no longer shown; demo values in the emulator
    seed are ignored. Ratings cannot be edited or removed, also not by admins.
  - No admin correction path for `driverRatings/{driverId}`: admins cannot change a
    driver's rating sum or count (for example to remove an unfair rating). Not in scope yet.
- **No Cloud Functions.** Expired standard bookings and out-of-area requests are never
  rewritten (a booking stays `pending`); they are shown as expired from `expiresAt`. Every balance change is a client write checked by the rules.
- **Daily acceptance quota.**
  - The rules and the app must be deployed together: after the quota rules go live, an
    older app build can no longer accept or claim, and the new app cannot before them.
  - The Manila day written with an accept comes from the phone, corrected by a server-clock
    estimate taken when the driver goes online. An accept refused within 2 minutes of
    midnight is retried once with the other day. If the app restarts while online it uses
    the phone clock until the next go-online, so a phone with a badly wrong date cannot
    accept until then.
  - A slot is given back only by the driver's app when it releases the cancelled booking.
    If that happens after midnight, nothing is given back (the new day starts at 0 anyway).
  - A driver at the limit stays "available": standard requests still reach them (Accept is
    disabled), and the Dashboard Online/Available counts include them. Only the
    passenger's out-of-area driver search leaves them out, using the passenger phone's
    clock for the day.
  - There are no per-driver or per-vehicle limits, and an admin cannot reset one driver's
    count.
  - The Dashboard "Drivers at daily limit" card needs the `drivers (isVerified,
    acceptedDay, acceptedCount)` index; the emulator seed has no quota data.

## Pending decisions

- **Quota (#1):** decided 2026-11-02 and built: a daily acceptance limit per driver
  (`docs/DECISIONS.md`, Drivers). Still to carry into the SRS and the SPMP.
- **Admin platform (#3):** built as a separate web app (`admin/`). The decision still has
  to be recorded in `docs/CLAUDE.md`, the SRS and the SPMP.
- **Map/location provider (#4):** in use are MapLibre with OpenFreeMap tiles, plus
  OpenRouteService for routing and geocoding. This has not been formally recorded as a
  decision.
- **Rating, Earnings and Vehicle Fleet (#5):** Earnings exists as the commission Earnings
  tab. Rating and Vehicle Fleet are not built.
- **Blaze plan for Storage:** needed for profile photos (driver documents use Firestore).
- **iOS photo/camera permission text:** needs updating in the next EAS build
  (`docs/DECISIONS.md`).
- **SRS/SPMP updates:** no entry in `docs/DECISIONS.md` has been carried into
  `docs/SRS.md` and `docs/SPMP.md` yet; every entry is still "No".
- **Payment provider (future):** automatic payments or disbursement (for example PayMongo)
  would need a registered business and Blaze.
- **TODO: Update privacy notice (warnings + announcements) after Task B2, single version
  bump and re-consent, before defense.** The current notice (1.0) does not mention
  `warnings/{id}`, `adminMessages/{id}`, the driver suspension fields or the in-app inbox.
