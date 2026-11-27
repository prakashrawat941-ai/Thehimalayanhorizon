-- Co-founder onboarding needs only KYC state, not private documents or identity numbers.
drop policy management_cofounder_kyc on public.partner_kyc;
create function public.management_onboarding_kyc() returns table(partner_id uuid,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.management_role() is distinct from 'co_founder' then raise exception 'Verification required' using errcode='42501'; end if;
 return query select k.partner_id,k.status from public.partner_kyc k
 join public.partners p on p.id=k.partner_id where p.status='pending';
end $$;
revoke all on function public.management_onboarding_kyc() from public,anon;
grant execute on function public.management_onboarding_kyc() to authenticated;
