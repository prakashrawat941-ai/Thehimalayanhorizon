'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/account';
export async function saveWork(form) {
  const { db } = await requireUser('/management');
  const id = form.get('id');
  const result = form.get('employeeEmail')
    ? await db.rpc('management_employee', {
        p_email: form.get('employeeEmail'),
        p_name: form.get('employeeName'),
        p_office: form.get('office'),
      })
    : id
      ? await db.rpc('management_decide', {
          p_id: id,
          p_action: form.get('action'),
          p_note: form.get('note'),
        })
      : await db.rpc('management_submit', {
          p_kind: form.get('kind'),
          p_subject: form.get('subject'),
          p_amount: form.get('amount') || null,
          p_assignee: form.get('assignee') || null,
          p_partner: form.get('partner') || null,
          p_booking: form.get('booking') || null,
          p_email: form.get('email') || null,
          p_due: form.get('due') || null,
          p_request: form.get('requestKey') || null,
        });
  redirect('/management?result=' + (result.error ? 'failed' : 'saved'));
}
