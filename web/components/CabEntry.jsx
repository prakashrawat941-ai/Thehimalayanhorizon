import Link from 'next/link';
import { Icon } from './Icon';
import { getSession } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';

export default async function CabEntry() {
  const [{user}, {L}] = await Promise.all([getSession(), getT()]);
  const choices = [
    ['/cab/me', 'user', L('I am a traveller', 'मैं यात्री हूँ'), L('Find a ride and choose your seats.', 'राइड खोजें और अपनी सीटें चुनें।')],
    ['/drive', 'car', L('I am a driver', 'मैं ड्राइवर हूँ'), L('Publish a ride and manage your journeys.', 'राइड पब्लिश करें और अपनी यात्राएँ सँभालें।')],
  ];
  return <div className="cab-entry">
    <section className="cab-entry-hero">
      <img src="/img/home/q-cab.jpg" alt=""/>
      <div className="wrap"><h1>{L('Share a ride in the hills','पहाड़ों में राइड शेयर करें')}</h1>
        <p>{L('Find a seat on a local journey or publish your own ride.', 'स्थानीय यात्रा में सीट खोजें या अपनी राइड पब्लिश करें।')}</p></div>
    </section>
    <div className="wrap choice-grid">{choices.map(([path,icon,title,summary]) =>
      <Link className="choice-card" key={path} href={user ? path : '/login?next=' + encodeURIComponent(path)}>
        <span className="choice-ico"><Icon name={icon} size={30}/></span>
        <span className="choice-text"><strong>{title}</strong><span>{summary}</span></span>
      </Link>)}</div>
    <div className="wrap cab-entry-note"><Link href="/cab/find">{L('Browse rides without signing in','बिना लॉगिन राइड खोजें')}</Link></div>
  </div>;
}
