'use server';
import { createClient as adminClient } from '@supabase/supabase-js';
import { requireManagement } from '@/lib/management/guard';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/config';
import { decisions } from '@/lib/management/catalog';

const failure = (e) => ({ ok: false, message: e?.message || 'Request failed. Try again.' });
const clean = (f,k) => String(f.get(k) ?? '').trim();
const uuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function decide(form) {
 try {
  const id=clean(form,'id'), action=clean(form,'decision'), note=clean(form,'note');
  if (!uuid(id) || !['approved','returned','completed'].includes(action) || note.length<1 || note.length>500) return failure(new Error('A valid item, decision and 1–500 character note are required.'));
  const { db,user,managementRole,mfaNeeded } = await requireAnyManagement();
  if (mfaNeeded) return failure(new Error('Two-step verification required.'));
  const { data: row,error } = await db.from('management_work').select('id,kind,status,owner_id,assignee').eq('id',id).maybeSingle();
  if (error || !row || !decisions(managementRole,user.id,row).includes(action)) return failure(new Error('Decision not permitted.'));
  const result=await db.rpc('management_decide',{ p_id:id,p_action:action,p_note:note });
  return result.error ? failure(result.error) : { ok:true };
 } catch(e) { return failure(e); }
}
async function requireAnyManagement() {
 const { requireUser } = await import('@/lib/account');
 const ctx = await requireUser('/management');
 const { data, error } = await ctx.db.from('management_members').select('role').eq('user_id',ctx.user.id).maybeSingle();
 if (error) throw error;
 if (!['founder','ceo','co_founder'].includes(data?.role)) throw new Error('Management role required.');
 return requireManagement(data.role, '/management');
}
export async function setMember(form) {
 try {
  const {db,mfaNeeded}=await requireManagement('founder','/founder/access');
  if (mfaNeeded) return failure(new Error('Two-step verification required.'));
  const userId=clean(form,'user_id'),email=clean(form,'email').toLowerCase(),role=clean(form,'role'),office=clean(form,'office'),note=clean(form,'note');
  if ((userId && !uuid(userId)) || (userId && email) || (!userId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !['ceo','co_founder','employee','none'].includes(role) || (role!=='none' && (office.length<1 || office.length>120)) || note.length<1 || note.length>500 || (role==='none' && !userId)) return failure(new Error('Check the person, role, office and 1–500 character reason.'));
  // An invite must really be sent. Without a configured server secret, report failure before any write.
  let inviteAdmin;
  if (email) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return failure(new Error('Email invitations are unavailable. Configure the server invitation key.'));
    inviteAdmin=adminClient(SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{ auth:{ persistSession:false,autoRefreshToken:false } });
  }
  const result=await db.rpc('management_set_member',{ p_user:userId || null,p_email:email || null,p_role:role,p_office:office,p_note:note });
  if (result.error) return failure(result.error);
  if (email) {
    // Existing confirmed accounts receive a role directly; newly invited accounts get a pending record.
    const { data: pending,error: lookupError }=await db.rpc('management_invitation_pending',{ p_email:email });
    if (lookupError) return failure(lookupError);
    if (pending) {
      const siteOrigin = process.env.VERCEL_ENV === 'preview'
        ? (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
        : (process.env.NEXT_PUBLIC_SITE_URL || 'https://thehimalayanhorizon.netlify.app');
      if (!siteOrigin) return failure(new Error('Preview invitation URL is unavailable.'));
      const redirectTo = new URL('/management/invite', siteOrigin).toString();
      let { error: deliveryError } = await inviteAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (['email_exists', 'user_already_exists'].includes(deliveryError?.code)) {
        const auth = adminClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false } }).auth;
        ({ error: deliveryError } = await auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } }));
      }
      if (deliveryError) return failure(new Error('Invitation was recorded, but email delivery failed. Retry the invite.'));
    }
  }
  return { ok:true };
 } catch(e) { return failure(e); }
}
export async function sendOnboarding(form) {
 try {
  const {db,mfaNeeded}=await requireManagement('co_founder','/co-founder/onboarding');
  const listing=clean(form,'homestay_id');
  if (mfaNeeded || !uuid(listing)) return failure(new Error('Verification and a valid homestay are required.'));
  const result=await db.rpc('management_submit_homestay',{p_homestay:listing});
  return result.error ? failure(result.error) : {ok:true};
 } catch(e) { return failure(e); }
}

export async function acceptInvite() {
 try {
  const { requireUser } = await import('@/lib/account');
  const {db,user}=await requireUser('/management/invite');
  const result=await db.rpc('accept_leadership_invitation');
  if(result.error) return failure(result.error);
  const {data,error}=await db.from('management_members').select('role').eq('user_id',user.id).single();
  if(error) return failure(error);
  return {ok:true,path:{ceo:'/ceo',co_founder:'/co-founder',employee:'/employee'}[data.role]||'/account'};
 } catch(e) { return failure(e); }
}
export async function recordAttendance() {
 try {
  const {db,mfaNeeded}=await requireManagement('employee','/employee');
  if(mfaNeeded) return failure(new Error('Two-step verification required.'));
  const result=await db.rpc('management_submit',{p_kind:'attendance',p_subject:'Village office check-in'});
  return result.error ? failure(result.error) : {ok:true};
 } catch(e) { return failure(e); }
}
