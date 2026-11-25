import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireUser } from '@/lib/account';
import { labels, decisions } from '@/lib/management/catalog';
import { saveWork, bookStay, inviteLeader, acceptLeadershipInvitation } from './actions';
import { randomUUID } from 'node:crypto';
import { APP_VERSION } from '@/lib/config';
import EntryForm from './EntryForm';
import OperationsPanel from './OperationsPanel';
import Mfa from './Mfa';
import './workspace.css';
export async function Workspace({ expected, searchParams }) {
  const { db, user } = await requireUser('/management');
  const { lang, L } = await getT();
  const { data: member, error } = await db
    .from('management_members')
    .select('role,office')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw Error('Management directory unavailable');
  const sp = (await searchParams) || {};
  if (!member && !expected) return (
    <div className="mgmt"><section>
      <h1>{L('Leadership invitation', 'नेतृत्व आमंत्रण')}</h1>
      <p>{L('Sign in with your invited email and accept your invitation.', 'आमंत्रित ईमेल से प्रवेश करके आमंत्रण स्वीकार करें।')}</p>
      {sp.invite === 'missing' && <p role="alert">{L('No active invitation for this verified account.', 'इस सत्यापित खाते के लिए सक्रिय आमंत्रण नहीं मिला।')}</p>}
      <form action={acceptLeadershipInvitation}><button>{L('Accept invitation', 'आमंत्रण स्वीकार करें')}</button></form>
    </section></div>
  );
  if (!member || (expected && expected !== member.role)) notFound();
  const assurance = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel !== 'aal2') return <Mfa lang={lang} />;
  const page = Math.max(0, Math.min(100000, parseInt(sp.page, 10) || 0));
  const [work, staff, finance, partners, summary, rooms] = await Promise.all([
    db
      .from('management_work')
      .select('*,management_events(action,note,happened_at,actor)')
      .order('created_at', { ascending: false })
      .order('id')
      .range(page * 20, page * 20 + 20),
    member.role === 'ceo'
      ? db
          .from('management_members')
          .select('user_id,office,display_name,role')
          .in('role', ['employee','co_founder'])
          .order('office')
      : {},
    member.role === 'founder' ? db.rpc('management_finance').single() : {},
    member.role === 'co_founder' ? db.rpc('management_partner_queue') : {},
    db.rpc('management_counts'),
    member.role === 'employee'
      ? db
          .from('homestay_rooms')
          .select('id,room_type,homestays!inner(name,status)')
          .eq('is_active', true)
          .eq('homestays.status', 'approved')
          .order('room_type')
      : {},
  ]);
  if (
    work.error ||
    staff.error ||
    finance.error ||
    partners.error ||
    summary.error ||
    rooms.error
  )
    throw Error('Workspace records unavailable');
  const requestKey = randomUUID();
  const title = (k) => L(...labels[k]);
  const leadership = member.role !== 'employee';
  const destinations = [
    ['#overview', L('Overview', 'सारांश')],
    ['#new-entry', L('New entry', 'नई प्रविष्टि')],
    ['#work', L('Work and approvals', 'कार्य और मंज़ूरी')],
    ...(member.role === 'founder' ? [['#finance', L('Finance', 'वित्त')]] : []),
    ...(member.role === 'ceo' ? [['#team', L('Team', 'टीम')]] : []),
    ...(member.role === 'co_founder' ? [['/co-founder/cms', title('cms')]] : []),
    ['/account', L('Profile', 'प्रोफ़ाइल')],
  ];
  return (
    <div className={leadership ? 'mgmt leadership' : 'mgmt'}>
      {leadership && <nav className="leadership-nav" aria-label={title(member.role)}>
        <b>The Himalayan Horizon</b>
        {destinations.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>}
      <div className="management-content" id="overview">
      <header className={member.role === 'co_founder' ? 'ops-partner-banner' : undefined}>
        <p>{member.office}</p>
        <h1>{title(member.role)}</h1>
      </header>
      {['ceo','co_founder'].includes(member.role) && <OperationsPanel
        role={member.role} lang={lang} rows={work.data.slice(0,20)}
        staff={staff.data || []} partners={partners.data || []} userId={user.id}
      />}
      {sp.result && (
        <p role="status">
          {sp.result === 'saved'
            ? L('Record saved', 'रिकॉर्ड सुरक्षित है')
            : L(
                'Could not save. Check permissions, amount and duplicate attendance or report.',
                'सहेज नहीं सके। अनुमति, राशि और दोहरी उपस्थिति या रिपोर्ट जाँचें।',
              )}
        </p>
      )}
      {member.role === 'founder' && <section>
        <h2>{L('Invite leadership', 'नेतृत्व को आमंत्रित करें')}</h2>
        <form action={inviteLeader}>
          <label>{L('Email', 'ईमेल')}<input name="email" type="email" required maxLength={254} /></label>
          <label>{L('Role', 'भूमिका')}<select name="role"><option value="ceo">CEO</option><option value="co_founder">Co-Founder</option></select></label>
          <button>{L('Create invitation', 'आमंत्रण बनाएँ')}</button>
        </form>
        {sp.invite === 'created' && <p role="status">{L('Invitation ready for 7 days. Share this page with the recipient after signup:', 'आमंत्रण 7 दिन के लिए तैयार है। पंजीकरण के बाद यह पेज साझा करें:')} <Link href="/management">/management</Link></p>}
        {sp.invite === 'failed' && <p role="alert">{L('Could not create invitation. Check the email and existing role.', 'आमंत्रण नहीं बन पाया। ईमेल और मौजूदा भूमिका जाँचें।')}</p>}
      </section>}
      {finance.data && (
        <section className="mgmt-fin" id="finance">
          {[
            [
              L('Homestay booking value', 'होमस्टे बुकिंग मूल्य'),
              finance.data.booking_value,
            ],
            [L('Recorded commission', 'दर्ज कमीशन'), finance.data.commission],
          ].map(([name, n]) => (
            <article key={name}>
              {name}
              <strong>₹{Number(n).toLocaleString('en-IN')}</strong>
            </article>
          ))}
        </section>
      )}
      {member.role === 'co_founder' && (
        <nav>
          <Link href="/co-founder/cms">{title('cms')}</Link> ·{' '}
          <Link href="/manifest.webmanifest">
            {L('App version', 'ऐप संस्करण')} {APP_VERSION}
          </Link>
        </nav>
      )}
      <div className="mgmt-fin">
        {summary.data?.map((row) => (
          <article key={row.status}>
            {title(row.status)}
            <strong>{row.total}</strong>
          </article>
        ))}
      </div>
      <section id="new-entry">
        <h2>{L('New entry', 'नई प्रविष्टि')}</h2>
        <EntryForm
          key={requestKey}
          requestKey={requestKey}
          member={member}
          staff={staff.data ? {data: staff.data.filter(s => s.role !== 'co_founder')} : staff}
          partners={partners}
          lang={lang}
        />
      </section>
      {member.role === 'employee' && (
        <section id="team">
          <details>
            <summary>
              {L(
                'Book a homestay for a walk-in guest',
                'कार्यालय आए अतिथि के लिए होमस्टे बुक करें',
              )}
            </summary>
            {rooms.data.length ? (
              <form action={bookStay}>
                <input type="hidden" name="requestKey" value={randomUUID()} />
                <label>
                  {L('Stay and room', 'होमस्टे और कमरा')}
                  <select name="room" required>
                    {rooms.data.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.homestays.name} · {r.room_type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {L('Guest name', 'अतिथि का नाम')}
                  <input name="guest" required minLength={2} maxLength={120} />
                </label>
                <label>
                  {L('Guest phone', 'अतिथि का फ़ोन')}
                  <input
                    type="tel"
                    name="phone"
                    required
                    minLength={7}
                    maxLength={20}
                  />
                </label>
                <label>
                  {L('Arrival', 'आगमन')}
                  <input name="arrival" type="date" required />
                </label>
                <label>
                  {L('Departure', 'प्रस्थान')}
                  <input name="departure" type="date" required />
                </label>
                <label>
                  {L('Guests', 'अतिथि')}
                  <input
                    name="guests"
                    type="number"
                    min="1"
                    max="50"
                    defaultValue="1"
                    required
                  />
                </label>
                <button>
                  {L('Request one room', 'एक कमरे का अनुरोध भेजें')}
                </button>
              </form>
            ) : (
              <p>
                {L(
                  'No bookable rooms are listed.',
                  'बुकिंग के लिए कोई कमरा उपलब्ध नहीं है।',
                )}
              </p>
            )}
          </details>
        </section>
      )}
      {member.role === 'ceo' && (
        <section id="team">
          <details>
            <summary>
              {L(
                'Employee directory and office assignment',
                'कर्मचारी और कार्यालय आवंटन',
              )}
            </summary>
            {staff.data.filter(s => s.role !== 'co_founder').map((s) => (
              <p key={s.user_id}>
                {s.display_name || s.user_id} · {s.office}
              </p>
            ))}
            <form action={saveWork}>
              <label>
                {L('Registered employee email', 'कर्मचारी का पंजीकृत ईमेल')}
                <input type="email" name="employeeEmail" required />
              </label>
              <label>
                {L('Name', 'नाम')}
                <input name="employeeName" maxLength={120} required />
              </label>
              <label>
                {L('Office', 'कार्यालय')}
                <input name="office" required maxLength={120} />
              </label>
              <button>{L('Save employee', 'कर्मचारी सहेजें')}</button>
            </form>
          </details>
        </section>
      )}
      <section id="work">
        <h2>{L('Work and approvals', 'कार्य और मंज़ूरी')}</h2>
        {!work.data.length && (
          <p>
            {L('No records on this page.', 'इस पृष्ठ पर कोई रिकॉर्ड नहीं है।')}
          </p>
        )}
        {work.data.slice(0, 20).map((w) => {
          const actions = decisions(member.role, user.id, w);
          return (
            <article key={w.id} id={'work-'+w.id}>
              <small>
                {title(w.kind)} · {w.office} · {w.work_day}
              </small>
              <h3>{w.subject}</h3>
              <p>
                {title(w.initiative_stage || w.status)} {w.amount && ' · ₹' + w.amount}
              </p>
              {w.icon_style && (
                <p>
                  {L('Requested icon', 'प्रस्तावित आइकन')} ·{' '}
                  {w.icon_style === 'classic'
                    ? L('Classic mountain', 'क्लासिक पर्वत')
                    : L('Himalayan Signature', 'हिमालयन सिग्नेचर')}
                </p>
              )}
              {w.booking_code && <p>{w.booking_code}</p>}
              {w.due_date && (
                <p>
                  {L('Due', 'अंतिम तिथि')} {w.due_date}
                </p>
              )}
              {w.email_to && (
                <a
                  href={
                    'mailto:' +
                    encodeURIComponent(w.email_to) +
                    '?subject=' +
                    encodeURIComponent(w.subject)
                  }
                >
                  {L('Compose email', 'ईमेल लिखें')}
                </a>
              )}
              <details>
                <summary>{L('Activity history', 'कार्य इतिहास')}</summary>
                {w.management_events
                  .sort((a, b) => a.happened_at.localeCompare(b.happened_at))
                  .map((e) => (
                    <p key={e.happened_at}>
                      {title(e.action)} ·{' '}
                      {new Date(e.happened_at).toLocaleString(
                        lang === 'hi' ? 'hi-IN' : 'en-IN',
                        { timeZone: 'Asia/Kolkata' },
                      )}{' '}
                      · {e.note}
                    </p>
                  ))}
              </details>
              {actions.length > 0 && (
                <form action={saveWork}>
                  <input type="hidden" name={w.kind === "initiative" ? "initiativeId" : "id"} value={w.id} />
                  {actions.includes('assign') && <>
                    <label>{L('Assign to', 'कार्य सौंपें')}<select name="assignee" required defaultValue="">
                      <option value="">{L('Choose a team member','सदस्य चुनें')}</option>
                      {staff.data.map(s => <option key={s.user_id} value={s.user_id}>{s.display_name || s.user_id} · {s.office}</option>)}
                    </select></label>
                    <label>{L('Due date','अंतिम तिथि')}<input type="date" name="due" required /></label>
                  </>}
                  <label>
                    {L('Decision note', 'निर्णय टिप्पणी')}
                    <input name="note" required maxLength={500} />
                  </label>
                  {actions.map((a) => (
                    <button name="action" value={a} key={a}>
                      {title(a)}
                    </button>
                  ))}
                </form>
              )}
            </article>
          );
        })}
        <nav>
          {page > 0 && (
            <Link href={'?page=' + (page - 1)}>{L('Previous', 'पिछला')}</Link>
          )}{' '}
          {work.data.length > 20 && (
            <Link href={'?page=' + (page + 1)}>{L('Next', 'अगला')}</Link>
          )}
        </nav>
      </section>
      </div>
    </div>
  );
}
