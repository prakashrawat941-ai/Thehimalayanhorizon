'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvite } from '../dashboard-actions';
export default function InviteAccept({lang}) {
 const L=(en,hi)=>lang==='hi'?hi:en;
 const [busy,start]=useTransition();const [error,setError]=useState('');const router=useRouter();
 return <section className="dsx-card"><h1>{L('Join The Himalayan Horizon team','द हिमालयन होराइजन की टीम में शामिल हों')}</h1>
 <p>{L('Sign in using the email that received this invitation. Your team dashboard requires two-step verification.','आमंत्रण वाले ईमेल से साइन इन करें। आपके टीम डैशबोर्ड के लिए दो-चरण सत्यापन ज़रूरी है।')}</p>
 <button className="btn" disabled={busy} onClick={()=>start(async()=>{ const r=await acceptInvite();if(r.ok) router.push(r.path);else setError(r.message); })}>{L('Accept invitation','आमंत्रण स्वीकार करें')}</button>
 {error?<p role="alert">{error}</p>:null}</section>;
}
