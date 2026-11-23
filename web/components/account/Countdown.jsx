'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Live mm:ss countdown for a seat hold. Refreshes the page when the hold runs out. */
export function Countdown({ until, labels }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0) { clearInterval(id); setTimeout(() => router.refresh(), 3000); }
    }, 1000);
    return () => clearInterval(id);
  }, [end, router]);
  if (!left) return <span className="badge badge-full">{labels.expired}</span>;
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return <span className="badge badge-pending mono" aria-live="polite">{labels.held} {m}:{String(s).padStart(2, '0')}</span>;
}
