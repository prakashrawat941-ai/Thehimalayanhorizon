'use client';

export function PrintButton({ label }) {
  return <button type="button" className="btn" onClick={() => window.print()}>{label}</button>;
}
