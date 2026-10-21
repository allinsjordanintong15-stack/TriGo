# TriGo — Project Status

_Last updated: 2026-10-21 (after commission step 8)._

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
  - The road distance comes from OpenRouteService.
  - The fare comes from the admin per-km fare settings, is fixed, and keeps its centavos.
- **Booking status**
  - The ride goes through accepted → arrived → in progress → completed, or is cancelled.
  - While the trip is active, the passenger and the assigned driver can see each other's
    contact numbers.
- **Out-of-area trips** (pickup or destination outside Trinidad)
  - The request goes to one driver at a time and expires after an admin-set time.
  - The fare is the admin per-km fare and is final.
  - The passenger confirms the driver who accepted, or chooses another.
- **Activity** (ride history) with trip details. From a trip, the passenger can report a
  problem, which creates a complaint.
- **Driver application:** personal and vehicle details, plus OR/CR and LTO license photos
  (blocked by Storage, see Known limits).
- **Notifications screen:** lists the user's notification documents and marks them as read.

### Driver (mobile app)
- Tabs: Home, Requests, Trips, Earnings, Profile.
- An online/available toggle.
- **Requests:** accept standard bookings, and accept or claim out-of-area requests.
- Run the active trip and complete it. Completing records the payment method (Cash or
  GCash) and the final fare.
- **Home:** fares collected, labelled "before commission", and a commission summary card.
- **Earnings tab**
  - Commission balance, status, due date and grace end.
  - Per-trip commission list.
  - A form to report a GCash payment with its reference number, plus a list of submitted
    payments.
- **Commission warnings:** an overdue or suspended banner on Home and Requests.
- **Suspension:** a suspended driver cannot accept standard bookings or out-of-area
  requests. They can still finish current trips, log in and pay.
- A driver whose verification an admin revoked sees "Driver access revoked".

### Admin (website)
- Login is limited to accounts with the `admin` custom claim (granted with
  `scripts/setAdminClaim.mjs`).
- **Dashboard** and **Reports**: per-day or per-month charts built with Firestore
  count/sum aggregates, with CSV export.
- **Complaints:** list and detail, status (open / in review / resolved) and admin notes.
- **Driver verification:** review applications, then approve or reject them with remarks.
- **Driver accounts:** revoke or restore verification. Revoking needs a reason. The vehicle
  can be edited.
- **Passengers:** list and detail.
- **Out-of-Area Trips:** read-only monitor. Expired requests are shown as Expired.
- **Fares:** per-km fare settings per vehicle type.
- **Barangay tariffs:** stored per barangay, but the app does not apply them yet (see
  Known limits).
- **Commission settings:** percentage, payment period in days and grace period in days.
- **System settings:**
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
  - **602 tests in 19 files, all passing** (2026-10-21).
  - Every rule branch has tests for both allowed and denied writes. This covers bookings,
    out-of-area requests, driver verification, fares, barangay tariffs, complaints, support
    contacts, admin reads, commission accrual, payments, enforcement and cash-outs.
- **Rules cost headroom:** `tests/rules/measureHeadroom.ts` measures how much of
  Firestore's 1000-expression limit each heavy valid commit uses (2026-10-21).
  - Tightest path: an out-of-area propose by an approved-applicant driver, with about 46%
    of the budget left.
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
  - Driver application document uploads and profile photos cannot work in production.
  - The profile-photo code is parked on the branch `feature/profile-photo`.
- **OpenRouteService dependency.**
  - Routing and reverse geocoding call the ORS public API with a client-side key (free
    tier).
  - If ORS cannot return a road route, the passenger cannot book. Straight-line fares are
    not allowed. Points far from a road are retried once with a wider snap radius.
  - Outages, rate limits or slow responses block booking.
- **Barangay tariffs are not applied yet.** Admins can save them, but the mobile app does
  not read `barangayTariffs`, so every fare uses the per-km settings.
- **No push notifications.**
  - The app does not use `expo-notifications`.
  - The Notifications screen only lists `notifications` documents, and nothing in the app
    creates them (the rules allow no client writes).
- **GCash is checked by hand.**
  - TriGo moves no money and has no payment gateway.
  - The admin checks each reported reference in TriGo's GCash account before confirming.
  - Cash-outs are only records.
  - A wrongly confirmed payment or a wrong cash-out cannot be edited; correcting them is
    not in scope yet.
- **Driver rating is display only.** `drivers.rating` is shown, but there is no rating flow
  that updates it.
- **Standard bookings never expire.** A standard booking that no driver accepts stays
  `pending` until the passenger cancels it; only out-of-area requests have an expiry.
- **No Cloud Functions.** Expired out-of-area requests are never rewritten; they are shown
  as expired from `expiresAt`. Every balance change is a client write checked by the rules.

## Pending decisions

- **Quota (open decision #1 in `docs/CLAUDE.md`):** what "quota" means is undecided, and
  nothing is built for it.
- **Admin platform (#3):** built as a separate web app (`admin/`). The decision still has
  to be recorded in `docs/CLAUDE.md`, the SRS and the SPMP.
- **Map/location provider (#4):** in use are MapLibre with OpenFreeMap tiles, plus
  OpenRouteService for routing and geocoding. This has not been formally recorded as a
  decision.
- **Rating, Earnings and Vehicle Fleet (#5):** Earnings exists as the commission Earnings
  tab. Rating and Vehicle Fleet are not built.
- **Blaze plan for Storage:** needed for document uploads and profile photos.
- **iOS photo/camera permission text:** needs updating in the next EAS build
  (`docs/DECISIONS.md`).
- **SRS/SPMP updates:** no entry in `docs/DECISIONS.md` has been carried into
  `docs/SRS.md` and `docs/SPMP.md` yet; every entry is still "No".
- **Payment provider (future):** automatic payments or disbursement (for example PayMongo)
  would need a registered business and Blaze.
