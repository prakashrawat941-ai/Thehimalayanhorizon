const fuels = ['petrol', 'diesel', 'cng'];
export const istDate = (date = new Date()) => new Date(date.valueOf() + 19_800_000).toISOString().slice(0, 10);
const normalise = (value) => String(value || '').trim().toLowerCase().replace(/\s+district$/, '');

export function datedPrices(row, today) {
  const prices = {};
  for (const fuel of fuels) {
    const item = row.fuel_prices?.[fuel] ?? row.fuel_prices?.[fuel + '_price'];
    const price = Number(item?.price ?? item);
    const date = String(item?.date ?? row.price_date ?? row.date ?? '').slice(0, 10);
    if (Number.isFinite(price) && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) {
      prices[fuel] = { price, date, unit: fuel === 'cng' ? 'kg' : 'litre' };
    }
  }
  return prices;
}

export function readSsrDistrict(payload, state, district, today) {
  if (payload?.success !== true || !Array.isArray(payload.data)) throw new Error('Fuel response unavailable');
  const region = payload.data.find((entry) => normalise(entry.state_name) === normalise(state) && !entry.is_default);
  const row = region?.districts?.find((entry) => normalise(entry.district_name) === normalise(district) && !entry.is_default);
  return row ? datedPrices(row, today) : {};
}
