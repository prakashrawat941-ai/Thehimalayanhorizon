// Traveller reviews on a destination page. Shown only after admin approval.
import { h, toast, busy } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb } from '../sb.js';
import { user } from '../store.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);

export async function reviewsBox(loc) {
  const res = await sb.from('destination_reviews').select('id,rating,body,status,user_id,created_at').eq('location_id', loc.id).order('created_at', { ascending: false }).limit(30);
  if (res.error) return null; // database update not applied yet
  const me = user();
  const approved = res.data.filter((r) => r.status === 'approved');
  const mine = me ? res.data.find((r) => r.user_id === me.id) : null;
  const box = h('section', { class: 'section rv-box' }, h('h2', {}, L('Traveller reviews', 'यात्रियों के रिव्यू')));
  if (approved.length) {
    const avg = approved.reduce((s, r) => s + r.rating, 0) / approved.length;
    box.append(h('p', { class: 'rv-avg' }, h('strong', {}, avg.toFixed(1)), ` ★ · ${approved.length} ${L(approved.length > 1 ? 'reviews' : 'review', 'रिव्यू')}`));
    approved.forEach((r) => box.append(h('blockquote', { class: 'rv-item' }, h('span', { class: 'rv-stars', 'aria-label': `${r.rating} / 5` }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)), r.body ? h('p', {}, r.body) : null)));
  } else box.append(h('p', { class: 'muted' }, L('No reviews yet.', 'अभी कोई रिव्यू नहीं।')));
  if (!me) { box.append(h('p', { class: 'small' }, h('a', { href: `#/login?next=place/${loc.slug}` }, L('Log in to write a review', 'रिव्यू लिखने के लिए लॉगिन करें')))); return box; }
  if (mine) box.append(h('p', { class: 'soft-note' }, mine.status === 'approved' ? L('Thanks — your review is live.', 'धन्यवाद — आपका रिव्यू दिख रहा है।') : mine.status === 'rejected' ? L('Your review was not approved.', 'आपका रिव्यू मंज़ूर नहीं हुआ।') : L('Thanks — your review will appear after it is checked.', 'धन्यवाद — जाँच के बाद आपका रिव्यू दिखेगा।')));
  let rating = mine?.rating || 0;
  const stars = h('div', { class: 'rv-pick', role: 'radiogroup', 'aria-label': L('Your rating', 'आपकी रेटिंग') }, [1, 2, 3, 4, 5].map((n) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(n === rating), 'aria-label': `${n} / 5`, onclick: () => { rating = n; [...stars.children].forEach((x, i) => { x.textContent = i < n ? '★' : '☆'; x.setAttribute('aria-checked', String(i + 1 === n)); }); } }, n <= rating ? '★' : '☆');
    return b;
  }));
  const text = h('textarea', { class: 'input', rows: 3, maxlength: 2000, placeholder: L('What should other travellers know?', 'दूसरे यात्रियों को क्या पता होना चाहिए?'), 'aria-label': L('Your review', 'आपका रिव्यू') });
  text.value = mine?.body || '';
  const send = h('button', { type: 'submit', class: 'btn' }, mine ? L('Update review', 'रिव्यू बदलें') : L('Send review', 'रिव्यू भेजें'));
  box.append(h('form', { class: 'rv-form', onsubmit: (e) => { e.preventDefault();
    if (!rating) { toast(L('Choose a star rating', 'स्टार रेटिंग चुनें'), 'warn'); return; }
    busy(send, async () => {
      const row = { location_id: loc.id, rating, body: text.value.trim() };
      const r = mine ? await sb.from('destination_reviews').update(row).eq('id', mine.id) : await sb.from('destination_reviews').insert(row);
      if (r.error) throw r.error;
      toast(L('Thanks! Your review will appear after it is checked.', 'धन्यवाद! जाँच के बाद आपका रिव्यू दिखेगा।'));
    });
  } }, stars, text, send));
  return box;
}
