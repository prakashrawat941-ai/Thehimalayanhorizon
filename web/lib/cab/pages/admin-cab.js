// Admin: drivers (verify, suspend, documents) and the vehicle catalog (seat checks, photos with source and licence).
import { h, clear, toast, busy, icon, empty, fmtDate } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { catalog, resetCatalog, vehicleVisual } from '../cab/vehicles.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const again = () => location.reload();
const DOCS = { driving_licence: L('Driving licence', 'ड्राइविंग लाइसेंस'), vehicle_rc: 'RC', insurance: L('Insurance', 'बीमा'), permit: L('Permit', 'परमिट'), pollution: 'PUC', photo_id: L('Photo ID', 'फ़ोटो आईडी'), other: L('Other', 'अन्य') };

// ---------- Drivers ----------
export async function driversAdmin(query = {}) {
  const [drivers, vehicles, docs] = await Promise.all([
    q(sb.from('driver_profiles').select('*').order('created_at', { ascending: false }).limit(500)),
    q(sb.from('vehicles').select('*').limit(1000)),
    q(sb.from('driver_documents').select('*').order('created_at', { ascending: false }).limit(1000)).catch(() => []),
  ]);
  const filter = ['waiting', 'verified', 'suspended'].includes(query.f) ? query.f : 'all';
  const isWaiting = (d) => !d.is_verified && d.status === 'active';
  const shown = drivers.filter((d) => filter === 'all' || (filter === 'waiting' && isWaiting(d)) || (filter === 'verified' && d.is_verified && d.status === 'active') || (filter === 'suspended' && d.status === 'suspended'));
  const tabs = [['all', L('All', 'सभी'), drivers.length], ['waiting', L('Waiting for verification', 'वेरिफ़िकेशन बाकी'), drivers.filter(isWaiting).length],
    ['verified', L('Verified', 'वेरिफ़ाइड'), drivers.filter((d) => d.is_verified && d.status === 'active').length], ['suspended', L('Suspended', 'निलंबित'), drivers.filter((d) => d.status === 'suspended').length]];

  const setDriver = (d, patch, btn, msg) => busy(btn, async () => { await q(sb.from('driver_profiles').update(patch).eq('user_id', d.user_id)); toast(msg); again(); });
  const docRow = (x) => {
    const view = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, L('View file', 'फ़ाइल देखें'));
    view.addEventListener('click', () => busy(view, async () => {
      const { data, error } = await sb.storage.from('driver-docs').createSignedUrl(x.file_path, 300);
      if (error || !data?.signedUrl) throw new Error(error?.message || L('File not found', 'फ़ाइल नहीं मिली'));
      window.open(data.signedUrl, '_blank', 'noopener');
    }).catch((e) => toast(e.message, 'err')));
    const set = (status, btn) => busy(btn, async () => { await q(sb.from('driver_documents').update({ status }).eq('id', x.id)); toast(status === 'approved' ? L('Document approved', 'दस्तावेज़ मंज़ूर') : L('Document rejected', 'दस्तावेज़ अस्वीकार')); again(); });
    const ok = h('button', { class: 'btn btn-sm', type: 'button' }, L('Approve', 'मंज़ूर')); ok.addEventListener('click', () => set('approved', ok));
    const no = h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button' }, L('Reject', 'अस्वीकार')); no.addEventListener('click', () => set('rejected', no));
    return h('li', { class: 'doc-row' }, h('span', { class: 'grow' }, h('strong', {}, DOCS[x.doc_type] || x.doc_type), x.doc_number ? h('span', { class: 'small muted' }, ` · ${x.doc_number}`) : null,
      x.expires_on ? h('span', { class: 'small muted' }, ` · ${L('valid till', 'वैध')} ${fmtDate(x.expires_on)}`) : null),
      h('span', { class: `pill pill-${x.status === 'approved' ? 'ok' : x.status === 'rejected' ? 'bad' : 'warn'}` }, x.status), view, x.status === 'pending' ? [ok, no] : null);
  };
  const card = (d) => {
    const vs = vehicles.filter((v) => v.owner_id === d.user_id);
    const ds = docs.filter((x) => x.user_id === d.user_id);
    const verify = h('button', { class: d.is_verified ? 'btn btn-ghost btn-sm' : 'btn btn-sm', type: 'button' }, d.is_verified ? L('Remove verification', 'वेरिफ़िकेशन हटाएँ') : L('Verify driver', 'ड्राइवर वेरिफ़ाई करें'));
    verify.addEventListener('click', () => setDriver(d, { is_verified: !d.is_verified }, verify, d.is_verified ? L('Verification removed', 'वेरिफ़िकेशन हटाया') : L('Driver verified. They can publish rides now.', 'ड्राइवर वेरिफ़ाइड। अब वे राइड डाल सकते हैं।')));
    const susp = h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button' }, d.status === 'suspended' ? L('Reinstate', 'फिर से चालू करें') : L('Suspend', 'निलंबित करें'));
    susp.addEventListener('click', () => setDriver(d, { status: d.status === 'suspended' ? 'active' : 'suspended' }, susp, d.status === 'suspended' ? L('Driver reinstated', 'ड्राइवर फिर से चालू') : L('Driver suspended', 'ड्राइवर निलंबित')));
    return h('article', { class: 'panel stack drv-card' },
      h('div', { class: 'drv-head' },
        d.photo_url ? h('img', { class: 'av', src: d.photo_url, alt: '', referrerpolicy: 'no-referrer' }) : h('span', { class: 'av av-txt' }, (d.full_name || '?').slice(0, 2).toUpperCase()),
        h('div', { class: 'grow' }, h('strong', {}, d.full_name), h('div', { class: 'small muted selectable' }, d.phone), h('div', { class: 'small muted' }, `${L('Joined', 'जुड़े')} ${fmtDate(d.created_at)}`)),
        d.status === 'suspended' ? h('span', { class: 'pill pill-bad' }, L('Suspended', 'निलंबित'))
          : d.is_verified ? h('span', { class: 'pill pill-ok' }, '✓ ', L('Verified', 'वेरिफ़ाइड')) : h('span', { class: 'pill pill-warn' }, L('Waiting', 'बाकी'))),
      d.about ? h('p', { class: 'small' }, d.about) : null,
      h('div', { class: 'drv-veh' }, vs.length ? vs.map((v) => h('div', { class: 'veh-row' }, vehicleVisual(v.model, { size: 'sm', variantId: v.variant_id }),
        h('div', { class: 'grow' }, h('strong', {}, v.model), h('div', { class: 'small muted' }, `${v.registration_no} · ${v.seats} ${L('passenger seats', 'यात्री सीटें')}${v.variant_id ? '' : ` · ${L('not from the list: check seats', 'सूची से नहीं: सीटें जाँचें')}`}`))))
        : h('p', { class: 'small muted' }, L('No vehicle added yet.', 'अभी कोई गाड़ी नहीं।'))),
      h('div', {}, h('h3', { class: 'small-h' }, L('Documents', 'दस्तावेज़')),
        ds.length ? h('ul', { class: 'doc-list' }, ds.map(docRow)) : h('p', { class: 'small muted' }, L('No documents uploaded yet. Check the licence and RC in person or over a call before verifying.', 'अभी कोई दस्तावेज़ अपलोड नहीं। वेरिफ़ाई करने से पहले लाइसेंस और RC ख़ुद या कॉल पर जाँचें।'))),
      h('div', { class: 'row-actions' }, verify, susp));
  };
  return h('div', { class: 'stack' },
    h('nav', { class: 'seg-tabs' }, tabs.map(([k, label, n]) => h('a', { href: `/admin/cab?tab=drivers&f=${k}`, class: k === filter ? 'on' : '' }, `${label} (${n})`))),
    shown.length ? h('div', { class: 'drv-grid' }, shown.map(card)) : empty(L('No drivers here.', 'यहाँ कोई ड्राइवर नहीं।'), null, 'car'));
}

// ---------- Vehicle catalog ----------
export async function vehiclesAdmin() {
  resetCatalog();
  const c = await catalog();
  const allImgs = await q(sb.from('vehicle_images').select('*').order('created_at', { ascending: false })).catch(() => []);
  const modelLabel = (id) => c.models.find((m) => m.id === id)?.label || '?';

  // Photos waiting for approval
  const imgAct = (img, status, btn) => busy(btn, async () => { await q(sb.from('vehicle_images').update({ status }).eq('id', img.id)); toast(L('Saved', 'सेव हुआ')); again(); });
  const imgCard = (img) => {
    const ok = h('button', { class: 'btn btn-sm', type: 'button' }, L('Approve', 'मंज़ूर')); ok.addEventListener('click', () => imgAct(img, 'approved', ok));
    const no = h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button' }, img.status === 'approved' ? L('Remove', 'हटाएँ') : L('Reject', 'अस्वीकार')); no.addEventListener('click', () => imgAct(img, 'rejected', no));
    return h('article', { class: 'img-card' }, h('img', { src: img.url, alt: modelLabel(img.model_id), loading: 'lazy', referrerpolicy: 'no-referrer' }),
      h('div', { class: 'small' }, h('strong', {}, modelLabel(img.model_id)), ` · ${img.angle}${img.is_generic ? ` · ${L('representative', 'प्रतिनिधि')}` : ''}`),
      h('div', { class: 'small muted' }, [img.author, img.licence].filter(Boolean).join(' · ') || L('No credit given', 'क्रेडिट नहीं दिया'), img.source_url ? [' · ', h('a', { href: img.source_url, target: '_blank', rel: 'noopener' }, L('source', 'स्रोत'))] : null),
      h('div', { class: 'row-actions' }, h('span', { class: `pill pill-${img.status === 'approved' ? 'ok' : img.status === 'rejected' ? 'bad' : 'warn'}` }, img.status), img.status !== 'approved' ? ok : null, img.status !== 'rejected' ? no : null));
  };

  // Add a photo
  const modelSel = h('select', { class: 'input', id: 'vi-model', required: true }, h('option', { value: '' }, L('Choose model', 'मॉडल चुनें')), c.models.map((m) => h('option', { value: m.id }, m.label)));
  const angleSel = h('select', { class: 'input', id: 'vi-angle' }, [['front_34', L('Front three-quarter', 'आगे से तिरछा')], ['side', L('Side', 'बगल से')], ['rear', L('Rear', 'पीछे से')], ['interior', L('Interior', 'अंदर')], ['dashboard', L('Dashboard', 'डैशबोर्ड')], ['other', L('Other', 'अन्य')]].map(([v, t]) => h('option', { value: v }, t)));
  const urlI = h('input', { class: 'input', id: 'vi-url', type: 'url', placeholder: 'https://upload.wikimedia.org/…', required: true });
  const srcI = h('input', { class: 'input', id: 'vi-src', type: 'url', placeholder: 'https://commons.wikimedia.org/wiki/File:…' });
  const authI = h('input', { class: 'input', id: 'vi-auth', maxlength: 200, placeholder: L('Photographer / owner', 'फ़ोटोग्राफ़र / मालिक') });
  const licI = h('input', { class: 'input', id: 'vi-lic', maxlength: 120, placeholder: 'CC BY-SA 4.0' });
  const genI = h('input', { type: 'checkbox', id: 'vi-gen' }); genI.checked = true;
  const add = h('button', { class: 'btn', type: 'submit' }, L('Add and approve photo', 'फ़ोटो जोड़ें और मंज़ूर करें'));
  const form = h('form', { class: 'panel stack', onsubmit: (e) => { e.preventDefault(); busy(add, async () => {
    if (!modelSel.value || !/^https:\/\//.test(urlI.value)) throw new Error(L('Choose a model and paste an https:// image link.', 'मॉडल चुनें और https:// फ़ोटो लिंक डालें।'));
    if (!licI.value.trim() || !srcI.value.trim()) throw new Error(L('Source page and licence are required, so we only show photos we may use.', 'स्रोत पेज और लाइसेंस ज़रूरी हैं, ताकि सिर्फ़ इस्तेमाल योग्य फ़ोटो दिखें।'));
    await q(sb.from('vehicle_images').insert({ model_id: modelSel.value, angle: angleSel.value, url: urlI.value.trim(), source_url: srcI.value.trim(), author: authI.value.trim(), licence: licI.value.trim(), is_generic: genI.checked, status: 'approved' }));
    toast(L('Photo added', 'फ़ोटो जुड़ गई')); again();
  }).catch((ex) => toast(ex.message, 'err')); } },
    h('h2', {}, L('Add a vehicle photo', 'गाड़ी की फ़ोटो जोड़ें')),
    h('p', { class: 'small muted' }, L('Use Wikimedia Commons (free with credit) or photos you own. Copy the image link, the file page and the licence. Never use Google Images.', 'Wikimedia Commons (क्रेडिट के साथ मुफ़्त) या अपनी फ़ोटो लें। फ़ोटो लिंक, फ़ाइल पेज और लाइसेंस कॉपी करें। Google Images से कभी नहीं।')),
    h('div', { class: 'row2' }, h('label', { class: 'field', for: 'vi-model' }, h('span', { class: 'field-label' }, L('Model', 'मॉडल')), modelSel), h('label', { class: 'field', for: 'vi-angle' }, h('span', { class: 'field-label' }, L('View', 'कोण')), angleSel)),
    h('label', { class: 'field', for: 'vi-url' }, h('span', { class: 'field-label' }, L('Image link', 'फ़ोटो लिंक')), urlI),
    h('label', { class: 'field', for: 'vi-src' }, h('span', { class: 'field-label' }, L('Source page', 'स्रोत पेज')), srcI),
    h('div', { class: 'row2' }, h('label', { class: 'field', for: 'vi-auth' }, h('span', { class: 'field-label' }, L('Author', 'लेखक')), authI), h('label', { class: 'field', for: 'vi-lic' }, h('span', { class: 'field-label' }, L('Licence', 'लाइसेंस')), licI)),
    h('label', { class: 'check' }, genI, h('span', {}, L('Representative photo (not the exact year/variant)', 'प्रतिनिधि फ़ोटो (सटीक साल/वेरिएंट नहीं)'))), add);

  // Seat layouts to check
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Search model', 'मॉडल खोजें'), 'aria-label': L('Search model', 'मॉडल खोजें') });
  const table = h('div', { class: 'vc-list' });
  const paint = () => {
    const t = search.value.trim().toLowerCase();
    clear(table);
    c.models.filter((m) => !t || m.label.toLowerCase().includes(t)).forEach((m) => {
      const vs = c.variants.filter((v) => v.model_id === m.id);
      table.append(h('div', { class: 'vc-row' }, vehicleVisual(m.label, { size: 'sm', model: m }),
        h('div', { class: 'grow' }, h('strong', {}, m.label), h('div', { class: 'small muted' }, `${m.category} · ${allImgs.filter((i) => i.model_id === m.id && i.status === 'approved').length} ${L('photos', 'फ़ोटो')}`)),
        h('div', { class: 'vc-vars' }, vs.map((v) => {
          const b = h('button', { type: 'button', class: `chip-btn${v.is_verified ? ' on' : ''}`, title: v.is_verified ? L('Seats checked', 'सीटें जाँची गईं') : L('Tap after checking the seats', 'सीटें जाँचकर दबाएँ') },
            `${v.variant}: ${v.passenger_seats} ${L('seats', 'सीट')} ${v.is_verified ? '✓' : '?'}`);
          b.addEventListener('click', () => busy(b, async () => { await q(sb.from('vehicle_variants').update({ is_verified: !v.is_verified }).eq('id', v.id)); v.is_verified = !v.is_verified; paint(); }));
          return b;
        }))));
    });
  };
  search.addEventListener('input', paint); paint();
  const unchecked = c.variants.filter((v) => !v.is_verified).length;
  const pending = allImgs.filter((i) => i.status === 'pending');
  return h('div', { class: 'stack' },
    h('div', { class: 'soft-note' }, icon('car', 18), `${c.makes.length} ${L('companies', 'कंपनियाँ')} · ${c.models.length} ${L('models', 'मॉडल')} · ${unchecked} ${L('seat layouts still to check', 'सीट व्यवस्था जाँचनी बाकी')} · ${allImgs.filter((i) => i.status === 'approved').length} ${L('approved photos', 'मंज़ूर फ़ोटो')}`),
    pending.length ? h('section', { class: 'stack' }, h('h2', {}, L('Photos waiting for approval', 'मंज़ूरी के लिए फ़ोटो')), h('div', { class: 'img-grid' }, pending.map(imgCard))) : null,
    form,
    h('section', { class: 'stack' }, h('h2', {}, L('Models and seat layouts', 'मॉडल और सीट व्यवस्था')),
      h('p', { class: 'small muted' }, L('Seats shown are typical layouts. Tap a layout after you have checked it (✓). Drivers can never publish more seats than the layout allows.', 'दिखाई सीटें सामान्य व्यवस्था हैं। जाँचने के बाद व्यवस्था दबाएँ (✓)। ड्राइवर इससे ज़्यादा सीटें कभी नहीं डाल सकते।')),
      search, table),
    allImgs.some((i) => i.status === 'approved') ? h('section', { class: 'stack' }, h('h2', {}, L('Approved photos', 'मंज़ूर फ़ोटो')), h('div', { class: 'img-grid' }, allImgs.filter((i) => i.status === 'approved').map(imgCard))) : null);
}

import { badge, inr } from '../ui';
import { t, pick } from '../i18n';
import { locations, locationById } from '../store';
export async function rides() {
  await locations();
  const rows = await q(sb.from('cab_rides').select('*, partners(business_name, phone), cab_bookings(id,status,seats,passenger_name,phone)').order('departure_at', { ascending: false }).limit(200));
  if (!rows.length) return empty();
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((r) => {
      const f = locationById(r.from_location_id); const to = locationById(r.to_location_id);
      return h('tr', {},
        h('td', {}, h('strong', {}, `${f ? pick(f, 'name') : '?'} → ${to ? pick(to, 'name') : '?'}`), h('div', { class: 'muted small' }, fmtDate(r.departure_at, true))),
        h('td', {}, r.partners?.business_name, h('div', { class: 'muted small' }, r.vehicle_model)),
        h('td', {}, `${r.seats_booked}/${r.seats_total}`, h('div', { class: 'muted small' }, `${inr(r.price_per_seat)} ${t('per_seat')}`)),
        h('td', {}, badge(r.status)),
        h('td', { class: 'right' }, r.status === 'open' || r.status === 'full'
          ? h('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => busy(e.currentTarget, async () => { await q(sb.from('cab_rides').update({ status: 'cancelled' }).eq('id', r.id)); location.reload(); }) }, t('cancel')) : null));
    }))));
}

