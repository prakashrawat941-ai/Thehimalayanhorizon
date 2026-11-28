'use client';
import { useState,useTransition } from 'react';
import { recordAttendance } from '@/app/(management)/management/dashboard-actions';
export default function Attendance({lang}) {
 const L=(en,hi)=>lang==='hi'?hi:en;
 const [busy,start]=useTransition();const [result,setResult]=useState(null);
 return <section className="dsx-card"><h2>{L('Attendance today','आज की उपस्थिति')}</h2>
 <p>{L('Submit once per day when you start at your village office. Time is recorded in IST.','ग्राम कार्यालय में शुरू करते समय दिन में एक बार दर्ज करें। समय IST में दर्ज होता है।')}</p>
 <button className="btn" disabled={busy} onClick={()=>start(async()=>{const r=await recordAttendance();setResult(r);})}>{L('Check in','उपस्थिति दर्ज करें')}</button>
 {result?<p role={result.ok?'status':'alert'}>{result.ok?L('Check-in recorded.','उपस्थिति दर्ज हुई।'):result.message}</p>:null}</section>;
}
