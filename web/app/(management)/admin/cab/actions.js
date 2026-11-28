'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { getT } from '@/lib/i18n/server';

const isUuid = (value) => typeof value === 'string'
  && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

export async function updateIncident(id, newStatus, _previous, form) {
  const { db } = await requireAdmin('/admin/cab?tab=sos');
  const { L } = await getT();
  const note = form.get('note');
  if (!isUuid(id) || !['acknowledged', 'resolved'].includes(newStatus)
      || typeof note !== 'string' || Array.from(note).length > 1000) {
    return { error: L('Invalid incident update.', 'घटना का अपडेट अमान्य है।') };
  }
  const { error } = await db.rpc('admin_update_sos', {
    p_id: id, p_status: newStatus, p_note: note.trim(),
  });
  revalidatePath('/admin/cab');
  if (error) return { error: L('Could not save. Refresh the incident and try again.', 'सेव नहीं हुआ। घटना रीफ़्रेश करके फिर कोशिश करें।') };
  return { saved: true };
}

export async function cancelRide(id, _previous, _form) {
  const { db } = await requireAdmin('/admin/cab?tab=rides');
  const { L } = await getT();
  if (!isUuid(id)) return { error: L('Invalid ride.', 'राइड अमान्य है।') };
  const { error } = await db.rpc('cancel_cab_ride', { p_ride: id });
  revalidatePath('/admin/cab');
  if (error) return { error: L('Could not cancel this ride. Refresh and try again.', 'राइड रद्द नहीं हुई। रीफ़्रेश करके फिर कोशिश करें।') };
  return { saved: true };
}
