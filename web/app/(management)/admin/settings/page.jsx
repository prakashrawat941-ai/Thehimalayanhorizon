import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { SettingsEditor } from '@/components/admin/SettingsEditor';

export default async function Settings() {
  const { db } = await requireAdmin('/admin/settings');
  const { L, lang } = await getT();
  const list = await rows(db.from('site_settings').select('key, value'));
  const settings = Object.fromEntries(list.map((r) => [r.key, r.value]));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Settings & pages', 'सेटिंग और पेज')}</h1></div></div>
      <SettingsEditor lang={lang} settings={settings} />
    </>
  );
}
