'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { Icon } from './Icon';

/**
 * Bell with unread count. Updates in real time when the database sends changes
 * (notifications table in the realtime list) and also re-checks when the app comes
 * back to the screen and every 2 minutes, so it stays right either way.
 */
export function NotificationBell({ label, href = '/account/notifications' }) {
  const [count, setCount] = useState(0);
  const path = usePathname();
  useEffect(() => {
    const db = browserDb();
    let channel = null;
    let alive = true;
    const load = async () => {
      const { data } = await db.auth.getUser();
      if (!data.user || !alive) return null;
      const { count: c } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id).is('read_at', null);
      if (alive) setCount(c || 0);
      return data.user;
    };
    load().then((user) => {
      if (!user || !alive) return;
      channel = db.channel(`bell-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => load())
        .subscribe();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(load, 120000);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); if (channel) db.removeChannel(channel); };
  }, [path]);
  return (
    <Link className="icon-link bell" href={href} aria-label={count ? `${label}: ${count}` : label}>
      <Icon name="bell" size={20} />
      {count ? <span className="bell-dot">{count > 9 ? '9+' : count}</span> : null}
    </Link>
  );
}
