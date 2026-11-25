// Manufacturer seating arrangements for exact catalogue configurations.
// Numbers are THH booking labels assigned front to back in a right-hand-drive cabin.
const TOYOTA_MANUAL = 'https://ownersmanual-media.toyotabharat.com/innova-crysta-om-aug-2024-1.pdf';
const ERTIGA_BROCHURE = 'https://www.marutisuzuki.com/content/dam/msil/arena/in/en/assets/cars/ertiga/document/Arena-Ertiga-Brochure.pdf';

const layouts = {
  'Maruti Suzuki|Ertiga|Second generation|7-seater': {
    rows: [[1, null, 'driver'], [2, 3, 4], [5, null, 6]],
    source: ERTIGA_BROCHURE,
  },
  'Toyota|Innova Crysta|AN140|7-seater': {
    rows: [[1, null, 'driver'], [2, null, 3], [4, 5, 6]],
    source: TOYOTA_MANUAL,
  },
  'Toyota|Innova Crysta|AN140|8-seater': {
    rows: [[1, null, 'driver'], [2, 3, 4], [5, 6, 7]],
    source: TOYOTA_MANUAL,
  },
  'Force Motors|Urbania|Urbania|3350 mm / 10+D': {
    rows: [[1, null, null, 'driver'], [null, null, 2, 3], [4, null, 5, 6], [7, 8, 9, 10]],
    source: 'https://forceurbania.co.in/wp-content/uploads/2022/10/10D-Short-Wheel-base_Web-1-1.webp',
  },
  'Force Motors|Urbania|Urbania|3615 mm / 12+D': {
    rows: [[1, null, null, 'driver'], [null, null, 2, 3], [4, null, 5, 6], [7, null, 8, 9], [10, null, 11, 12]],
    source: 'https://forceurbania.co.in/wp-content/uploads/2022/10/12D-Medium-Wheel_Web-1.webp',
  },
};

export function seatLayoutFor(catalogue, variantId, offeredSeats) {
  const variant = catalogue.variants.find((item) => item.id === variantId);
  // Legacy rides and partial offers do not specify which physical positions the driver offered.
  if (!variant || offeredSeats !== variant.passenger_seats) return null;
  const model = catalogue.models.find((item) => item.id === variant.model_id);
  if (!model) return null;
  const key = [model.make, model.name, variant.generation, variant.variant].join('|');
  const layout = layouts[key];
  if (!layout || layout.rows.flat().filter(Number.isInteger).length !== offeredSeats) return null;
  return layout;
}
