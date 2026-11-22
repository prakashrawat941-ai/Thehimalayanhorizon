'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { hasContent, loadDraft } from '@/lib/trip/common';

export function DraftResume({ label }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(hasContent(loadDraft())); }, []);
  return show ? <Link className="btn btn-ghost btn-lg" href="/plan/new">{label}</Link> : null;
}
