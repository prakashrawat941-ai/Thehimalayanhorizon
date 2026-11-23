'use client';
import { useState } from 'react';
import { artSvg } from './Art';
import { imgUrl } from '@/lib/img';
// Bundled stand-in photos for places that have no photo in the database yet.
const LOCAL = {
    almora: '/img/places/almora.jpg', jageshwar: '/img/places/jageshwar.jpg',
    binsar: '/img/places/binsar.jpg', munsiyari: '/img/places/munsiyari.jpg',
};
export function Cover({ url, seed, className = 'cover', eager = false }) {
    const [failed, setFailed] = useState(false);
    const src = imgUrl(url) || LOCAL[seed] || null;
    if (!src || failed)
        return <div className={`art ${className}`} dangerouslySetInnerHTML={{ __html: artSvg(seed) }}/>;
    return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>);
}
