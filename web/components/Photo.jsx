'use client';
import { useEffect, useRef, useState } from 'react';
import { PHOTOS } from '@/lib/photos';

// A named photo from lib/photos.js. Falls back to the site's own image if the remote file fails,
// including failures that happen before hydration (checked once on mount).
export function Photo({ name, alt, lang = 'en', className, eager = false, sizes = '100vw' }) {
  const p = PHOTOS[name];
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && p?.fallback) setFailed(true);
  }, [p]);
  if (!p) return null;
  const useFallback = failed && p.fallback;
  const label = alt ?? (p.alt ? p.alt[lang === 'hi' ? 1 : 0] : '');
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} className={className} alt={label}
      src={useFallback ? p.fallback : p.src}
      srcSet={!useFallback && p.srcXL ? `${p.src} 1920w, ${p.srcXL} 3840w` : undefined}
      sizes={!useFallback && p.srcXL ? sizes : undefined}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async"
      onError={() => { if (!failed && p.fallback) setFailed(true); }}/>
  );
}
