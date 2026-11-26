import { PHOTOS } from '@/lib/photos';

// Attribution for the Wikimedia Commons photos shown on a page (required by their licences).
export function PhotoCredits({ names, L }) {
  const list = [...new Set(names)].map((n) => PHOTOS[n]).filter(Boolean);
  const credited = list.filter((p) => p.credit);
  const owned = list.some((p) => p.owner);
  if (!credited.length && !owned) return null;
  return (
    <details className="rf-credits wrap">
      <summary>{L('Photo credits', 'फ़ोटो क्रेडिट')}</summary>
      <ul>
        {credited.map((p) => (
          <li key={p.src}>
            <a href={p.credit.page} target="_blank" rel="noopener noreferrer">{p.credit.title}</a>
            {` ${L('by', '—')} ${p.credit.author}, `}
            <a href={p.credit.licenseUrl} target="_blank" rel="noopener noreferrer">{p.credit.license}</a>
            {L(', via Wikimedia Commons', ', विकिमीडिया कॉमन्स से')}
          </li>
        ))}
        {owned ? <li>{L('Other photos: The Himalayan Horizon.', 'बाकी फ़ोटो: द हिमालयन होराइज़न।')}</li> : null}
      </ul>
    </details>
  );
}
