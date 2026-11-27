'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EMPLOYEE_ID_PATTERN } from '@/lib/management/employee-id';
import { Panel, Tag } from '../parts';
import { DashEmpty, DashNotConnected } from '../DashStates';
import { NoteDialog } from './NoteDialog';
import { ROLE_LABELS, ROLE_TONE, initials, tr } from './ui';

const ASSIGNABLE = ['ceo', 'co_founder', 'employee'];

/**
 * Founder's access management. members: [{ userId, name, role, office, employeeId, mfa: 'verified'|'not_set'|null, lastActive }]
 * setMember(formData{ user_id?, email?, employee_id?, role, office, note }) → { ok, message } — Codex's
 * Founder-only, MFA-checked, audited server action. role 'none' removes management access.
 * The Founder's own row and admin rows (owner-set) are never editable here.
 */
export function AccessManagement({ lang, members, currentUserId, setMember = null, connected = true }) {
  const L = tr(lang);
  const router = useRouter();
  const [edit, setEdit] = useState(null); // member userId | 'new'
  const [newRole, setNewRole] = useState('employee');
  const needsEmployeeId = edit === 'new' && ['ceo', 'co_founder'].includes(newRole);
  const role = (r) => <Tag tone={ROLE_TONE[r] || 'gray'}>{L(...(ROLE_LABELS[r] || [r, r]))}</Tag>;
  const mfa = (m) => (m === 'verified' ? <Tag tone="green">{L('Verified', 'सत्यापित')}</Tag> : m === 'not_set' ? <Tag tone="amber">{L('Not set up', 'सेट नहीं')}</Tag> : '—');
  const editable = (m) => setMember && m.userId !== currentUserId && m.role !== 'admin' && m.role !== 'founder';
  const target = edit && edit !== 'new' ? members.find((m) => m.userId === edit) : null;
  const close = (saved) => { setEdit(null); if (saved) router.refresh(); };
  const rules = (
    <div className="dsx-info"><b>{L('Rules', 'नियम')}</b>
      {L('One management role per person. You cannot remove your own Founder role. Admin is set only by the owner. New people must set up two-step verification before their dashboard opens. Every change needs a reason and goes to the audit log.',
        'हर व्यक्ति की एक ही मैनेजमेंट भूमिका। आप अपनी Founder भूमिका नहीं हटा सकते। एडमिन सिर्फ़ मालिक बनाते हैं। नए लोगों को डैशबोर्ड खुलने से पहले दो-चरण सत्यापन सेट करना होगा। हर बदलाव का कारण ज़रूरी है और ऑडिट लॉग में जाता है।')}
    </div>
  );
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Access management', 'एक्सेस प्रबंधन')}</h1>
        <p className="muted">{L('Who can open which dashboard.', 'कौन सा डैशबोर्ड कौन खोल सकता है।')}</p></div>
        {setMember ? <button type="button" className="btn" onClick={() => { setNewRole('employee'); setEdit('new'); }}>{L('+ Add person', '+ व्यक्ति जोड़ें')}</button> : null}
      </div>
      {rules}
      {!connected ? <DashNotConnected title={L('Not connected yet', 'अभी जुड़ा नहीं')} text={L('The team list appears once management access is live.', 'मैनेजमेंट एक्सेस चालू होते ही टीम की सूची दिखेगी।')} />
        : !members.length ? <DashEmpty title={L('No team members yet', 'अभी कोई टीम सदस्य नहीं')} text={L('Add your CEO, Co-founder or village office staff.', 'अपने CEO, सह-संस्थापक या ग्राम कार्यालय स्टाफ़ को जोड़ें।')} />
          : (
            <Panel title={L('People', 'लोग')} count={null}>
              <div className="dsx-table-wrap dsx-only-d">
                <table className="dsx-table">
                  <thead><tr><th>{L('Person', 'व्यक्ति')}</th><th>{L('Role', 'भूमिका')}</th><th>{L('Office', 'कार्यालय')}</th><th>{L('Two-step', 'दो-चरण')}</th><th>{L('Last active', 'आख़िरी बार')}</th><th /></tr></thead>
                  <tbody>{members.map((m) => (
                    <tr key={m.userId}>
                      <td><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="dsx-avatar">{initials(m.name)}</span><span><b>{m.name}</b>{m.employeeId ? <small className="dsx-note" style={{ display: 'block' }}>{m.employeeId}</small> : null}</span></span></td>
                      <td>{role(m.role)}</td><td>{m.office || '—'}</td><td>{mfa(m.mfa)}</td><td>{m.lastActive || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{m.userId === currentUserId ? <span className="dsx-note">{L('You', 'आप')}</span> : editable(m) ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(m.userId)}>{L('Change', 'बदलें')}</button> : null}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <div className="dsx-cards dsx-only-m">{members.map((m) => (
                <article key={m.userId} className="dsx-mc">
                  <div className="dsx-mc-h"><span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}><span className="dsx-avatar">{initials(m.name)}</span><span><b>{m.name}</b>{m.employeeId ? <small className="dsx-note" style={{ display: 'block' }}>{m.employeeId}</small> : null}</span></span>{role(m.role)}</div>
                  <dl><dt>{L('Office', 'कार्यालय')}</dt><dd>{m.office || '—'}</dd><dt>{L('Two-step', 'दो-चरण')}</dt><dd>{mfa(m.mfa)}</dd><dt>{L('Last active', 'आख़िरी बार')}</dt><dd>{m.lastActive || '—'}</dd></dl>
                  {editable(m) ? <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setEdit(m.userId)}>{L('Change access', 'एक्सेस बदलें')}</button> : null}
                </article>))}</div>
            </Panel>
          )}
      {edit ? (
        <NoteDialog
          title={target ? L('Change access', 'एक्सेस बदलें') : L('Add a person', 'व्यक्ति जोड़ें')}
          subtitle={target ? `${target.name} · ${L(...(ROLE_LABELS[target.role] || [target.role, target.role]))}` : L('New accounts get an email invitation to set their password. Existing accounts keep their current password. Two-step verification is required.', 'नए खातों को पासवर्ड सेट करने के लिए ईमेल मिलेगा। मौजूदा खातों का पासवर्ड वही रहेगा। दो-चरण सत्यापन ज़रूरी है।')}
          hidden={target ? { user_id: target.userId } : {}}
          fields={<>
            {!target ? <div className="dsx-fld"><label htmlFor="am-email">{L('Email', 'ईमेल')}</label><input id="am-email" name="email" type="email" required autoComplete="off" /></div> : null}
            <div className="dsx-fld"><label htmlFor="am-role">{L('Role', 'भूमिका')}</label>
              <select id="am-role" name="role" defaultValue={target?.role || 'employee'} onChange={target ? undefined : (event) => setNewRole(event.target.value)}>
                {ASSIGNABLE.map((r) => <option key={r} value={r}>{L(...ROLE_LABELS[r])}</option>)}
                {target ? <option value="none">{L('Remove management access', 'मैनेजमेंट एक्सेस हटाएँ')}</option> : null}
              </select></div>
            {needsEmployeeId ? <div className="dsx-fld">
              <label htmlFor="am-employee-id">{L('Employee ID (sign-in username)', 'कर्मचारी आईडी (लॉगिन नाम)')}</label>
              <input id="am-employee-id" name="employee_id" pattern={EMPLOYEE_ID_PATTERN} minLength={3} maxLength={32} required autoComplete="off" placeholder="THH-CEO-001" />
            </div> : null}
            <div className="dsx-fld"><label htmlFor="am-office">{L('Office', 'कार्यालय')}</label><input id="am-office" name="office" defaultValue={target?.office || ''} maxLength={80} /></div>
          </>}
          noteLabel={L('Reason (required, saved to audit log)', 'कारण (ज़रूरी, ऑडिट लॉग में सेव होगा)')}
          required={L('Write a reason of 1–500 characters.', '1–500 अक्षरों का कारण लिखें।')}
          failed={L('Could not save. Nothing was changed — try again.', 'सहेज नहीं सके। कुछ नहीं बदला — फिर कोशिश करें।')}
          cancel={L('Cancel', 'रद्द करें')}
          buttons={[{ value: target ? 'change' : 'invite', label: target ? L('Save change', 'बदलाव सेव करें') : L('Send invite', 'न्योता भेजें') }]}
          action={setMember}
          onClose={close}
        />
      ) : null}
    </>
  );
}
