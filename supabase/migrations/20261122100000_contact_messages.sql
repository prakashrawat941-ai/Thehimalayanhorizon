-- Contact form messages (Next.js site, Part 2). NOT APPLIED YET — needs "DB approved".
-- Visitors can send; only admins can read. Small per-email rate limit in the database.
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  name       text not null check (char_length(name) between 2 and 120),
  email      text not null check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  phone      text check (phone is null or phone ~ '^[0-9+\s-]{7,20}$'),
  message    text not null check (char_length(message) between 5 and 3000),
  lang       text not null default 'hi' check (lang in ('hi','en')),
  status     text not null default 'new' check (status in ('new','replied','closed')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

-- Anyone may send a message (status is always 'new'; user_id must be their own or empty).
create policy "contact_messages: anyone can send" on public.contact_messages for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = (select auth.uid())));
create policy "contact_messages: admin read" on public.contact_messages for select to authenticated using ((select private.is_admin()));
create policy "contact_messages: admin update" on public.contact_messages for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Max 3 messages per email per 10 minutes.
create or replace function private.contact_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_messages
      where lower(email) = lower(new.email) and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Too many messages, please try later' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists contact_messages_rate on public.contact_messages;
create trigger contact_messages_rate before insert on public.contact_messages for each row execute function private.contact_rate_limit();
