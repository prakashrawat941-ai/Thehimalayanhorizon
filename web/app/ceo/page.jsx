import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadOps } from '@/lib/dash/management-data';
import { loadOffices } from '@/lib/dash/management-live';
import { DashError } from '@/components/dash/DashStates';
import { OpsToday } from '@/components/dash/management';

export default async function CeoOps() {
  const { db, mfaNeeded } = await requireManagement('ceo','/ceo');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const [ops, offices] = await Promise.all([loadOps(db),loadOffices(db)]);
  if (ops.error) return <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />;
  const { counts, slowStays, oldTickets } = ops.data;
  const alerts = [
    counts.sos ? { id: 'sos', icon: 'alert', tone: 'red', title: L(`${counts.sos} SOS incident(s) open`, `${counts.sos} SOS घटनाएँ खुली`), sub: L('Instant Cab safety', 'इंस्टेंट कैब सुरक्षा'), href: null } : null,
    slowStays ? { id: 'stay', icon: 'house', tone: 'amber', title: L(`${slowStays} booking request(s) waiting over 12 h`, `${slowStays} बुकिंग रिक्वेस्ट 12 घंटे से ज़्यादा से इंतज़ार में`), sub: L('The host has not replied yet', 'होस्ट ने अभी जवाब नहीं दिया'), href: null } : null,
    oldTickets ? { id: 'tickets', icon: 'support', tone: 'blue', title: L(`${oldTickets} support ticket(s) open over 24 h`, `${oldTickets} सहायता टिकट 24 घंटे से ज़्यादा से खुले`), sub: L('Reply from Support tickets', 'सहायता टिकट से जवाब दें'), href: null, action: L('Reply', 'जवाब दें') } : null,
  ].filter(Boolean);
  return <OpsToday lang={lang} counts={counts} alerts={alerts} offices={offices.data || []} officesConnected={!offices.error} />;
}
