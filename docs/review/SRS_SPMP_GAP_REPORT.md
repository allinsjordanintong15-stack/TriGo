# SRS and SPMP Gap Report

Prepared 2026-11-15 on branch `docs/final-srs-spmp`. Compares `docs/SRS.md` and `docs/SPMP.md`
(originals archived in `docs/archive/*_original_2026-11-15.md`) with the system as built.

Sources of truth: the app code (`src/`), the Administrator website (`admin/`), `firestore.rules`,
`package.json`, `app.config.ts`, `firebase.json`, `docs/DECISIONS.md`, `docs/STATUS.md`,
`docs/privacy/`, `shared/legal/`, and the Git history.

Status key:

- **MATCHES**: the document is correct; kept as written.
- **CHANGED**: the system works differently; the text was rewritten to match.
- **PENDING**: planned or partly built but not working in the current deployment; described as a limitation or future work.
- **ADDED**: built but not in the document; added in the document's style.

## SRS

| Section | Document said | Actual | Status | Edit made |
|---|---|---|---|---|
| Front matter | No version or revision history | — | ADDED | Version 2.0 and a Revision History table added. |
| 1.1 Project Summary | "A proposed mobile application" with notifications, Cash and GCash payment options | Built; booking status is live on screen; an in-app inbox holds messages from TriGo; the payment method is recorded, not processed | CHANGED | Reworded: real-time status, fixed fare, recorded payment method, inbox. |
| 1.1 Project Summary | Administration "through the supported application environment"; tariffs, quotas, commissions | Separate Administrator website (React + Vite, Firebase Hosting); fares, barangay tariffs, daily quota, commission, complaints, warnings | CHANGED | Names the Administrator website and the real settings. |
| 1.1 / 2.1 Out-of-area | Passenger and driver "may agree on the applicable fare" | Out-of-area fare is the Administrator's per-km fare and is FINAL; no negotiation (DECISIONS 2026-10-11) | CHANGED | Rewritten everywhere (Summary, Perspective, Constraints, Hard Constraints). |
| 1.2 Definitions | Firebase "authentication, database, and cloud functions" | Authentication, Cloud Firestore, Hosting; no Cloud Functions | CHANGED | Definition corrected; 13 terms added (Firestore, Security Rules, Spark/Blaze, MapLibre, OpenFreeMap, ORS, out-of-area request, barangay tariff, per-km fare, commission, daily quota, RA 10173). |
| 1.3 References | Six references | RA 10173, ORS, MapLibre, OpenFreeMap, HDX boundary data are used | ADDED | References [7]–[11] added (HDX URL to confirm). |
| 2.1 Product Perspective | React Native + Expo; Firebase "and other applicable Firebase services" | React Native 0.85 / Expo 56; admin React 19 / Vite 8; Firebase Auth, Firestore, Hosting; Spark plan, no Cloud Functions or Storage; all writes checked by Security Rules | CHANGED | Paragraph rewritten with the actual stack and plan. |
| 2.1 Product Perspective | Map/location provider not named (open decision #4) | MapLibre + OpenFreeMap tiles; OpenRouteService routing and place search; PSA/NAMRIA barangay boundaries | ADDED | New paragraph. |
| 2.1 Product Perspective | Separate driver registration implied | One app for passengers and drivers; an approved applicant switches to driver mode | CHANGED | Stated. |
| 2.2 Passenger: Register | Create an account | Also requires agreeing to the Privacy Notice and Terms | CHANGED | Added consent. |
| 2.2 Passenger: Forgot Password | — | Password reset by e-mail | ADDED | New bullet. |
| 2.2 Passenger: View Available Drivers | View available drivers | Standard bookings go to all available drivers; only out-of-area requests show a driver to confirm or change | CHANGED | Rewritten. |
| 2.2 Passenger: Fare Information | "Applicable or estimated fare" | Fixed fare with fare basis line; "Fare", not "Estimated fare" | CHANGED | Rewritten. |
| 2.2 Passenger: Payment Method | Passenger selects Cash or GCash | Driver records Cash or GCash at completion; passenger sees it | CHANGED | Rewritten. |
| 2.2 Passenger: Cancel Booking | Cancel "when permitted" | Pending: any time; after acceptance only if the driver has not arrived within 15 min; never after arrival | CHANGED | Rule stated. |
| 2.2 Passenger: Ride Status | Monitor active ride | Also driver's vehicle and contact number during the active trip only | CHANGED | Added. |
| 2.2 Passenger: Notifications | Booking updates and ride notifications | In-app inbox of messages from TriGo (warnings) with unread count; booking updates live on the status screen, no push | CHANGED | Rewritten; see Known Limitations. |
| 2.2 Passenger: Rate Driver, Report a Problem, Privacy and Account Deletion, Help and Support | — | Built | ADDED | Four bullets. |
| 2.2 Driver: Register / Document Submission | Submit personal, vehicle info and documents | Form built (incl. brand, model, color); photo upload needs Firebase Storage (Blaze) | PENDING | Bullets kept; limitation in 2.6. |
| 2.2 Driver: Edit Profile | Drivers update their profile | Driver details are managed by the Administrator | CHANGED | Rewritten. |
| 2.2 Driver: Availability | Available/unavailable | Online/offline and available/unavailable | CHANGED | Reworded. |
| 2.2 Driver: Ride Management | Update status | Arrived, in progress, completed; driver may cancel before the ride starts | CHANGED | Detail added. |
| 2.2 Driver: Payment Information | View payment info | Records payment method and final fare | CHANGED | Reworded. |
| 2.2 Driver: Notifications | Booking requests and ride updates | Vibration and local notifications while the app runs; inbox for warnings | CHANGED | Rewritten; limitation in 2.6. |
| 2.2 Driver: Earnings and Commission, Daily Quota, Report a Problem | — | Built | ADDED | Three bullets. |
| 2.2 Admin: Admin Login | Securely access | `admin` custom claim only | MATCHES | Kept (detail added in 2.3 and 3.5.3). |
| 2.2 Admin: Dashboard | Overview | Attention cards, live stats, charts, recent activity | MATCHES | Detail added. |
| 2.2 Admin: User Management | View and manage accounts | View and search passengers; no passenger suspension | CHANGED | Rewritten; suspension under 2.6. |
| 2.2 Admin: Driver Management | View and manage | Search, revoke/restore with reason, edit vehicle | MATCHES | Detail added. |
| 2.2 Admin: Driver Verification | Approve/reject | Approve/reject with remarks | MATCHES | Kept. |
| 2.2 Admin: Booking Management | View and manage bookings | Read-only, in passenger/driver histories, Dashboard, complaints | CHANGED | Rewritten (admins cannot edit bookings). |
| 2.2 Admin: Search Booking / Filter Booking | Search and filter bookings | No booking search/filter page; passenger and driver search; out-of-area date filter | PENDING | Described honestly; listed in 2.6. |
| 2.2 Admin: Tariff Management | Tariff rates and pricing rules | Per-km base fare + rate per vehicle; barangay tariffs per barangay and vehicle | CHANGED | Rewritten. |
| 2.2 Admin: Quota Management | "Quotas or operational limits" (undefined) | Daily acceptance limit 1–100, default 20, Manila day | CHANGED | Rewritten. |
| 2.2 Admin: Commission Management | Commission rates | Percentage, payment period, grace period | CHANGED | Rewritten. |
| 2.2 Admin: Payment Management | Cash and GCash transactions | GCash commission payments confirm/reject, cash-outs, balances, CSV; passenger fares are not processed | CHANGED | Rewritten. |
| 2.2 Admin: Out-of-Area Trip Management | Monitor trips | Monitor with date filter and timeline; on/off switch | MATCHES | Detail added. |
| 2.2 Admin: Complaint Management, Account Deletion | — | Built | ADDED | Two bullets. |
| 2.2 Admin: Reports | Booking, trip, payment, transaction reports | Trips and fares over a date range, charts, CSV; earnings CSVs on Earnings | CHANGED | Reworded. |
| 2.2 Admin: Notifications | View system notifications | Dashboard attention cards and sidebar counts | CHANGED | Rewritten. |
| 2.3 User Characteristics | No age requirement | Minimum age 18; drivers hold a valid license (Privacy Notice) | ADDED | Added; admin access via custom claim. |
| 2.4 Constraints | No road-route rule | A fare needs an ORS road route; no straight-line fares | ADDED | New bullet. |
| 2.4 Constraints: Payment / GCash | GCash "integration implemented" | No gateway; TriGo records only; commission GCash verified by admin | CHANGED | Rewritten. |
| 2.4 Constraints | — | Spark plan: no Cloud Functions/Storage | ADDED | New bullet. |
| 2.4.1 Hard Constraints | — | All Firestore access checked by Security Rules; RA 10173 compliance | ADDED | Two bullets. |
| 2.4.1 / 2.4.2 Tariff, Quota | Generic | Per-km + tariffs; daily limit | CHANGED | Reworded. |
| 2.4.2 Easy Payment Selection | Passenger selects payment | Driver records payment method | CHANGED | Reworded. |
| 2.4.2 Accessibility | — | Darker text, ~48 dp touch targets (2026-11-01) | ADDED | New bullet. |
| 2.5 Assumptions | Mapping services unnamed; GCash integration | ORS (free limits), OpenFreeMap; GCash verified by admin | CHANGED | Reworded. |
| 2.6 Known Limitations | — | Storage, push, passenger booking alerts, driver online status, server-side checks, manual GCash, place-search coverage, booking search, passenger suspension, manual Auth deletion, Vehicle Fleet, announcements | ADDED / PENDING | New section. |
| 3.1.1 Hardware Interfaces | Specs listed | Not verifiable from the repo | MATCHES (unverified) | Kept; admin browser added; listed under "Needs AJ to confirm". |
| 3.1.2 Software Interfaces | React Native + Expo, Firestore, Firebase, VS Code, Draw.io | Actual versions; Vite admin; MapLibre/OpenFreeMap; ORS; Expo Location/Notifications/Image Picker; emulator tests; Git/GitHub | CHANGED | Versions and run-time interfaces added. |
| 3.2.1 Use Cases | Figures 1–9 | Figures not in the Markdown copy | MATCHES | Kept unchanged. |
| 3.2.2 Prototype: Earnings (Fig. 18) | Earnings dashboard | Earnings tab shows fares collected and commission owed | CHANGED | Note added. |
| 3.2.2 Prototype: Driver Rating (Fig. 19) | Rating view | Built 2026-11-08 | MATCHES | Kept. |
| 3.2.2 Prototype: Vehicle Fleet (Fig. 24) | Vehicle fleet | Not built; one vehicle per driver | PENDING | Note added; listed in 2.6. |
| 3.2.3 Implemented Functional Requirements | — (only figures) | Fare, search, expiry/cancel, out-of-area, active trip, alerts, commission, quota, rating, complaints/warnings/inbox, privacy/deletion, admin website | ADDED | New section 3.2.3.1–3.2.3.12 ("The system shall…"). |
| 3.3.1 Execution Time | "Reasonable time" | Tariff fallback ~5 s; place search 8 s timeout | CHANGED | Concrete limits added (no invented response times). |
| 3.3.2 Efficiency | Generic | ORS quota guards; aggregate reports | CHANGED | Added. |
| 3.4.1 Software Language | TypeScript and JavaScript | TypeScript (JS only where unavoidable); admin React + Vite | CHANGED | Reworded. |
| 3.4.2 GUI | Eight bullets | True | MATCHES | Kept. |
| 3.5.1 Reliability | Six bullets | True; related records written in one commit | MATCHES + ADDED | One bullet added. |
| 3.5.2 Availability | Notifications need internet | In-app messages and alerts | CHANGED | Reworded. |
| 3.5.3 Security | Generic | Auth, admin claim, Security Rules per role, contact sharing only during trip, rules tests, RA 10173 | CHANGED | Concrete measures added. |
| 3.5.4 Maintainability | Generic | Decisions log, unit tests | MATCHES + ADDED | Sentence added. |
| 3.5.5 Portability | Android and iOS | Designed for both; iOS background alerts limited | MATCHES | Kept (limitation in 2.6). |
| 3.6 Data Requirements | — (task requested data section) | 25+ Firestore collections | ADDED | New section and Table 2.0. |

## SPMP

| Section | Document said | Actual | Status | Edit made |
|---|---|---|---|---|
| Front matter | No version or revision history | — | ADDED | Version 2.0, Revision History; Tables 1.1 and 9.0 in the list. |
| 1 Overview / 1.1 Summary | Cash and GCash "payment options"; Firebase "and other applicable services"; Administrator "platform" | Payment recorded; Firebase Auth, Firestore, Hosting; Administrator website | CHANGED | Reworded. |
| 1 Overview / Summary / Scope / Constraints | Out-of-area fare agreed between passenger and driver | Per-km fare, final | CHANGED | Rewritten in all places. |
| 1.1.1 Scope: Passenger | View available drivers; select payment | Out-of-area driver confirm/change; payment method shown | CHANGED | Reworded; rating, report, deletion added. |
| 1.1.1 Scope: Driver | Register and manage profiles | View profile (admin-managed); commission payment | CHANGED | Reworded; GCash commission added. |
| 1.1.1 Scope: Admin | Tariffs, quotas, commission | Per-km + barangay tariffs, daily quota; complaints, warnings, deletion | CHANGED / ADDED | Reworded; bullet added. |
| 1.1.1 Payment | GCash implementation "will depend" | No gateway; commission GCash verified by admin | CHANGED | Rewritten. |
| 1.1.1 Objectives | Quota "operational limits or allocations" | Daily acceptance limit | CHANGED | Reworded; RA 10173 objective added. |
| 1.1.2 Technologies: Back-end | Cloud Functions where applicable | Not used (Spark plan) | CHANGED | Stated. |
| 1.1.2 Technologies | — | Admin website React + Vite on Hosting; MapLibre/OpenFreeMap/ORS | ADDED | Two bullets. |
| 1.1.2 Architecture: Logic layer | Firebase services and Cloud Functions | Client logic + Cloud Firestore Security Rules | CHANGED | Rewritten; "no custom server" added. |
| 1.1.2 Assumptions: GCash | Passenger's GCash through system functionality | Paid outside the app; drivers report commission references | CHANGED | Rewritten. |
| 1.1.2 Constraints | — | Spark plan limits; road route needed | ADDED | New bullet / sentence. |
| 1.1.3 Deliverables | Admin Management System | Administrator website; Privacy Notice and Terms 1.0 | CHANGED / ADDED | Named; one item added. SDD, STD, User Manual etc. kept (not verified as done). |
| 1.1.4 Schedule (Table 1.0) | Planned milestones | Planned dates are the plan | MATCHES | Kept unchanged. |
| 1.1.5 Actual Schedule | — | Git history Aug 12 – Nov 15, 2026 | ADDED | New Table 1.1 and differences. |
| 1.2 Evolution of Plan | Changes approved by PM | Decisions log in repo | MATCHES + ADDED | Sentence added. |
| 1.3 Definitions | Firebase incl. cloud functions | Auth, Firestore, Hosting | CHANGED | Corrected; 6 terms added. |
| 1.4 References | 16 references | RA 10173, Expo, ORS used | ADDED | [17]–[19] added. |
| 2.1 / 2.2 Organization, figures | Stakeholders, internal structure | Not verifiable from repo | MATCHES (unverified) | Kept. |
| 2.3 Roles: Mobile Developer | "Android mobile application" | Android and iOS | CHANGED | Corrected. |
| 2.3 Roles: Backend Developer | APIs, server-side | No custom API/server; Firestore model, Security Rules, admin website | CHANGED | Rewritten. |
| 2.3 Roles: Database Administrator | MySQL database | Cloud Firestore | CHANGED | Corrected. |
| 3.1.1 Estimation Plan | Three Agile iterations | Plan | MATCHES | Kept. |
| 3.1.2 Staffing Plan | Names and positions | Not verifiable from repo | MATCHES (unverified) | Kept unchanged. |
| 3.1.3 Resource Acquisition | Firebase incl. cloud functions; mapping etc. "as required" | Hosting instead of Functions; MapLibre/OpenFreeMap, ORS key, Expo Location/Notifications, EAS Build; Blaze not acquired | CHANGED | Rewritten. |
| 3.2 Work Plan (Table 5.0) and 3.2.1 Work Activities (Table 6.0) | Planned tasks and hours | Original plan | MATCHES | Kept unchanged; pointer to 1.1.5; note on "Table and Relationship Design" for NoSQL. |
| 3.2.4 Budget | No funding, free tools | Spark plan + ORS free tier; Blaze would cost | MATCHES + ADDED | Sentence added. |
| 3.3.1 Requirements Control | SRS + PM approval | Plus decisions log | MATCHES + ADDED | Sentence added. |
| 3.3.4 Quality Control | Unit, integration, system, UAT | Rules tests (900+), unit tests (350+), tsc/eslint, rule-cost measurement, manual device tests; no UI/E2E tests; UAT not yet done | CHANGED | "As of Nov 15" paragraph added. |
| 3.3.5 Reporting | Iteration reports | Plus STATUS.md | ADDED | Sentence added. |
| 3.3.7 Risk Management | Generic risks | Spark limits, rules expression limit, ORS dependency, background alerts, manual GCash, data privacy | ADDED | Table 9.0. |
| 4.1 Process Model | Agile, sprints | Small approved steps, checks before commit, feature branches | MATCHES + ADDED | Paragraph added. |
| 4.2 Methods (Table 7.0) | ERD; testing types | ERD adapted to Firestore; emulator rules tests; Markdown docs | CHANGED | Rows updated. |
| 4.2 Tools (Table 8.0) | Generic tools | Versions from package.json; admin stack; maps; emulator; test tools | CHANGED | Table updated. |
| 4.3 Infrastructure Plan | Centralized database server and web server | Serverless Firebase; Hosting; emulator | CHANGED | Rewritten. |
| 4.4 Product Acceptance | UAT with LGU, drivers, commuters | Not yet done | PENDING | Kept as plan. |
| 5 Supporting Plans | V&V, docs, QA, problems | True as plans | MATCHES | Documentation list extended (decisions log, status, data inventory, Privacy Notice). |
