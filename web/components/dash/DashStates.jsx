'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Icon } from '@/components/Icon';
import '@/app/dash.css';

// Shared loading / empty / error / not-connected / MFA states for every dashboard screen.
export function DashSkeleton({ rows = 5, label = 'Loading' }) {
  return <div className="dsx-skel" role="status" aria-label={label}>{Array.from({ length: rows }, (_, i) => <i key={i} />)}</div>;
}

export function DashEmpty({ title, text, action = null }) {
  return (
    <div className="dsx-state">
      <span className="dsx-state-ic ok"><Icon name="check" size={26} /></span>
      <h3>{title}</h3>{text ? <p>{text}</p> : null}{action}
    </div>
  );
}

export function DashError({ title, text, retry }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <div className="dsx-state" role="alert">
      <span className="dsx-state-ic bad"><Icon name="alert" size={26} /></span>
      <h3>{title}</h3>{text ? <p>{text}</p> : null}
      <button type="button" className="btn" disabled={busy} onClick={() => start(() => router.refresh())}>{retry}</button>
    </div>
  );
}

/** Shown where the screen's data source is not live yet. Never replaced by sample data. */
export function DashNotConnected({ title, text }) {
  return (
    <div className="dsx-state">
      <span className="dsx-state-ic info"><Icon name="layers" size={26} /></span>
      <h3>{title}</h3>{text ? <p>{text}</p> : null}
    </div>
  );
}

/** Two-step verification gate. The real check (aal2) and the code form belong to the server. */
export function DashMfaNeeded({ title, text, children }) {
  return (
    <div className="dsx-state dsx-mfa">
      <span className="dsx-state-ic info"><Icon name="shield" size={26} /></span>
      <h3>{title}</h3>{text ? <p>{text}</p> : null}{children}
    </div>
  );
}
