// Dashboard shell shared by admin, partner and customer areas:
// a grouped sidebar on laptops and a scrolling section strip on phones.
import { h, icon } from './ui.js';

// groups: [{ label, items: [{ key, href, icon, label, count }] }]
export function dashShell({ title, subtitle, eyebrow, avatar, groups, active, actions, body, brand = 'The Himalayan Horizon' }) {
  const items = groups.flatMap((g) => g.items);
  const link = (it, cls) => h('a', { class: `${cls}${it.key === active ? ' on' : ''}`, href: it.href, 'aria-current': it.key === active ? 'page' : null },
    icon(it.icon || 'grid', 19), h('span', { class: 'ds-label' }, it.label), it.count ? h('span', { class: 'ds-count', 'aria-label': `${it.count}` }, String(it.count)) : null);
  const side = h('aside', { class: 'ds-side', 'aria-label': title },
    h('div', { class: 'ds-brand' }, h('img', { src: 'img/brand/mark.png', alt: '', width: 34, height: 32 }), h('span', {}, brand)),
    groups.map((g) => h('nav', { class: 'ds-group' }, g.label ? h('p', { class: 'ds-glabel' }, g.label) : null, g.items.map((it) => link(it, 'ds-link')))));
  const strip = h('nav', { class: 'ds-strip', 'aria-label': title }, items.map((it) => link(it, 'ds-chip')));
  const head = h('header', { class: 'ds-head' },
    avatar || null,
    h('div', { class: 'grow' }, eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null, h('h1', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    actions ? h('div', { class: 'ds-actions' }, actions) : null);
  const page = h('div', { class: 'ds' }, side, h('div', { class: 'ds-main' }, head, strip, h('div', { class: 'ds-body' }, body)));
  // Keep the active chip in view on phones.
  requestAnimationFrame(() => strip.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  return page;
}

export const statCard = (iconName, label, value, href, tone = '') => h(href ? 'a' : 'div', { class: `ds-stat ${tone}`, href: href || null },
  h('span', { class: 'ds-stat-l' }, icon(iconName, 18), label), h('strong', { class: 'ds-stat-n' }, String(value)));
