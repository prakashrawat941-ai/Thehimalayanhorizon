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

export async function bookStay(form) {
  const { db } = await requireUser('/employee');
  const { error } = await db.rpc('management_book_stay', {
    p_request: form.get('requestKey'),
    p_room: form.get('room'),
    p_guest: form.get('guest'),
    p_phone: form.get('phone'),
    p_start: form.get('arrival'),
    p_end: form.get('departure'),
    p_guests: Number(form.get('guests')),
  });
  redirect('/employee?result=' + (error ? 'failed' : 'saved'));
}
