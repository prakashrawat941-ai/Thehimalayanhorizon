'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cover } from '../Cover';
import { imgUrl } from '@/lib/img';

/** Photo grid (1 big + up to 4 small) with a full-screen viewer. Falls back to drawn art when there is no photo. */
export function Gallery({ images, seed, lang, name }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [open, setOpen] = useState(-1);
  const box = useRef(null);
  const n = images.length;
  useEffect(() => {
    if (open < 0) return undefined;
    const prev = document.activeElement;
    box.current?.querySelector('button')?.focus();
    const key = (e) => {
      if (e.key === 'Escape') setOpen(-1);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % n);
      if (e.key === 'ArrowLeft') setOpen((i) => (i + n - 1) % n);
      if (e.key === 'Tab' && box.current) { // keep focus inside the viewer
        const els = [...box.current.querySelectorAll('button')];
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, n]);
  if (!n) return <div className="st-gal st-gal-1"><Cover url={null} seed={seed} className="st-gal-img" eager /></div>;
  const shown = images.slice(0, 5);
  return (
    <>
      <div className={`st-gal st-gal-${shown.length}`}>
        {shown.map((u, i) => (
          <button key={u} type="button" className={`st-gal-btn g${i + 1}`} onClick={() => setOpen(i)} aria-label={L(`Open photo ${i + 1} of ${n}`, `फ़ोटो ${i + 1} / ${n} खोलें`)}>
            <Cover url={u} seed={`${seed}-${i}`} className="st-gal-img" eager={i === 0} />
          </button>
        ))}
        {n > 1 ? <button type="button" className="st-gal-all" onClick={() => setOpen(0)}>⊞ {L(`All ${n} photos`, `सभी ${n} फ़ोटो`)}</button> : null}
      </div>
      {open >= 0 && typeof document !== 'undefined' ? createPortal(
        <div className="st-lb" role="dialog" aria-modal="true" aria-label={L(`Photos of ${name}`, `${name} की फ़ोटो`)} ref={box}>
          <header><span>{open + 1} / {n}</span><button type="button" className="st-x" onClick={() => setOpen(-1)} aria-label={L('Close', 'बंद करें')}>✕</button></header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="st-lb-img"><img src={imgUrl(images[open]) || images[open]} alt={L(`Photo ${open + 1}`, `फ़ोटो ${open + 1}`)} /></div>
          {n > 1 ? <footer>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((open + n - 1) % n)}>‹ {L('Previous', 'पिछली')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((open + 1) % n)}>{L('Next', 'अगली')} ›</button>
          </footer> : null}
        </div>, document.body,
      ) : null}
    </>
  );
}
