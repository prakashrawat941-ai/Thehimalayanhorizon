'use client';
// Shown when a partner page fails to load. Nothing was changed, so retrying is safe.
export default function PartnerError({ reset }) {
  return (
    <div className="pp-state" role="alert">
      <h2>Couldn&apos;t load this page · यह पेज लोड नहीं हुआ</h2>
      <p>Check your connection and try again. Nothing was changed. · इंटरनेट देखकर फिर कोशिश करें। कुछ भी बदला नहीं गया।</p>
      <button type="button" className="btn" onClick={reset}>Try again · फिर कोशिश करें</button>
    </div>
  );
}
