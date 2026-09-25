# TriGo — Project Status Audit

_Audit date: 2026-09-25. Read-only audit: no code was changed._

**Where the docs were found:** `CLAUDE.md` (new version), `SRS.md` and `SPMP.md` exist only inside the untracked `files.zip` in the repo root. There is no `docs/` folder. In the working tree, `CLAUDE.md` and `AGENTS.md` are deleted (git status `D`). The committed `CLAUDE.md` was just `@AGENTS.md`, and `AGENTS.md` only held an Expo SDK 56 note.

**Checks run:**

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | ✅ Passes with 0 errors |
| `npx expo-doctor` | ⚠️ 21/22 passed. 1 failure: **Hermes V1 memory regression** in `expo@56.0.22` / RN 0.85.3 (Hermes `250829098.0.10`). The suggested fix is Expo SDK 57 (`expo@^57.0.9`) or RN ≥ 0.86.2. It is a warning, not a build blocker, and the SDK upgrade should get its own session. |
| Tests | None. There is no test runner in `package.json` and no test files. |
| Cloud Functions | None. There is no `functions/` folder and no `firebase.json` or `.firebaserc`. Rules are pasted into the Firebase Console by hand. |

---

## a. Feature matrix (SRS §2.2 Product Functions)

Legend: **Done** = works end to end against Firestore and rules. **Partial** = works, but part of it is missing or it dead-ends. **UI-only** = the screen exists but nothing produces or saves the data. **Missing** = not present.

### Passenger

| # | Function | Status | Evidence / notes |
| --- | --- | --- | --- |
| 1 | Register | Done | `src/app/(auth)/register.tsx`, `services/authService.ts#registerPassenger` → `users/{uid}` (role `passenger`), `validations/auth.ts` |
| 2 | Login | Done | `src/app/(auth)/login.tsx`, `authService.loginUser` (routes by role and rejects `admin`), `(auth)/forgot-password.tsx` (password reset) |
| 3 | Profile (view) | Done | `(passenger)/(tabs)/profile/index.tsx`, `profile/personal-information.tsx` |
| 4 | Edit Profile | Done | `profile/edit.tsx` → `authService.updatePassengerProfile` (fullName, mobileNumber only; there is no photo upload) |
| 5 | Book a Ride | Done (standard) / Partial (out-of-area) | `(tabs)/home.tsx` → `booking/confirmation.tsx` → `bookingService.createStandardBooking`. Out-of-area: `createOutOfAreaRequest` → `out-of-area-search.tsx` → `agreement.tsx` → `createOutOfAreaBooking`. The booking that results is never assigned to a driver (see §c). |
| 6 | Pickup Location | Done | `components/home/LocationInput.tsx`, `LocationSearch.tsx`, `BookingMap.tsx`, `services/locationService.ts` (GPS + expo-location geocoding) |
| 7 | Destination | Done | Same files as #6 |
| 8 | View Available Drivers | Partial | Only on the out-of-area screen: `booking/out-of-area-search.tsx` → `driverSearchService.findNearbyAvailableDrivers`. Standard bookings show no drivers and the home map shows no drivers. |
| 9 | Fare Information | Done | `services/fareService.ts` (`fareSettings/active` doc, falling back to `constants/index.ts#DEFAULT_FARE_SETTINGS`), `components/booking/TripSummaryCard.tsx`, `utils/fare.ts`. Distance is straight-line (haversine), not road distance. |
| 10 | Payment Method (Cash/GCash) | **Missing** | No `paymentMethod` field, UI or type anywhere. |
| 11 | Confirm Booking | Done | `booking/confirmation.tsx` |
| 12 | Cancel Booking | Done | `booking/status.tsx` → `bookingService.cancelBooking`; allowed statuses in `constants/cancellation.ts`, mirrored in rules |
| 13 | Booking Status | Done | `booking/status.tsx`, `components/booking/BookingStatusCard.tsx` (live `onSnapshot`, shows assigned driver via `driverService.getDriverRecord`) |
| 14 | Ride Status | Partial | The UI handles `arriving` / `in_progress` / `completed` (`utils/bookingStatus.ts`, `StatusBadge.tsx`), but no driver code or rule ever sets those statuses. Bookings stop at `accepted`. |
| 15 | Payment Information | **Missing** | Nothing is shown on `activity/[bookingId].tsx` or `status.tsx` beyond the fare. |
| 16 | Ride History | Done | `(tabs)/activity/index.tsx`, `activity/[bookingId].tsx`, `PassengerBookingHistoryCard.tsx`. In practice, "completed" rides can't happen yet (see #14). |
| 17 | Notifications | UI-only | `(tabs)/notifications.tsx` + `notificationService.ts` read and mark-read `notifications`, but **nothing creates notifications**: there is no client write, no create rule and no Cloud Function. |
| 18 | Logout | Done | `profile/index.tsx` → `authService.logout` |

### Driver

| # | Function | Status | Evidence / notes |
| --- | --- | --- | --- |
| 1 | Register (personal + vehicle) | Partial | Drivers register through a passenger account: `profile/driver-application.tsx`, `DriverApplicationCard.tsx`, `services/driverApplicationService.ts`, `validations/driverApplication.ts` → `driverApplications/{uid}`. An admin then has to create `drivers/{uid}` **manually in the Console**. There is no standalone driver sign-up. |
| 2 | Login | Done | Same login screen; `utils/roleRoutes.ts` sends `driver` to `/driver/home`. Approved passengers switch modes from Profile. |
| 3 | Driver Profile (view) | Done | `(driver)/driver/(tabs)/profile.tsx`, vehicle card on `driver/(tabs)/home.tsx` |
| 4 | Edit Profile | **Missing** | The driver profile is read-only. The rules also block it: `users` update requires `isPassenger()`, and `drivers` update only allows duty fields. |
| 5 | Document Submission | Done | `components/profile/DocumentImageField.tsx` (expo-image-picker) → Cloud Storage `driverApplications/{uid}/{orCr,ltoLicense}` (`firebase/storage.ts`, `storage.rules`) |
| 6 | Verification Status | Done | `DriverApplicationCard.tsx` (pending / approved / rejected + admin remarks), `hooks/useDriverAccess.ts`, status card on driver home |
| 7 | Booking Requests | Partial | `driver/(tabs)/requests/index.tsx` → `driverBookingService.subscribeToOpenBookings`. **Standard bookings only.** Drivers never see out-of-area requests with `status == 'searching'`. |
| 8 | View Booking Details | Done | `driver/(tabs)/requests/[bookingId].tsx` (no passenger name or contact, because rules block reading `users/{passengerId}`) |
| 9 | Accept Booking | Done (standard) | `driverBookingService.acceptBooking` (transaction, also sets `isAvailable:false`). `fareAgreementService.createProposal` exists for out-of-area but **no screen calls it**. |
| 10 | Decline Booking | Done (local) | `driverBookingService.declineBooking` hides the request in AsyncStorage on that device only. Nothing is recorded server-side. |
| 11 | Availability | Done | `driver/(tabs)/home.tsx` → `driverService.goOnline / goOffline / becomeAvailable` (writes `currentLocation` once when going online; no live tracking) |
| 12 | Ride Management (update status) | **Missing** | No arriving / start / complete actions, and no rule would allow them. |
| 13 | Payment Information | **Missing** | — |
| 14 | Trip History | **Missing** | Only active trips are shown (`contexts/DriverActivityContext.tsx`). There are no past trips. |
| 15 | Notifications | **Missing** | The driver area has no notifications tab (tabs: Home, Requests, Profile). |
| 16 | Logout | Done | `driver/(tabs)/profile.tsx` |

### Administrator

The code assumes a separate **Admin Website, not built yet**. The mobile app refuses admin sign-in (`authService.loginUser`). Today every admin action is a manual Firebase Console edit.

| # | Function | Status | Evidence / notes |
| --- | --- | --- | --- |
| 1 | Admin Login | Missing | Mobile app explicitly blocks `role == 'admin'` |
| 2 | Dashboard | Missing | — |
| 3 | User Management | Missing | Console only |
| 4 | Driver Management | Missing | Console only (`drivers/{uid}` has `create, delete: if false` for clients) |
| 5 | Driver Verification | Missing (manual) | An admin sets `driverApplications/{uid}.status = 'approved'` and creates `drivers/{uid}` with `isVerified: true` in the Console |
| 6 | Booking Management | Missing | — |
| 7 | Search Booking | Missing | — |
| 8 | Filter Booking | Missing | — |
| 9 | Tariff Management | Missing (data hook only) | The app reads `fareSettings/active` (`fareService.fetchFareConfig`), which can be edited in the Console. There is no admin UI. |
| 10 | Quota Management | Missing | No quota concept anywhere |
| 11 | Commission Management | Missing | No commission field or calculation anywhere |
| 12 | Payment Management | Missing | — |
| 13 | Out-of-Area Trip Management | Missing | Data exists in `outOfAreaRequests` / `bookings.bookingType`, but there is no admin view |
| 14 | Reports | Missing | — |
| 15 | System Monitoring | Missing | — |
| 16 | Notifications | Missing | — |
| 17 | Logout | Missing | — |

**Totals:** Passenger 12 Done · 4 Partial · 1 UI-only · 2 Missing (Book a Ride counted once as Done+Partial). Driver 8 Done · 3 Partial · 5 Missing. Admin 0 of 17.

---

## b. Firestore data model (as the code actually uses it)

All IDs are Firebase Auth UIDs unless noted. Timestamps come from `serverTimestamp()`.

### `users/{uid}`
Written by `authService.createPassengerProfile` and `updatePassengerProfile`.
`uid, fullName, email, mobileNumber, role ('passenger' | 'driver' | 'admin'), profileImage (string|null), createdAt, updatedAt`
- The client can only create `role: 'passenger'`. `driver` and `admin` roles are set in the Console.

### `drivers/{uid}` (created by an admin in the Console)
Read by `driverService`, `driverSearchService`, `AuthProvider`.
`fullName, profileImage, vehicleType ('tricycle'|'motorcycle'), vehiclePlate, rating (number), isVerified (bool), isOnline (bool), isAvailable (bool), currentLocation {latitude, longitude} | null, updatedAt`
- 1:1 with `users/{uid}`. The driver can only write `isOnline, isAvailable, currentLocation, updatedAt`.
- The admin **copies** vehicle data from `driverApplications/{uid}` by hand. Nothing links the two automatically.

### `driverApplications/{uid}`
`driverApplicationService.submitDriverApplication`.
`uid, firstName, middleName|null, lastName, fullName, email, mobileNumber, vehicleType, vehiclePlate, documents { orCr, ltoLicense: {storagePath, downloadUrl, fileName, contentType, uploadedAt} }, status ('pending'|'approved'|'rejected'), adminRemarks|null, submittedAt, updatedAt, reviewedAt|null`
- One application per user. The files live in **Cloud Storage** at `driverApplications/{uid}/{orCr|ltoLicense}`.

### `bookings/{autoId}`
`bookingService.buildBookingDocument`, driver accept in `driverBookingService`.
`passengerId → users, driverId → drivers | null, vehicleType, bookingType ('standard'|'out_of_area'), pickupLocation {latitude, longitude, address}, destination {…}, distanceKm, estimatedFare, driverProposedFare|null, agreedFare|null, fareAgreement|null, finalFare|null, status, outOfAreaRequestId → outOfAreaRequests | null, createdAt, updatedAt, acceptedAt, startedAt, completedAt, cancelledAt`
- `status` values in the type: `pending, accepted, arriving, in_progress, completed, cancelled, out_of_area_searching, driver_interested, fare_negotiation, awaiting_passenger_confirmation, confirmed`. **Only `pending`, `accepted` and `cancelled` are ever written.**
- No payment fields and no commission fields.

### `outOfAreaRequests/{autoId}`
`bookingService.createOutOfAreaRequest`, `fareAgreementService`.
`passengerId, pickupLocation, destination, vehicleType, distanceKm, standardEstimatedFare, suggestedAgreementFare|null, agreedFare|null, status ('searching'|'driver_interested'|'negotiating'|'accepted'|'rejected'|'expired'|'cancelled'), driverId|null, fareAgreement {standardEstimatedFare, driverProposedFare, agreedFare, agreedByPassenger, agreedByDriver, agreedAt}|null, createdAt, expiresAt, updatedAt`
- Once accepted, the passenger creates a matching `bookings` doc with `outOfAreaRequestId`. `expiresAt` is stored but nothing sets `status: 'expired'`.

### `notifications/{id}` (read-only in the app; nothing writes it)
`userId, bookingId|null, type (booking_created|driver_accepted|driver_arriving|ride_started|ride_completed|booking_cancelled), title, body, read, createdAt`

### `ratings/{id}` (rules and type only; `services/ratingService.ts` is an empty stub)
`bookingId, passengerId, driverId, rating (1–5), comment|null, createdAt`

### `fareSettings/active` (optional; edited in the Console)
`fares { tricycle {baseFare, perKm}, motorcycle {baseFare, perKm} }, outOfArea { enabled, maximumAdditionalPercentage, minimumFare, allowDriverNegotiation, requestExpiryMinutes, driverSearchRadiusKm }`
- In-code defaults: tricycle ₱15 + ₱8/km, motorcycle ₱10 + ₱6/km.

### Other storage
- **Realtime Database** is set up (`firebase/realtimeDatabase.ts`, `REALTIME_PATHS.driverLocation`) but **never used**.
- **AsyncStorage:** Firebase Auth persistence, plus each driver's declined-booking IDs.

```
users 1──1 drivers            (same uid; drivers created by admin)
users 1──0..1 driverApplications (same uid)
users 1──* bookings           (passengerId)      drivers 1──* bookings (driverId)
users 1──* outOfAreaRequests  (passengerId)      drivers 1──* outOfAreaRequests (driverId)
outOfAreaRequests 1──0..1 bookings (bookings.outOfAreaRequestId)
users 1──* notifications (userId)   bookings 1──* ratings (bookingId)
```

---

## c. Security check

**Do `firestore.rules` exist?** Yes (`firestore.rules`, ~390 lines), plus `storage.rules`. Both end with a default-deny catch-all. There is no `firebase.json`, so deployment is a manual Console paste, and the repo can drift from the live rules.

**Are roles enforced?**
- Passenger vs. driver: **yes**. Helpers are `isPassenger()`, `isDriver()` and `isVerifiedDriver()`, which do `get()` on `users` / `drivers` / `driverApplications`. Clients cannot create `drivers/*`, cannot change `role`, and cannot approve their own application.
- **Admin: no.** No rule mentions `admin`. Admin work currently goes through the Console, which bypasses rules. A future Admin Website that uses the client SDK will need an `isAdmin()` helper (ideally a custom claim) added to every collection.

**Can a driver accept bookings before being verified? No.** Every booking and out-of-area read/update path for drivers requires `isVerifiedDriver()` (`drivers/{uid}.isVerified == true`). Going online also requires `isVerified`. A passenger-turned-driver additionally needs `driverApplications/{uid}.status == 'approved'`. The UI gates the same way through `useDriverAccess().canPerformDriverActions`, and `(driver)/_layout.tsx` forces a driver offline if verification is revoked. ✅

**Are any secrets committed? No.** `.env` is gitignored and was never in git history. No service-account JSON, private keys or `AIza…` literals were found in tracked files. The Firebase web config comes from `EXPO_PUBLIC_*` env vars, which is fine. Note: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (read by `app.config.ts`) is **missing from both `.env` and `.env.example`**, so Android release builds will have no Maps key.

**Gaps found (not fixed):**
1. **Client-trusted fares.** `bookings` create only checks `estimatedFare is number` and `distanceKm is number`, with no `hasOnly` key list. A passenger can set any fare. They can also create an `out_of_area` booking with an invented `agreedFare` / `fareAgreement` that isn't checked against the matching `outOfAreaRequests` doc. They can add extra fields such as `finalFare` or `acceptedAt`.
2. **Out-of-area dead end.** After the passenger agrees, the booking is created with `driverId: null` and `bookingType: 'out_of_area'`. No rule lets the agreed driver claim it (the driver accept rule requires `bookingType == 'standard'`), and there's no code to claim it either.
3. **No driver status-transition rule** (accepted → arriving → in_progress → completed), so ride management can't be built without a rules change.
4. **`ratings` create** doesn't check that the booking exists, belongs to the passenger, is `completed`, or has that `driverId`. Anyone can post fake ratings for any driver. (The feature itself is still a stub.)
5. **Drivers can't read `users/{passengerId}`**, so drivers never see the passenger's name or phone number. This is a functional gap and needs a scoped rule.
6. **`drivers` readable by any signed-in user** when `isVerified`, including `currentLocation`. That's acceptable for search, but worth a privacy note.
7. **`notifications`** has no create path at all (by design, "server only"), but no server exists.
8. **`outOfAreaRequests` expiry** isn't enforced for passenger updates, and nothing marks requests `expired`.

---

## d. Mismatches with CLAUDE.md

| Area | Finding |
| --- | --- |
| Stack | ✅ Matches: Expo SDK 56, React Native 0.85, TypeScript (strict), expo-router, Firebase JS SDK v12 (Auth + Firestore). No MySQL, SQL, or custom server in the code. |
| Extra Firebase services | **Cloud Storage** (driver documents) isn't named in CLAUDE.md but is reasonable. **Realtime Database** is set up (`firebase/realtimeDatabase.ts`, `EXPO_PUBLIC_FIREBASE_DATABASE_URL`) but unused. Either use it for live driver location or remove it. |
| Cloud Functions | CLAUDE.md says "where needed". None exist, yet notifications, fare validation, expiry and admin claims all need a server. |
| Android and iOS | No Android-only code. `Platform.OS` is used only for keyboard and styling. **iOS gaps:** `app.config.ts` has **no `ios.bundleIdentifier`**, which EAS iOS builds require. Maps are Google on Android and Apple on iOS (`PROVIDER_DEFAULT`), so the maps look different on each platform. |
| Naming | `android.package` is `com.trigo.passenger`, but this one app serves both passengers and drivers. |
| MySQL / web server | None in code. **The SPMP itself** still has old wording: Table 3.0 says "Develops the **Android** mobile application" and "**MySQL** database", §4.3 mentions a "centralized database server… **web server**", and §3.2 of Table 6.0 says "Table and Relationship Design". Those are doc fixes, not code fixes. |
| Repo hygiene | `CLAUDE.md` and `AGENTS.md` are deleted in the working tree. CLAUDE.md points to `docs/SPMP.md` and `docs/SRS.md`, which don't exist (they're only in `files.zip`). All driver-side work (`src/app/(driver)/`, `driverService`, `driverBookingService`, `storage.rules`, …) is **uncommitted and untracked**. |
| Working rule: "Update STATUS.md" | STATUS.md didn't exist until this audit. |

---

## e. Open decisions the code already answers

| # | Open decision | Assumed in code? | Evidence |
| --- | --- | --- | --- |
| 1 | What "quota" means | **No.** Nothing implemented. | The closest thing is "one active trip per driver" (`acceptBooking` sets `isAvailable:false`), which is not a quota. |
| 2 | GCash method | **No.** No payment code at all. | — |
| 3 | Admin platform | **Yes: separate Admin Website.** | `authService.loginUser` rejects admins with "Please use the TriGo Admin Website". `types.MobileUserRole`, comments in `firestore.rules` and `storage.rules`. (The saved project memory says this was confirmed in an earlier session, but CLAUDE.md still lists it as open. Update CLAUDE.md.) |
| 4 | Map / location provider | **Yes.** | `react-native-maps` with `PROVIDER_DEFAULT` (Google Maps on Android via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, Apple Maps on iOS). **expo-location** device geocoding for search and reverse geocoding. Straight-line haversine distance for fares (`utils/distance.ts`). No Places or Directions API. |
| 5 | Rating / Earnings / Fleet | **Partly (rating).** | `drivers.rating` is shown to passengers and drivers. The `ratings` collection has rules and a type, and `ratingService.ts` says "implemented in Phase 6". Earnings and Vehicle Fleet: nothing. |
| other | Tariff values and out-of-area rules | **Yes, placeholders.** | ₱15+₱8/km and ₱10+₱6/km in `constants/index.ts`. Out-of-area: 30-minute expiry, 15 km search radius, no cap on the driver's markup (`constants/outOfAreaFareSettings.ts`). Commission is **not** applied to out-of-area trips, although the SRS says it still applies. |
| other | Driver onboarding path | **Yes.** | Drivers apply from a passenger account, and an admin creates `drivers/{uid}`. The SRS describes a "Driver Registration" screen of its own. |

---

## f. Progress against the SPMP work plan (Table 5.0)

Today is **2026-09-25**. Per the SPMP, Development Phase I **starts 2026-10-05**, so the code is ahead of the calendar but uneven.

| Task | Planned | Code state |
| --- | --- | --- |
| 1.1 Requirements Gathering | Aug 10–21 | ✅ Done (SRS/SPMP exist) |
| 1.2 System Analysis | Oct 5–9 | Not a code deliverable. Nothing in the repo. |
| 1.3 Database Design | Oct 12–16 | 🟡 De facto done in code (§b), but there's no design document and no ERD. The SPMP still says "tables". |
| 1.4 UI Design | Oct 19–23 | 🟡 Passenger and driver screens built. No admin UI. |
| 1.5 User Registration Module | Oct 26–30 | 🟡 Create, read, update and login are done. **Delete/deactivate account is missing.** |
| 1.6 Driver Registration Module | Nov 2–13 | 🟡 Create (application + documents), read and status are done. **Update driver info, delete/deactivate, and in-app verification (admin) are missing.** Verification is Console-only. |
| 1.7 Software Testing | Nov 16–27 | ❌ No test framework or tests |
| 2.1 Ride Booking Module | Nov 30–Dec 4 | 🟡 Create, read and cancel are done. Update status only reaches `accepted`. |
| 2.2 Booking Management | Dec 7–11 | 🟡 Accept/reject (standard) done. Status updates missing. Out-of-area driver side missing. |
| 2.3 Driver Availability | Dec 14–18 | ✅ Online / offline / available done |
| 2.4 Notifications | Dec 21–25 | 🔴 Read and mark-read UI only. Create and delete are missing. |
| 2.5 Reports Module | Dec 28–Jan 8 | ❌ Missing (depends on the Admin Website) |
| 2.6 – 3.3 | Jan–Apr 2027 | Not started (as expected) |

**Summary:** Iteration 1 mobile work is roughly 70% done, and Iteration 2 has been started early (booking, availability). The biggest schedule risk is that **nothing admin-side exists**, yet 1.6 (driver verification) and 2.5 (reports) plus all tariff, quota and commission work depend on it. Commission and payment also aren't in any iteration of Table 5.0 even though the SRS makes them hard constraints.

---

## g. Top 5 recommended next tasks

1. **Secure the baseline: commit the current work and restore the project docs.** All driver-side code, `storage.rules` and the rules changes are uncommitted or untracked. Move `CLAUDE.md`, `SRS.md` and `SPMP.md` out of `files.zip` into the repo (`CLAUDE.md` at the root, the others in `docs/`), and mark open decisions #3 and #4 as answered. *Reason:* one bad checkout loses weeks of work, and every future session reads CLAUDE.md, which currently points at files that don't exist.

2. **Driver ride lifecycle: arriving → in_progress → completed, plus driver trip history.** This needs a new `bookings` update rule for the assigned verified driver (status transitions with `startedAt`, `completedAt`, `finalFare`), driver buttons on `requests/[bookingId].tsx`, returning the driver to available when the trip completes, and a scoped rule so drivers can read the passenger's name and phone. *Reason:* the core loop currently stops at `accepted`. Nothing ever completes, which blocks ride status, ride and trip history, payment info, ratings and reports.

3. **Finish the out-of-area driver side.** Drivers need to see `searching` requests and propose a fare (wire up the existing `createProposal`), and the agreed driver needs to be able to claim the resulting `out_of_area` booking. This needs rules for both steps, plus server-side checks that the booking fare matches the agreement. *Reason:* the feature is the project's distinctive scope item (SRS hard constraint), but today it dead-ends after the passenger accepts, and the fare can be forged.

4. **Payment method and payment record (Cash / GCash).** First **decide open decision #2**. Record-only (`paymentMethod`, `paymentStatus`, optional GCash reference number) is the smallest step that satisfies the SRS. Also decide how commission is stored per trip. *Reason:* Cash/GCash is an SRS hard constraint with zero implementation, and it shapes the booking data (payment and commission fields) that reports and the admin site will read.

5. **Rules hardening and admin groundwork.** Add `hasOnly` key lists on `bookings` and `outOfAreaRequests` creates, validate ratings against a completed booking, and add an `isAdmin()` helper (custom claim) and a `firebase.json` so rules deploy from the repo. Then pick a notifications approach, either Cloud Functions or narrowly scoped client writes. *Reason:* the Admin Website and notifications both need this foundation, and fixing data-shape rules now is cheaper than migrating live data later. It also addresses SRS §3.5.3 (security).

_Also noted but lower priority: the Expo SDK 57 upgrade (expo-doctor Hermes warning), `ios.bundleIdentifier`, adding `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env.example`, removing the unused Realtime Database setup, and setting up a test runner before the 1.7 testing milestone._
