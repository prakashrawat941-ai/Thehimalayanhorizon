'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { EmptyState } from './States';

const DEFAULT_W = 600;
const DEFAULT_H = 220;
const PAD = { top: 14, right: 12, bottom: 28, left: 44 };

/** Round a max up to a "nice" axis ceiling. */
export function niceMax(max) {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function formatCompact(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(n);
}

/**
 * Dependency-free bar / line chart in SVG. Draws only the data it is given.
 * data: [{ label, value }]  (value null/undefined renders a gap, never zero)
 * Accessible: role="img" with a title, plus a visually hidden data table with the same numbers.
 * Colours come from tokens (--ui-chart-1/2) so light and dark both work.
 */
export function Chart({ type = 'bar', data = [], title, description, format = formatCompact, emptyTitle = 'No data to chart yet', height = DEFAULT_H }) {
  const uid = useId();
  const box = useRef(null);
  const [W, setW] = useState(DEFAULT_W);
  const H = height;
  // Draw at the real pixel width so text and strokes are never stretched on narrow screens.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const points = data.filter((d) => d && typeof d.label === 'string');
  const values = points.map((d) => (typeof d.value === 'number' && Number.isFinite(d.value) ? d.value : null));
  const real = values.filter((v) => v !== null);
  if (real.length === 0) return <EmptyState icon="dashboard" title={emptyTitle} />;

  const top = niceMax(Math.max(...real, 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const y = (v) => PAD.top + innerH - (v / top) * innerH;
  const x = (i) => PAD.left + slot * i + slot / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);

  let linePath = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    linePath += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });

  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64))));
  return (
    <figure className="ui-chart" ref={box}>
      {title ? <figcaption className="ui-chart-title">{title}</figcaption> : null}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-labelledby={`${uid}-t`} aria-describedby={description ? `${uid}-d` : undefined}>
        <title id={`${uid}-t`}>{title || 'Chart'}</title>
        {description ? <desc id={`${uid}-d`}>{description}</desc> : null}
        {ticks.map((t) => (
          <g key={t}>
            <line className="ui-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="ui-chart-axis" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {type === 'bar'
          ? values.map((v, i) => v === null ? null : (
            <rect key={i} className="ui-chart-bar" x={x(i) - Math.min(slot * 0.6, 40) / 2} width={Math.min(slot * 0.6, 40)} y={y(v)} height={Math.max(0, PAD.top + innerH - y(v))} rx="3" />
          ))
          : (
            <>
              <path className="ui-chart-line" d={linePath.trim()} fill="none" />
              {values.map((v, i) => v === null ? null : <circle key={i} className="ui-chart-dot" cx={x(i)} cy={y(v)} r="3.5" />)}
            </>
          )}
        {points.map((d, i) => (i % labelEvery === 0 ? (
          <text key={d.label + i} className="ui-chart-axis" x={x(i)} y={H - 8} textAnchor="middle">{d.label}</text>
        ) : null))}
      </svg>
      {/* Wrapper clips the table: a <table> ignores overflow/size on itself and would stretch the page. */}
      <div className="ui-sr-only">
        <table>
          <caption>{title || 'Chart data'}</caption>
          <tbody>
            {points.map((d, i) => <tr key={d.label + i}><th scope="row">{d.label}</th><td>{values[i] === null ? '—' : values[i]}</td></tr>)}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
