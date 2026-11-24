# Vehicle Master Catalogue

The Phase 2 seed expands the India catalogue from 58 to 370 model records across 36 makes. The migration preserves existing model IDs, variants and registered vehicles. Catalogue search accepts alternative names such as `WagonR`, `Vitara Brezza` and `Tempo Traveler`.

## Capacity and market status

- `vehicle_variants.seating_source_url` links to the manufacturer specification for 30 seating configurations across 12 models. `generation` identifies the series when the reference supports one. The existing `is_verified` flag records a THH reviewer’s decision.
- `seats_total` includes the driver. `passenger_seats` excludes the driver. The vehicle picker offers up to 12 seats per ride under the existing booking limit. The catalogue retains the manufacturer capacity for examples such as the 16-passenger Urbania.
- Drivers can use the existing registration-based manual flow for a model with no seating record. Previously seeded layouts without a manufacturer reference retain their review status.
- The `discontinued` tag describes Indian-market availability. `unknown` marks remaining market-status research. Model names can stay selectable after discontinuation to support vehicles still in service.

The migration records capacity references on the individual variants. The [Autocar India 2023 discontinuation round-up](https://www.autocarindia.com/car-news/9-cars-suvs-discontinued-in-india-in-2023-430170) and [RDE model coverage](https://www.autocarindia.com/car-news/rde-norms-you-cant-buy-these-cars-suvs-new-anymore-427766) document examples of historical availability.

Apply the catalogue migration before deploying code that reads the new fields. Confirm the target database, then run the existing cab regression suite with the staging schema.
