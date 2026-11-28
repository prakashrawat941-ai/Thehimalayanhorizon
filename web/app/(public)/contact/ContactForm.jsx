'use client';
import { useActionState } from 'react';
import { sendContact } from './actions';
export function ContactForm({ text, lang }) {
    const [state, action, pending] = useActionState(sendContact, { status: 'idle' });
    if (state.status === 'ok')
        return <p className="form-ok" role="status">{text.message_sent}</p>;
    return (<form className="stack" action={action}>
      <input type="hidden" name="lang" value={lang}/>
      <label className="hp-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      <label className="field"><span className="field-label">{text.name} *</span><input className="input" name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
      <label className="field"><span className="field-label">{text.email} *</span><input className="input" name="email" type="email" required maxLength={254} autoComplete="email"/></label>
      <label className="field"><span className="field-label">{text.phone}</span><input className="input" name="phone" type="tel" pattern="[0-9+\s-]{7,20}" maxLength={20} autoComplete="tel"/></label>
      <label className="field"><span className="field-label">{text.your_message} *</span><textarea className="input" name="message" required minLength={5} maxLength={3000} rows={5}/></label>
      {state.status === 'unavailable' ? <p className="soft-note warn" role="alert">{text.contact_unavailable}</p> : null}
      {state.status === 'error' ? <p className="form-err" role="alert">{text[`err_${state.message}`] || text.err_server}</p> : null}
      <button className="btn" type="submit" disabled={pending}>{pending ? text.loading : text.send_message}</button>
    </form>);
}
