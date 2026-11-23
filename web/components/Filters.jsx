import Link from 'next/link';
/** Filter pills that are plain links (work without JavaScript and are crawlable). */
export function FilterPills({ base, params, name, options }) {
    const cur = params[name] || '';
    const hrefFor = (v) => {
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, val]) => { if (val && k !== name)
            p.set(k, val); });
        if (v)
            p.set(name, v);
        const s = p.toString();
        return s ? `${base}?${s}` : base;
    };
    return (<div className="filters">
      {options.map(([v, label]) => (<Link key={v || 'all'} href={hrefFor(v)} className={`pill${cur === v ? ' active' : ''}`} aria-current={cur === v ? 'true' : undefined} scroll={false}>{label}</Link>))}
    </div>);
}
