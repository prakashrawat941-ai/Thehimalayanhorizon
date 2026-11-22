'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserDb } from '@/lib/supabase/client';
import { Icon } from '../Icon';

export function RemoveSaved({ locationId, label }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-label={label}
      onClick={async () => {
        setBusy(true);
        const db = browserDb();
        const { data } = await db.auth.getUser();
        if (data.user) await db.from('saved_destinations').delete().eq('user_id', data.user.id).eq('location_id', locationId);
        setBusy(false);
        router.refresh();
      }}>
      <Icon name="heart" size={16} /> {label}
    </button>
  );
}
