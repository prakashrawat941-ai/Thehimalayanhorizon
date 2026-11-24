# Cab vehicle imagery

The [manifest](../web/lib/cab/cab/vehicle-image-manifest.json) records each bundled asset’s model, available angles, source and verification status. The [coverage snapshot](vehicle-image-coverage.csv) records which of the 370 catalogue models have bundled images. It was based on the staging catalogue, which had zero approved uploaded photos at the time of review. An approved image added later can replace a placeholder or a bundled preview automatically.

The selector uses the cab’s approved photo when it is linked to that registered vehicle, then an approved exact variant, an approved photo of a verified matching generation, an approved same-model image, a bundled model preview, or the category placeholder. All views offered together match the same level of vehicle identity. AI illustrations always display a preview label. Actual cab photos require an approved image tied to the registered vehicle plus documented permission. They are available as a supported image type, with no actual cab photos included in this release.

The bundled WebP cutouts cover nine commonly requested models. Innova Crysta, Urbania and Traveller include both front and side angles. Renders illustrate the model’s appearance. Drivers’ registered trim, year, paint and seating configuration should be taken from the corresponding catalogue or vehicle record.

Apply the vehicle image migration before releasing the app. It adds the vehicle link for uploaded photos and exposes only a catalogue variant ID for rides a caller could already view. Booking and driver contact fields are handled by the existing flows.
