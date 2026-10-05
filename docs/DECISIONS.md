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
| 2026-10-05 | **PENDING — Barangay tariffs from Poblacion.** Fares may be set per barangay, measured from Poblacion. Details to be decided. | Fare, admin tariff management | No |
