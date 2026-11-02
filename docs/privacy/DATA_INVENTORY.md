# TriGo — Personal Data Inventory

_Prepared 2026-11-02 from the code (mobile app `src/`, admin website `admin/`, `firestore.rules`).
Status: **pending school DPO review**. It describes what the code does today, before the privacy
notice, consent and account-deletion work is built._

Placeholders to fill in are marked **⟦TO FILL: …⟧**.

## 1. Who is involved

| Role | Who | Notes |
|---|---|---|
| Controller | TriGo Management (capstone project team) | Privacy contact: see `shared/legal` (added in step 2 of the privacy plan). |
| Data subjects | Passengers, drivers, driver applicants, admins | Admins are team members using the admin website. |
| Processors / third parties | Google (Firebase), HeiGIT (OpenRouteService), OpenFreeMap, the phone's OS map services | See section 5. |
| Minimum age | ⟦TO FILL: minimum age for passengers and drivers⟧ | The app does not ask for a date of birth today. |
| Where Firestore data is stored | ⟦TO FILL: Firestore location / region (Firebase Console → Firestore → Settings)⟧ | Firebase project `trigo-2eaf6`. |

## 2. Data stored in the cloud (Firebase)

"Admins" means signed-in accounts with the `admin` custom claim. Every write is checked by
`firestore.rules`; there are no Cloud Functions, so all writes come from the app or the admin
website.

### 2.1 Accounts and profiles

| Where | Personal data | Purpose | Who can read | Written by |
|---|---|---|---|---|
| Firebase Authentication | Email, password (hashed by Firebase), account creation and sign-in times kept by Firebase | Sign-in | Firebase; the project owners in the Firebase Console | The user at registration; admins are created by the team |
| `users/{uid}` | `fullName`, `email`, `mobileNumber`, `role`, `profileImage` (always empty today), `createdAt`, `updatedAt` | Profile, contact details | The user; admins | The user (passengers can edit name and mobile; email and role are fixed) |
| `contacts/{uid}` | `fullName`, `mobileNumber` (a copy of the profile) | Lets the passenger and the assigned driver call each other | The user; the other party of an **active** trip only (accepted, arrived, in progress) | The user, kept equal to `users/{uid}` |

### 2.2 Drivers

| Where | Personal data | Purpose | Who can read | Written by |
|---|---|---|---|---|
| `driverApplications/{uid}` | `firstName`, `middleName`, `lastName`, `fullName`, `email`, `mobileNumber`, vehicle type, plate, brand, model, color, `documents` (OR/CR and driver's licence image references), `status`, `adminRemarks`, submitted/updated/reviewed times | Driver verification | The applicant; admins | The applicant (submit, resubmit); admins (approve/reject with remarks) |
| Cloud Storage `driverApplications/{uid}/…` | OR/CR and LTO licence images | Driver verification | — | **Not in use:** Storage needs the Blaze plan, so uploads do not work in production yet |
| `drivers/{uid}` | `fullName`, `vehiclePlate`, `vehicleType`, `vehicleBrand`, `vehicleModel`, `vehicleColor`, `rating`, `isOnline`, `isAvailable`, `isVerified`, `currentLocation` (latitude/longitude), current booking/request links, daily acceptance count (`acceptedCount`, `acceptedDay`), `verificationNote` (admin's private revoke reason), `verificationUpdatedAt`, `verificationUpdatedBy` (admin uid) | Matching drivers to rides, showing the passenger who is coming, the daily quota | The driver; admins; **any signed-in user while the driver is verified** (passengers see name, plate and vehicle once assigned; the out-of-area search reads nearby online drivers) | Admins create it on approval; the driver updates duty status, location and trip links; admins revoke/restore and edit the vehicle |

### 2.3 Trips

| Where | Personal data | Purpose | Who can read | Written by |
|---|---|---|---|---|
| `bookings/{id}` | `passengerId`, `driverId`, pickup and destination (coordinates and address text), barangay IDs, distance, fares, payment method (cash/GCash), status times (created, accepted, arrived, started, completed, cancelled), who cancelled and the cancellation reason | Running and recording trips; fares and commission | The passenger; the assigned driver (also after the trip, as trip history); verified drivers see **open** standard bookings (addresses and fare, not the passenger's name); admins | Passenger creates and cancels; driver accepts and moves the trip forward |
| `outOfAreaRequests/{id}` | Same kind of trip data as bookings, plus the driver who accepted and the fare agreement | Out-of-area trips | The passenger; verified drivers of the same vehicle type while it is searching; the driver handling it; admins | Passenger and driver |
| `ratings/{id}` | `passengerId`, `driverId`, `bookingId`, rating 1–5, optional `comment` | Driver rating (display only; no rating screen writes these today) | The passenger who wrote it | Passenger |
| `notifications/{id}` | `userId`, `bookingId`, title, body, read flag | In-app Notifications screen | The user it belongs to | Nothing creates them today (no client may) |
| `complaints/{bookingId_uid}` | `reporterId`, `reporterRole`, `bookingId`, `category` (including safety), free-text `message`, `status`, `adminNotes`, `updatedBy` (admin uid), times | Handling complaints | The reporter (their own); admins | Reporter creates; admins review |

### 2.4 Commission and money records

TriGo moves no money. These records hold amounts and references, linked to the driver by uid.

| Where | Personal data | Purpose | Who can read | Written by |
|---|---|---|---|---|
| `commissions/{bookingId}` | `driverId`, booking ID, fare, percentage, commission amount, time | Commission per completed trip | The driver; admins | The driver's app, in the trip-completion commit |
| `commissionAccounts/{uid}`, `commissionPeriods/{id}` | Driver's running totals, periods, unpaid pointer | Balances, due dates, suspension | The driver; admins | The driver's app; admin confirmations |
| `commissionPayments/{id}` | `driverId`, amount, **GCash reference number**, status, rejection reason, reviewer (admin uid), times | Driver-reported commission payments | The driver (own); admins | Driver submits; admin confirms or rejects |
| `paymentReferences/{reference}` | Document ID **is the GCash reference number**, `driverId`, payment ID | Prevents reusing a reference | Admins; the driver for their own reference | Driver (with the payment); freed by admin rejection |
| `cashOuts/{id}` | Amount, method (GCash/Maya/bank), reference, date, note, `createdBy` (admin uid) | Record of TriGo's own cash-outs (not about passengers or drivers) | Admins | Admins |
| `earningsLedger/totals` | Totals only, last payment ID | Bookkeeping | Admins | Admin confirmations and cash-outs |

### 2.5 Settings (no personal data about app users)

`fareSettings/active`, `barangayTariffs/*`, `commissionSettings/active`, `quotaSettings/active`
hold settings plus `updatedBy` (an admin uid). `paymentSettings/active` holds **TriGo's own**
GCash name and number (readable by admins and drivers). `supportContacts/*` holds the support
phone numbers TriGo publishes (not app users' data).

## 3. Data kept on the phone

| What | Where | Purpose |
|---|---|---|
| Firebase sign-in session (tokens) | AsyncStorage (Firebase Auth persistence) | Stay signed in |
| `trigo.driver.{uid}.declinedBookings` | AsyncStorage | Standard requests the driver declined (IDs only), so they stay hidden on this phone |
| `trigo.driver.{uid}.hiddenRequests` | AsyncStorage | Out-of-area requests hidden after the passenger chose another driver (IDs only) |
| `trigo.driver.{uid}.notificationPromptSeen` | AsyncStorage | The notification explanation was shown once |
| Ride request notifications | The phone's notification shade | Show fare, pickup → destination place names and distance to pickup while the driver app is in the background |

Nothing is logged to a server: `logFirebaseError` writes to the developer console in development
builds only. There is no analytics or crash-reporting SDK.

## 4. Phone permissions

| Permission | Used for | Notes |
|---|---|---|
| Location (while in use; fine and coarse) | Passengers: the pickup point on the map. Drivers: the location written to `drivers/{uid}.currentLocation` **when going online** | No background location; the app never asks for it. The driver's position is not updated continuously. |
| Notifications (Android 13+) | Local ride-request notifications for drivers | Asked once with an explanation; no push token is created or sent anywhere. |
| Vibrate | New-request alert for drivers | |
| Camera / photos | Profile photo and driver documents (image picker) | Declared in the build, but the uploads need Firebase Storage (Blaze), which is not enabled. |
| Phone dialer | "Call" buttons (driver ↔ passenger during a trip; support contacts) | Opens the phone's dialer; TriGo does not place or record calls. |

## 5. Third parties and what they receive

| Service | Receives | When |
|---|---|---|
| Google Firebase (Authentication, Cloud Firestore, Hosting for the admin website) | Everything in section 2; IP addresses and device/browser details in request logs kept by Google | Always |
| OpenRouteService (HeiGIT, Germany; free public API, client-side key) | Pickup/destination **coordinates** (routing, reverse geocoding) and **typed place-search text** | When a passenger sets a pickup or destination and gets a fare |
| OpenFreeMap (map tiles) | The phone's IP address and the map area being viewed | When a map is shown |
| The phone's OS geocoder (Google on Android, Apple on iOS) | Coordinates or search text | Fallback when OpenRouteService fails |
| GCash (outside TriGo) | Nothing from TriGo; drivers pay in the GCash app and type the reference into TriGo | — |

## 6. Retention today

Nothing is deleted automatically (no Cloud Functions). Expired bookings and requests stay in
Firestore and are only shown as expired. Records stay until an admin removes them in the Firebase
Console. Proposed retention periods are for the DPO to decide:

| Data | Proposed retention | Status |
|---|---|---|
| Accounts and profiles | Until account deletion (anonymized) | ⟦TO FILL: confirm with the DPO⟧ |
| Trips, commission and payment records | Kept without names after deletion, for financial records | ⟦TO FILL: retention period⟧ |
| Driver applications | ⟦TO FILL: retention period after approval or rejection⟧ | |
| Complaints | ⟦TO FILL: retention period⟧ | |

## 7. Findings to note in the privacy notice or to fix

1. **A driver's last location stays readable after going offline.** `goOffline` does not clear
   `currentLocation`, and any signed-in user can read a verified driver's record, so the last
   location from going online stays visible until the next time the driver goes online.
2. **Verified driver records are readable by every signed-in user**, including the admin uid in
   `verificationUpdatedBy` and the daily count. Passengers only need name, plate, vehicle and
   (during matching) location.
3. **Ride request notifications are public on the lock screen** (channel visibility PUBLIC):
   fare, place names and distance show without unlocking.
4. **Camera and photo permissions are declared** although uploads do not work until Storage is
   enabled.
5. **Open standard bookings show pickup and destination addresses to all verified drivers** of
   that vehicle type (needed to choose a ride; the passenger's name and number are not shown).
6. **No date of birth or age check** (see the minimum-age placeholder).
7. **No way yet to request deletion or see what was agreed to.** Planned in the privacy steps
   (consent, re-consent, deletion requests, anonymization).

These are recorded only; the privacy plan does not change them unless you decide to.
