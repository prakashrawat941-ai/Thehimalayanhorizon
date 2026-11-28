// Keep publication checks shared by the public pages and the admin review queue.
export function homestayPublicationIssues(h) {
  const issues = [];
  if (!h?.name?.trim() || h.name.trim().length < 3) issues.push(['Property name', 'प्रॉपर्टी का नाम']);
  if (!h?.village?.trim() || h.village.trim().length < 2) issues.push(['Village', 'गाँव']);
  if (!h?.district?.trim() || h.district.trim().length < 2) issues.push(['District', 'ज़िला']);
  if (!h?.summary?.trim() || h.summary.trim().length < 30) issues.push(['Summary (30+ characters)', 'परिचय (कम से कम 30 अक्षर)']);
  if (!h?.description?.trim() || h.description.trim().length < 40) issues.push(['Description (40+ characters)', 'विवरण (कम से कम 40 अक्षर)']);
  if (!Array.isArray(h?.images) || !h.images.some((url) => typeof url === 'string' && url.trim())) issues.push(['Real property photo', 'प्रॉपर्टी की असली फ़ोटो']);
  if (!Number.isFinite(Number(h?.price_per_night)) || Number(h.price_per_night) <= 0) issues.push(['Nightly price', 'एक रात की कीमत']);
  if (!Number.isInteger(Number(h?.rooms)) || Number(h.rooms) < 1) issues.push(['Room count', 'कमरों की संख्या']);
  if (!Number.isInteger(Number(h?.max_guests)) || Number(h.max_guests) < 1) issues.push(['Guest capacity', 'मेहमानों की संख्या']);
  return issues;
}
