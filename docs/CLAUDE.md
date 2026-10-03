# TriGo — Project Context for Claude Code

TriGo: Transport Booking and Management Mobile Application for Trinidad, Bohol.
Capstone project. Connects passengers with registered, admin-verified tricycle and
motorcycle drivers. Primary service area: Trinidad, Bohol (out-of-area trips allowed
when a driver accepts; fare agreed between passenger and driver, commission still applies).

Source documents (read these before planning any feature):
- docs/SPMP.md — schedule, work plan, roles
- docs/SRS.md — product functions, constraints, prototypes list

## Tech stack (fixed — do not substitute)
- React Native + Expo, TypeScript (JavaScript only where unavoidable)
- Firebase Authentication, Cloud Firestore, Cloud Functions where needed
- Target: Android AND iOS
- Git + GitHub
- NO MySQL, NO custom web server. Firestore is NoSQL: collections/documents, not tables.

## Roles
- Passenger: register/login, profile, book ride (pickup, destination), view fare,
  choose Cash or GCash, confirm/cancel booking, booking & ride status, payment info,
  ride history, notifications.
- Driver: register with personal + vehicle info, upload verification documents,
  view verification status, availability toggle, receive/accept/decline requests,
  manage active ride status, payment info, trip history, notifications.
  Driver CANNOT accept bookings until an admin verifies them.
- Admin: login, dashboard, user & driver management, driver verification,
  booking management (search/filter), tariff, quota, commission management,
  payment monitoring, out-of-area trip monitoring, reports, system monitoring.

## Open decisions — DO NOT guess; ask me before implementing anything that depends on these
1. What "quota" means (e.g., trips per driver per day? drivers per area?).
2. GCash method: payment gateway (e.g., PayMongo/Xendit), manual reference-number
   recording, or record-only.
3. Admin platform: inside the mobile app (role-based screens) or a separate web app.
4. Map/location provider.
5. Driver Rating, Earnings, Vehicle Fleet appear in prototypes but not in SRS scope.

## Working rules
- Plan first: before writing code for a feature, show me the plan (files to touch,
  Firestore collections/fields affected, security-rule changes) and wait for approval.
- Never change an existing Firestore data shape without telling me what breaks.
- Every new collection or field needs matching firestore.rules protection
  (role-based: passenger / driver / admin).
- Never commit secrets or service-account keys. Firebase web config is fine in env/config.
- Keep changes small and focused; one feature per session; suggest a commit message
  at the end.
- After changes, run `npx tsc --noEmit` and fix type errors you introduced.
- Update STATUS.md when a feature's status changes.
