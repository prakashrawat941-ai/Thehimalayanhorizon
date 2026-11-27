'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Floating WhatsApp button with ready-made first messages. Renders only when the admin has set
 * a WhatsApp number (Settings → contact.whatsapp, with country code). Opens wa.me in a new tab.
 */
export function WhatsAppButton({ number, labels, messages }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const digits = String(number || '').replace(/\D/g, '');
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (digits.length < 10) return null;
  return (
    <div className="hx-wa" ref={box}>
      {open ? (
        <div className="hx-wa-sheet" role="dialog" aria-label={labels.title}>
          <h3>{labels.title}</h3><p>{labels.sub}</p>
          <div className="hx-wa-qs">{messages.map((m) => (
            <a key={m} href={`https://wa.me/${digits}?text=${encodeURIComponent(m)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{m} →</a>
          ))}</div>
        </div>
      ) : null}
      <button type="button" className="hx-wa-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5 0a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z" /></svg>
        <span>{labels.button}</span>
      </button>
    </div>
  );
}
