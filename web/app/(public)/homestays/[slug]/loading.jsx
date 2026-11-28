import '@/app/stay.css';

export default function Loading() {
  return (
    <div className="page st-page" role="status" aria-live="polite" aria-label="Loading · लोड हो रहा है">
      <div className="st-gal st-gal-1" style={{ background: 'var(--sage)' }} />
      <div style={{ display: 'grid', gap: 12, marginTop: 18, maxWidth: 640 }}>
        <span className="st-skel" style={{ width: '35%' }} /><span className="st-skel" style={{ width: '75%', height: 26 }} />
        <span className="st-skel" /><span className="st-skel" style={{ width: '90%' }} /><span className="st-skel" style={{ height: 70 }} />
      </div>
    </div>
  );
}
