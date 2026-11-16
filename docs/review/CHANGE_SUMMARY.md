# SRS and SPMP version 2.0 — Change Summary

For AJ and the adviser. Prepared 2026-11-15 on branch `docs/final-srs-spmp`.

- Edited: `docs/SRS.md` and `docs/SPMP.md` (both now version 2.0, with a Revision History table).
- Originals: `docs/archive/SRS_original_2026-11-15.md` and `docs/archive/SPMP_original_2026-11-15.md`.
- Full section-by-section comparison: `docs/review/SRS_SPMP_GAP_REPORT.md`.
- Unverifiable items are marked ⟦To confirm …⟧ in the documents and listed below.

## Most important changes

### SRS

1. **The Administrator side is a separate website, not part of the mobile app.** The original left this open; the system was built as a React + Vite website on Firebase Hosting.
2. **Out-of-area trips use the Administrator's per-km fare, and it is final.** The original said the passenger and driver may agree on a fare; there is no negotiation in the system.
3. **The fare model is now spelled out.** Poblacion ↔ barangay trips use that barangay's tariff; every other trip uses base fare + rate × road distance, so the panel can see exactly how a fare is computed.
4. **A booking needs a road route from OpenRouteService.** No straight-line fares are ever charged, which explains why booking stops when routing is unavailable.
5. **The map and routing services are named** (MapLibre, OpenFreeMap, OpenRouteService, PSA/NAMRIA barangay boundaries). This was open decision #4 and is now documented.
6. **The payment method is recorded, not processed.** The driver records Cash or GCash at completion; the original implied the passenger selects GCash and that GCash is integrated.
7. **Commission is fully specified.** It covers the percentage of the final fare, payment periods, grace period, overdue warning, automatic suspension, and GCash reference numbers confirmed by the Administrator, matching what the code enforces.
8. **"Quota" is defined as a daily acceptance limit per driver** (1–100, default 20, Manila day). The original never said what a quota was.
9. **Passenger cancellation rules were added.** Cancellation is free before acceptance, allowed after acceptance only if the driver hasn't arrived within 15 minutes, and not allowed after arrival, because the rules enforce exactly this.
10. **New features are added as requirements:** booking expiry, driver rating, complaints, Administrator warnings and the in-app inbox, contact sharing only during an active trip, and ride request alerts. All are built and tested.
11. **Data privacy (RA 10173) is added.** It covers consent at registration with version tracking, re-consent, the Privacy Notice and Terms, and account deletion by anonymization; the original had no privacy requirement.
12. **Security is described concretely.** It now covers Firebase Authentication, the admin-only account setting, Cloud Firestore Security Rules per role, and automated rules tests, because that is how security actually works without a server.
13. **A "Known Limitations and Future Enhancements" section (2.6) was added.** It covers document upload blocked by Firebase Storage/Blaze, no push notifications when the app is closed, manual GCash checks, no booking search page, no passenger suspension, and Vehicle Fleet not built, so nothing is claimed as working that isn't.
14. **A Data Requirements section (3.6) lists the Firestore collections.** The panel may ask about the database, and the original had no data section.
15. **Notifications are described honestly.** Drivers get vibration and local notifications only while the app is running; passengers see booking updates live and warnings in the inbox; there are no push notifications.

### SPMP

16. **The roles table is corrected.** The Database Administrator now works on Cloud Firestore instead of MySQL; the Mobile Developer builds for Android and iOS, not only Android; the Backend Developer writes Security Rules and the Administrator website, with no custom API server.
17. **The architecture and infrastructure are corrected.** There are no Cloud Functions and no "centralized database server/web server"; the apps talk directly to Firebase, and the Security Rules are the service layer.
18. **An Actual Schedule (1.1.5, Table 1.1) was added from Git history.** Coding started on Aug 12; most Iteration 2 features were finished in October–November 2026; several features were added. The planned schedule (Tables 1.0 and 5.0) is kept unchanged.
19. **The quality control section reports the testing actually done.** That is more than 900 Security Rules tests, more than 350 unit tests, type and lint checks, rule-cost measurement, and manual device tests. It states plainly that there are no automated UI tests and that UAT has not happened yet.
20. **A risk table (Table 9.0) lists the risks actually met.** These are the Spark plan limits, the Firestore 1,000-expression rule limit, the OpenRouteService dependency, phone background limits, manual GCash checks, and data privacy, each with its mitigation.
21. **The tools table carries real versions:** React Native 0.85, Expo SDK 56, React 19, Vite 8, TypeScript 6.0, Firebase SDK 12, Firebase CLI 15, MapLibre 11, and the test tools. They are taken from `package.json`.
22. **The budget section notes the Firebase Spark plan and the OpenRouteService free tier.** Moving to Blaze would introduce costs, which is why Storage and Cloud Functions are future work.
23. **Payment, out-of-area and quota wording in Scope, Objectives, Assumptions and Constraints now matches the SRS,** so the two documents don't contradict each other.

## Needs AJ to confirm

1. **Official Word/PDF versions:** the repo has only Markdown copies (they look converted from Word). If the submitted SRS/SPMP are .docx files elsewhere, share them so the same changes can be applied there, keeping the school template.
2. **Version 1.0 details:** the original version number and submission dates for the Revision History (marked ⟦To confirm⟧).
3. **HDX dataset URL** for the barangay boundary reference (SRS reference [11]).
4. **Hardware specifications** (development computer and minimum phone): kept as written, but not verifiable from the repo.
5. **iOS testing:** whether the app was actually run on an iPhone. The EAS builds in the repo are Android APKs.
6. **Deployment status:** which Security Rules, app build and Administrator website version are live. Several November features are marked "not deployed" in STATUS.md. Is the Administrator website live on Firebase Hosting?
7. **Team and roles:** whether the staffing table is still accurate (names, positions, LGU as Product Owner) and how to describe who did what. The Git history shows commits from one developer.
8. **Stakeholder activities:** whether interviews or consultations with the LGU, drivers and commuters took place, and when (for the Actual Schedule).
9. **Other deliverables:** whether the SDD, STD, User Manual, and Installation Guide exist yet. They are kept in the deliverables list as planned, not claimed as done.
10. **AI-assisted development:** whether and how to disclose AI coding tools in the SPMP tools/methods (the repo contains `docs/CLAUDE.md`). Not added.
11. **Page numbers** in the Lists of Figures/Tables for the new Tables 1.1, 2.0 and 9.0 (marked ⟦page⟧) once the Word layout is final.
12. **Figures:** whether the use-case and prototype figures should be updated to match the built screens. Notes were added for Earnings (Fig. 18) and Vehicle Fleet (Fig. 24).
13. **Privacy Notice update:** still to do after Task B2 (warnings and announcements), with one version bump and re-consent before the defense (already a TODO in STATUS.md).

## Likely panel questions

1. **"Why didn't you use Cloud Functions?"** — The project is on the free Firebase Spark plan, which has no Cloud Functions. Instead, every write is checked by Cloud Firestore Security Rules: who may write, valid fares, status changes, quota and commission amounts. This is backed by more than 900 automated rules tests. Server-side extras like push notifications need the Blaze plan.
2. **"How is the fare calculated, and can it be tampered with?"** — Poblacion ↔ barangay trips use that barangay's active tariff; everything else uses base fare + rate × road distance from OpenRouteService. The rules check that a tariff fare equals the admin's tariff. They cannot check that the pin is inside that barangay or recompute per-km fares (a known limit that needs Cloud Functions).
3. **"Does TriGo process GCash payments?"** — No. Passengers pay drivers directly, and the driver records Cash or GCash. Drivers pay TriGo's commission by GCash and enter the reference number. Each reference can be used once, and the admin confirms it after checking the GCash account. A gateway like PayMongo would need a registered business.
4. **"What is the quota?"** — A daily acceptance limit per driver, set by the admin (1–100, default 20), reset at midnight Manila time. A passenger cancelling before the trip gives the slot back.
5. **"What happens if no driver accepts?"** — A standard booking expires after the admin-set time (default 10 minutes) and the passenger can try again with one tap. Out-of-area requests also expire.
6. **"How do drivers get new requests if the app is closed?"** — They don't, and we say so. Alerts work while the app is running: vibration on screen, and a local notification in the background. Push to a closed app needs Firebase Cloud Messaging with Cloud Functions (Blaze).
7. **"Why can't drivers upload their documents?"** — The upload is built, but storing files needs Firebase Storage, which requires the Blaze plan. This is documented as a limitation.
8. **"How do you comply with the Data Privacy Act?"** — A Privacy Notice and Terms with consent recorded by version, contact numbers shared only during an active trip, a data inventory, and account deletion that anonymizes personal data while keeping trip and money records.
9. **"How did you test the system?"** — Automated Security Rules tests on the Firebase emulator (allowed and refused cases), automated unit tests for fares, quota, commission and other calculations, type and lint checks, and manual testing on a phone. UAT with the LGU, drivers and commuters is still planned.
10. **"What if OpenRouteService goes down?"** — Booking stops, because we never charge a straight-line fare. Place search falls back to the phone's geocoder, and a backup routing service is planned.
