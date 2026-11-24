// All views in a gallery share the same level of identity and verification.
export function selectVehicleImages(model, options, catalogue, manifest) {
  if (!model || !catalogue) return [];
  const { variantId, vehicleId } = options;
  const variant = catalogue.variants.find((item) => item.id === variantId && item.model_id === model.id);
  const photos = catalogue.images.filter((image) => image.status === 'approved' && image.model_id === model.id);
  const modelPhotos = photos.filter((image) => !image.vehicle_id);
  const actual = vehicleId ? photos.filter((image) => image.vehicle_id === vehicleId && !image.is_generic &&
    (!image.variant_id || image.variant_id === variant?.id)) : [];
  const exact = variant ? modelPhotos.filter((image) => image.variant_id === variant.id && !image.is_generic) : [];
  const sameGeneration = variant?.generation && variant.is_verified ? new Set(catalogue.variants
    .filter((item) => item.model_id === model.id && item.is_verified && item.generation === variant.generation)
    .map((item) => item.id)) : new Set();
  const generation = modelPhotos.filter((image) => sameGeneration.has(image.variant_id) && !image.is_generic);
  const representative = modelPhotos.filter((image) => image.is_generic || !image.variant_id);
  const generated = manifest.models.find((item) => item.make === model.make && item.model === model.name);
  const bundled = generated ? Object.entries(generated.angles).map(([angle, name]) => ({
    angle, url: `/img/cab-vehicles/${name}-480.webp`, thumbnail: `/img/cab-vehicles/${name}-240.webp`,
    generated: true,
  })) : [];

  for (const [kind, candidates] of [
    ['actual', actual], ['variant', exact], ['generation', generation], ['model', representative], ['model', bundled],
  ]) {
    if (!candidates.length) continue;
    const angles = ['front_34', 'side', 'rear', 'interior', 'dashboard', 'other'];
    return angles.flatMap((angle) => {
      const image = candidates.find((item) => item.angle === angle);
      return image ? [{ ...image, kind }] : [];
    });
  }
  return [];
}
