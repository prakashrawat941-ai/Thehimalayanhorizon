'use client';
export default function Error({ reset }) {
    return (<div className="page narrow">
      <div className="error-box" role="alert">
        <strong>Something went wrong · कुछ गड़बड़ हुई</strong>
        <p>Please try again. · कृपया फिर कोशिश करें।</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Try again · फिर कोशिश करें</button>
      </div>
    </div>);
}
