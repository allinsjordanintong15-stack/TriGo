# TriGo — Business Decisions Log

Business decisions made during development that are not yet reflected in
`docs/SRS.md` and `docs/SPMP.md`. Each entry must be carried into those documents
before the next revision is submitted. Mark an entry **Done** once both are updated.

| Date | Decision | Affects | SRS/SPMP updated |
|---|---|---|---|
| 2026-10-05 | **Booking requires a road route.** A fare is only calculated from the OpenRouteService road distance; if no road route is available the passenger cannot book (no straight-line fare bookings). | Booking, fare | No |
| 2026-10-05 | **Out-of-area: one driver per request.** A request is offered to one driver at a time. The driver proposes a fare; the passenger accepts or declines. There is no counter-offer. | Out-of-area trips | No |
| 2026-10-05 | **Out-of-area covers pickup OR destination outside Trinidad.** A trip is out-of-area if either end is outside the Trinidad, Bohol service area. | Out-of-area trips, service area | No |
| 2026-10-05 | **Out-of-area requests expire after 30 minutes.** | Out-of-area trips | No |
| 2026-10-05 | **Standard fare is fixed.** The passenger pays the fare shown at confirmation. It is calculated from the admin-managed per-km fare settings (base fare + per-km rate per vehicle type). It is labelled "Fare", not "Estimated fare". | Booking, fare, admin tariff management | No |
| 2026-10-05 | **Barangay tariffs from Poblacion** (approved; supersedes the earlier PENDING entry). A trip between Poblacion and a barangay, in either direction, is charged that barangay's fixed tariff, set per vehicle type and charged per trip. Every other trip uses the per-km fare. | Fare, admin tariff management | No |
| 2026-10-05 | **Fares keep centavos.** Fares are shown and stored to the centavo (e.g. ₱40.92); they are not rounded to whole pesos. | Fare, payments | No |
| 2026-10-05 | **Passenger cannot contact the driver yet.** The booking status screen shows the driver's name, vehicle, plate and rating only; no phone number or call/message button. Contacting the driver is a planned separate feature. | Booking status, driver privacy | No |
| 2026-10-05 | **PENDING — iOS photo/camera permission text.** The iOS camera and photo-library descriptions in `app.config.ts` mention only driver-application documents. Update them to also cover the passenger profile photo in the next EAS build (native change; Android does not use this text). | Profile photo, iOS build | No |
