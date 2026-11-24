'use client';
import { useState } from 'react';
import { categories, labels } from '@/lib/management/catalog';
import { saveWork } from './actions';
export default function EntryForm({
  member,
  staff,
  partners,
  lang,
  requestKey,
}) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const title = (k) => L(...labels[k]);
  const [kind, setKind] = useState(categories[member.role][0]);
  return (
    <form action={saveWork}>
      <input type="hidden" name="requestKey" value={requestKey} />
      <label>
        {L('Type', 'प्रकार')}
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {categories[member.role].map((k) => (
            <option key={k} value={k}>
              {title(k)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {L('Details', 'विवरण')}
        <input name="subject" maxLength={240} required />
      </label>
      {['expense', 'finance'].includes(kind) && (
        <label>
          {L(
            'Amount in ₹ (expenses and finance only)',
            'राशि ₹ (सिर्फ खर्च या वित्त)',
          )}
          <input name="amount" type="number" required min=".01" step=".01" />
        </label>
      )}
      {['task', 'email', 'operation'].includes(kind) && (
        <label>
          {L('Assign task or follow-up', 'कार्य या फ़ॉलो-अप सौंपें')}
          <select name="assignee">
            <option value="">{L('Unassigned', 'अभी खाली')}</option>
            {staff.data.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.display_name || s.user_id} · {s.office}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'booking' && (
        <label>
          {L(
            'Existing booking code (optional)',
            'मौजूदा बुकिंग कोड (वैकल्पिक)',
          )}
          <input name="booking" maxLength={80} />
        </label>
      )}
      {member.role === 'ceo' && (
        <>
          {kind === 'email' && (
            <label>
              {L('Email recipient for follow-up', 'फ़ॉलो-अप ईमेल पता')}
              <input name="email" type="email" required />
            </label>
          )}
          <label>
            {L('Due date', 'अंतिम तिथि')}
            <input name="due" type="date" />
          </label>
        </>
      )}
      {kind === 'partner' && (
        <label>
          {L('Pending partner for review', 'समीक्षा के लिए पार्टनर')}
          <select name="partner" required>
            <option value="">—</option>
            {partners.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.business_name} · {p.village}
              </option>
            ))}
          </select>
        </label>
      )}
      <button>{L('Save entry', 'दर्ज करें')}</button>
    </form>
  );
}
