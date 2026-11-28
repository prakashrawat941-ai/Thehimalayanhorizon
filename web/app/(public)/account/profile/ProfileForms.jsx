'use client';
import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { Icon } from '@/components/Icon';
import { saveProfile } from './actions';

export function ProfileForm({ profile, email, text }) {
  const [state, action, pending] = useActionState(saveProfile, { status: 'idle' });
  return (
    <form className="stack" action={action}>
      <label className="field"><span className="field-label">{text.name} *</span>
        <input className="input" name="full_name" defaultValue={profile.full_name || ''} required minLength={2} maxLength={120} autoComplete="name" /></label>
      <label className="field"><span className="field-label">{text.phone}</span>
        <input className="input" name="phone" type="tel" defaultValue={profile.phone || ''} maxLength={20} pattern="[0-9+\s-]{7,20}" autoComplete="tel" />
        <small className="muted">{text.phone_note}</small></label>
      <label className="field"><span className="field-label">{text.email}</span><input className="input" value={email} disabled readOnly /></label>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ fontWeight: 700 }}>{text.ec_title}</legend>
        <small className="muted">{text.ec_note}</small>
        <label className="field"><span className="field-label">{text.ec_name}</span>
          <input className="input" name="emergency_contact_name" defaultValue={profile.emergency_contact_name || ''} maxLength={120} /></label>
        <label className="field"><span className="field-label">{text.ec_phone}</span>
          <input className="input" name="emergency_contact_phone" type="tel" defaultValue={profile.emergency_contact_phone || ''} maxLength={20} pattern="[0-9+\s-]{7,20}" /></label>
      </fieldset>
      <label className="field"><span className="field-label">{text.language}</span>
        <select className="input" name="lang" defaultValue={profile.lang === 'en' ? 'en' : 'hi'}>
          <option value="hi">हिंदी</option><option value="en">English</option>
        </select></label>
      {state.status === 'ok' ? <p className="form-ok" role="status">{text.saved}</p> : null}
      {state.status === 'error' ? <p className="form-err" role="alert">{text[`err_${state.message}`] || text.err_server}</p> : null}
      <button className="btn" type="submit" disabled={pending}>{pending ? text.loading : text.save}</button>
    </form>
  );
}

// Make photos small before upload (faster on mobile data). Output is always JPEG.
async function shrink(file, max = 512) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  return blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file;
}

export function PhotoUpload({ userId, url, initials, text }) {
  const router = useRouter();
  const input = useRef(null);
  const [src, setSrc] = useState(url);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function onPick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMsg(text.photo_type); return; }
    if (f.size > 5 * 1024 * 1024) { setMsg(text.photo_size); return; }
    setBusy(true); setMsg('');
    try {
      const small = await shrink(f);
      const db = browserDb();
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const up = await db.storage.from('media').upload(path, small, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const publicUrl = db.storage.from('media').getPublicUrl(path).data.publicUrl;
      const { error } = await db.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
      if (error) throw error;
      setSrc(publicUrl); setMsg(text.photo_ok); router.refresh();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally { setBusy(false); }
  }
  return (
    <div className="acc-photo-row">
      <span className="ds-avatar acc-avatar-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials}
      </span>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
          <Icon name="camera" size={16} /> {busy ? text.loading : text.change_photo}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} aria-label={text.change_photo} />
        <p className="muted small">{text.photo_hint}</p>
        {msg ? <p className="small" role="status">{msg}</p> : null}
      </div>
    </div>
  );
}

export function PasswordForm({ text }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const pw = new FormData(form).get('password');
      setBusy(true); setMsg(null);
      const { error } = await browserDb().auth.updateUser({ password: String(pw) });
      setBusy(false);
      if (error) setMsg({ err: true, text: error.message }); else { setMsg({ err: false, text: text.saved }); form.reset(); }
    }}>
      <label className="field"><span className="field-label">{text.new_password}</span>
        <input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" />
        <small className="muted">{text.min8}</small></label>
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}
      <button className="btn btn-ghost" type="submit" disabled={busy}>{text.change_password}</button>
    </form>
  );
}
