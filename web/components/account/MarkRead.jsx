'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

/** Marks the shown unread notifications as read once the page is open. */
export function MarkRead({ ids }) {
  const router = useRouter();
  useEffect(() => {
    if (!ids.length) return;
    const t = setTimeout(() => {
      browserDb().from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
        .then(({ error }) => { if (!error) router.refresh(); });
    }, 1500);
    return () => clearTimeout(t);
  }, [ids, router]);
  return null;
}
