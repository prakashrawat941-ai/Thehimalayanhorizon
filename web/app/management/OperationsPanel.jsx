'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function OperationsPanel({ role, lang, rows, staff, partners, userId }) {
  const ceo = role === 'ceo';
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [view, setView] = useState('list');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const groups = ceo ? [
    ['initiative', L('Projects','परियोजनाएँ')], ['task', L('Tasks','कार्य')],
    ['operation', L('Operations','संचालन')], ['email', L('Mail follow-ups','ईमेल फ़ॉलो-अप')],
  ] : [
    ['assigned', L('Assigned to me','मेरे कार्य')], ['cms', L('Website CMS','वेबसाइट सामग्री')],
    ['partner', L('Partner reviews','पार्टनर समीक्षा')], ['release', L('Releases','रिलीज़')],
  ];
  const matches = (r, key) => key === 'assigned' ? r.assignee === userId : r.kind === key;
  const filtered = rows.filter(r => (filter === 'all' || matches(r,filter)) && r.subject.toLowerCase().includes(query.toLowerCase()));
  const statuses = {open:L('Open','खुला'),completed:L('Completed','पूरा'),approved:L('Approved','स्वीकृत'),returned:L('Returned','वापस')};
  const empty = <p>{L('No matching records on this page.','इस पृष्ठ पर कोई मिलान नहीं है।')}</p>;
  const renderRow = r => <li key={r.id}><a href={'#work-'+r.id}>{r.subject}</a><small>{[statuses[r.status] || r.status,r.due_date].filter(Boolean).join(' · ')}</small></li>;
  const byDate = [...filtered].sort((a,b)=>(a.due_date || '9999').localeCompare(b.due_date || '9999'));
  return <section className="ops-panel" id="operations">
    <h2>{ceo ? L('Management & execution','प्रबंधन और संचालन') : L('Technology & partners','तकनीक और पार्टनर')}</h2>
    <p>{L('Work on this page','इस पृष्ठ के कार्य')}</p>
    <div className="ops-metrics">{groups.map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(filter===key?'all':key)}><small>{label}</small><strong>{rows.filter(r=>matches(r,key)).length}</strong></button>)}</div>
    <div className="ops-columns"><div>
      <h3>{ceo ? L('Execution board','कार्य प्रगति') : L('Technical work','तकनीकी कार्य')}</h3>
      <label>{L('Find work','कार्य खोजें')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="ops-views">{[['list',L('List','सूची')],['board',L('Kanban','कानबन')],['calendar',L('Calendar','कैलेंडर')],['timeline',L('Timeline','समयरेखा')]].map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</div>
      {!filtered.length ? empty : view==='board' ? <div className="ops-board">{Object.entries(statuses).map(([k,label])=><div key={k}><b>{label}</b><ul>{filtered.filter(r=>r.status===k).map(renderRow)}</ul></div>)}</div>
      : view==='calendar' ? [...new Set(byDate.map(r=>r.due_date || ''))].map(day=><div key={day}><b>{day || L('Unscheduled','तिथि लंबित')}</b><ul>{byDate.filter(r=>(r.due_date || '')===day).map(renderRow)}</ul></div>)
      : <ul className={view==='timeline'?'ops-line':''}>{(view==='timeline'?byDate:filtered).map(renderRow)}</ul>}
    </div><aside>
      <h3>{ceo ? L('Team directory','टीम सूची') : L('Partner applications','पार्टनर आवेदन')}</h3>
      <ul>{ceo ? staff.map(s=><li key={s.user_id}>{s.display_name || L('Team member','टीम सदस्य')}<small>{s.office}</small></li>) : partners.map(p=><li key={p.id}>{p.business_name}<small>{p.village}</small></li>)}</ul>
      {!(ceo?staff:partners).length && <p>{ceo?L('No team members yet.','अभी कोई सदस्य नहीं है।'):L('No pending applications.','कोई लंबित आवेदन नहीं है।')}</p>}
      <h3>{L('Quick actions','त्वरित कार्य')}</h3>
      <a href="#new-entry">{ceo?L('Create task or operation','कार्य प्रविष्टि बनाएँ'):L('Submit partner or release review','समीक्षा के लिए भेजें')}</a>
      {ceo?<a href="#team">{L('Manage employees','कर्मचारी प्रबंधन')}</a>:<Link href="/co-founder/cms">{L('Edit website','वेबसाइट संपादित करें')}</Link>}
    </aside></div>
  </section>;
}
