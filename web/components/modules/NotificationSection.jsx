import Link from 'next/link';
import { MarkRead } from '@/components/account/MarkRead';

const approvalPath = {
  founder: '/founder/approval-center',
  ceo: '/ceo/approval-center',
  co_founder: '/co-founder/approval-center',
};

export function NotificationSection({ inbox, role, lang }) {
  const L = (en, hi) => lang === 'hi' ? hi : en;
  if (!inbox?.connected) return <p role="alert">{L('Notifications are unavailable.', 'सूचनाएँ उपलब्ध नहीं हैं।')}</p>;
  if (!inbox.rows.length) return <p>{L('No notifications yet.', 'अभी कोई सूचना नहीं है।')}</p>;

  const unread = inbox.rows.filter(({ read_at }) => !read_at).map(({ id }) => id);
  const format = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });

  return <>
    <MarkRead ids={unread} />
    <ul className="ui-timeline">
      {inbox.rows.map((row) => <li key={row.id}>
        <strong>{row.link === approvalPath[role] ? <Link href={row.link}>{row.title}</Link> : row.title}</strong>
        {!row.read_at && <span> · {L('Unread', 'अपठित')}</span>}
        {row.body && <p>{row.body}</p>}
        <time dateTime={row.created_at}>{format.format(new Date(row.created_at))}</time>
      </li>)}
    </ul>
  </>;
}
