alter table public.management_work add column initiative_stage text
 check(initiative_stage in ('planning','assigned','review','final_review','closed'));

create function public.create_initiative(p_subject text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare item uuid;
begin
 if private.management_role() is distinct from 'founder' or p_request is null then raise exception 'Not permitted'; end if;
 insert into public.management_work(owner_id,office,kind,subject,request_key,status,initiative_stage)
 select user_id,office,'initiative',trim(p_subject),p_request,'open','planning' from public.management_members where user_id=auth.uid()
 on conflict(owner_id,request_key) do nothing returning id into item;
 if item is null then
 select id into strict item from public.management_work where owner_id=auth.uid() and request_key=p_request and kind='initiative';
 else
 insert into public.management_events(work_id,actor,action) values(item,auth.uid(),'submitted');
 end if;
 return item;
end $$;
create function public.advance_initiative(p_id uuid,p_step text,p_note text,p_assignee uuid,p_due date) returns void
language plpgsql security definer set search_path='' as $$
declare w public.management_work; r text:=private.management_role(); next_stage text;
begin
 select * into strict w from public.management_work where id=p_id and kind='initiative' for update;
 if nullif(trim(p_note),'') is null or length(p_note)>500 then raise exception 'Note required'; end if;
 if w.initiative_stage='planning' and r='ceo' and p_step='assign' and p_due is not null
 and exists(select from public.management_members where user_id=p_assignee and role in ('employee','co_founder')) then
 next_stage:='assigned';
 elsif w.initiative_stage='assigned' and r in ('employee','co_founder') and auth.uid()=w.assignee and p_step='deliver' then next_stage:='review';
 elsif w.initiative_stage='review' and r='ceo' and p_step='reviewed' then next_stage:='final_review';
 elsif w.initiative_stage='final_review' and r='founder' and auth.uid()=w.owner_id and p_step='approved' then next_stage:='closed';
 else raise exception 'Invalid handoff'; end if;
 update public.management_work set initiative_stage=next_stage,status=case when next_stage='closed' then 'approved' else 'open' end,
 assignee=case when p_step='assign' then p_assignee else assignee end,due_date=case when p_step='assign' then p_due else due_date end where id=p_id;
 insert into public.management_events(work_id,actor,action,note) values(p_id,auth.uid(),p_step,trim(p_note));
end $$;
revoke all on function public.create_initiative(text,uuid), public.advance_initiative(uuid,text,text,uuid,date) from public,anon;
grant execute on function public.create_initiative(text,uuid), public.advance_initiative(uuid,text,text,uuid,date) to authenticated;
