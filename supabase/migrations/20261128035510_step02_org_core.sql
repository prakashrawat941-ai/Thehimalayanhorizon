-- Step 02 · 02 · Organisation core: shared helpers, departments, offices, employees, office assignments.
-- Reuses: management_members (role + aal2 via private.management_role), private.leadership_employee_ids,
-- private.id_counters / private.next_counter, private.notify, public.audit_log.

-- ───────────── Roles: add COO and Manager (Founder decision, 28 Nov 2026) ─────────────
-- New roles start with no dashboard access: every existing policy names the roles it allows.
alter table public.management_members drop constraint management_members_role_check;
alter table public.management_members add constraint management_members_role_check
  check (role in ('founder', 'ceo', 'co_founder', 'coo', 'manager', 'employee'));
alter table public.leadership_invitations drop constraint leadership_invitations_role_check;
alter table public.leadership_invitations add constraint leadership_invitations_role_check
  check (role in ('ceo', 'co_founder', 'coo', 'manager', 'employee'));

-- ───────────── Helpers ─────────────

-- API error: the message is one of the shared contract codes (web/contracts/management.ts ApiErrorCode).
create or replace function private.api_error(p_code text, p_hint text default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_code using errcode = case when p_code in ('AUTH_REQUIRED','MFA_REQUIRED','PERMISSION_DENIED') then '42501' else 'P0001' end,
    hint = coalesce(p_hint, p_code);
end $$;

-- Signed-in management member at aal2, or a contract error. Returns the member's role.
create or replace function private.require_member() returns text
language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if auth.uid() is null then perform private.api_error('AUTH_REQUIRED'); end if;
  select role into r from public.management_members where user_id = auth.uid();
  if r is null then perform private.api_error('PERMISSION_DENIED'); end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then perform private.api_error('MFA_REQUIRED'); end if;
  return r;
end $$;

-- Permanent public IDs from the existing counter table (row lock: numbers never repeat).
insert into private.id_counters(kind, last_value) values
  ('emp_founder', 0), ('emp_ceo', 0), ('emp_co_founder', 0), ('emp_coo', 0), ('emp_manager', 0), ('emp_employee', 0),
  ('office', 0), ('approval', 0)
on conflict (kind) do nothing;

create or replace function private.public_id(p_kind text, p_prefix text, p_width int) returns text
language sql security definer set search_path = '' as $$
  select p_prefix || lpad(private.next_counter(p_kind)::text, p_width, '0');
$$;

-- Role-specific permanent employee code, fixed at first issue (Founder decision): THH-FDR / CEO / COF / COO / MGR / EMP.
create or replace function private.employee_code(p_role text) returns text
language sql security definer set search_path = '' as $$
  select private.public_id('emp_' || p_role,
    'THH-' || case p_role when 'founder' then 'FDR' when 'ceo' then 'CEO' when 'co_founder' then 'COF'
                          when 'coo' then 'COO' when 'manager' then 'MGR' else 'EMP' end || '-', 4);
$$;

-- Audit for management actors (private.audit_row only records admins).
create or replace function private.audit_event(p_action text, p_table text, p_row text, p_old jsonb, p_new jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log(actor, action, table_name, row_id, old_row, new_row)
  values (auth.uid(), p_action, p_table, p_row, p_old, p_new);
$$;

create or replace function private.audit_mgmt_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log(actor, action, table_name, row_id, old_row, new_row)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(j ->> 'public_id', j ->> 'id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

create or replace function private.touch_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────── Departments ─────────────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,6}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  name_hi text check (name_hi is null or length(name_hi) <= 80),
  head_employee_id uuid,
  status text not null default 'active' check (status in ('active', 'archived')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Company structure (not sample data): the departments used by the leadership dashboards.
insert into public.departments(code, name, name_hi) values
  ('LDR', 'Leadership', 'नेतृत्व'), ('OPS', 'Operations', 'संचालन'), ('TEC', 'Technology', 'तकनीक'),
  ('GRW', 'Marketing & growth', 'मार्केटिंग और विकास'), ('FIN', 'Finance', 'वित्त'),
  ('VLG', 'Village office', 'ग्राम कार्यालय'), ('SUP', 'Customer support', 'ग्राहक सहायता');

-- ───────────── Offices (created only by an approved request: see step02_03) ─────────────
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^THH-OFF-[0-9]{3,}$'),
  name text not null check (length(trim(name)) between 3 and 120),
  village text not null check (length(trim(village)) between 2 and 80),
  post text check (post is null or length(post) <= 80),
  block text check (block is null or length(block) <= 80),
  district text not null check (length(trim(district)) between 2 and 80),
  state text not null check (length(trim(state)) between 2 and 80),
  country text not null default 'India' check (length(country) <= 60),
  manager_employee_id uuid,
  status text not null default 'active' check (status in ('draft', 'active', 'suspended', 'closed')),
  approval_id uuid,
  created_by uuid references auth.users(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index offices_unique_place on public.offices (lower(trim(name)), lower(trim(village)), lower(trim(district)));

-- ───────────── Employees ─────────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  employee_id text not null unique check (employee_id ~ '^THH-(FDR|CEO|COF|COO|MGR|EMP)-[0-9]{4,}$'),
  legacy_code text unique check (legacy_code is null or legacy_code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  designation text check (designation is null or length(designation) <= 80),
  role text not null check (role in ('founder', 'ceo', 'co_founder', 'coo', 'manager', 'employee')),
  department_id uuid references public.departments(id),
  office_id uuid references public.offices(id),
  office_label text check (office_label is null or length(office_label) <= 120),
  manager_id uuid references public.employees(id),
  employment_status text not null default 'invited' check (employment_status in ('invited', 'active', 'on_leave', 'ended')),
  access_status text not null default 'pending' check (access_status in ('pending', 'active', 'suspended', 'revoked')),
  joined_on date,
  phone text check (phone is null or phone ~ '^(\+91[ -]?)?[6-9][0-9]{9}$'),
  bio text check (bio is null or length(bio) <= 600),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_id is null or manager_id <> id)
);
create index employees_department on public.employees(department_id);
create index employees_office on public.employees(office_id);
alter table public.departments add constraint departments_head_fk foreign key (head_employee_id) references public.employees(id);
alter table public.offices add constraint offices_manager_fk foreign key (manager_employee_id) references public.employees(id);

create table public.office_assignments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  employee_id uuid not null references public.employees(id),
  role_label text not null default 'Staff' check (length(role_label) between 2 and 60),
  starts_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  ends_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create unique index office_assignments_one_open on public.office_assignments(office_id, employee_id) where ends_on is null;

-- Keep employees in step with the existing leadership membership (invites, role changes, offboarding).
-- Every person gets an automatic, permanent, role-specific code. A code previously entered by the Founder
-- (private.leadership_employee_ids) is kept alongside as legacy_code; it is not reused as the official ID.
create or replace function private.sync_employee_from_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u record; code text; existing uuid;
begin
  if tg_op = 'DELETE' then
    update public.employees set access_status = 'revoked', employment_status = 'ended', version = version + 1
    where user_id = old.user_id;
    return old;
  end if;
  select id, lower(email) as email into u from auth.users where id = new.user_id;
  if u.id is null or u.email is null then return new; end if;
  select id into existing from public.employees where user_id = new.user_id or email = u.email
  order by (user_id = new.user_id) desc nulls last limit 1;
  if existing is not null then
    update public.employees set user_id = new.user_id, role = new.role, office_label = new.office,
      full_name = coalesce(nullif(trim(new.display_name), ''), full_name),
      access_status = case when access_status in ('revoked', 'pending') then 'active' else access_status end,
      employment_status = case when employment_status in ('ended', 'invited') then 'active' else employment_status end,
      version = version + 1
    where id = existing;
  else
    select employee_id into code from private.leadership_employee_ids where email = u.email;
    insert into public.employees(user_id, employee_id, legacy_code, email, full_name, role, office_label, employment_status, access_status, joined_on)
    values (new.user_id, private.employee_code(new.role), code, u.email,
            coalesce(nullif(trim(new.display_name), ''), split_part(u.email, '@', 1)), new.role, new.office, 'active', 'active',
            (now() at time zone 'Asia/Kolkata')::date);
  end if;
  return new;
end $$;

create trigger management_members_sync_employee after insert or update or delete on public.management_members
  for each row execute function private.sync_employee_from_member();

-- Backfill current members.
do $$
declare m record;
begin
  for m in select * from public.management_members loop
    update public.management_members set office = office where user_id = m.user_id; -- fires the sync trigger
  end loop;
end $$;

-- ───────────── Triggers, RLS, grants ─────────────
-- The internal id, the permanent employee code and the first-issue role prefix never change.
create or replace function private.employee_identity_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.employee_id <> old.employee_id or new.created_at <> old.created_at then
    raise exception 'Employee identity is permanent' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger employees_identity_immutable before update on public.employees for each row execute function private.employee_identity_immutable();
create or replace function private.forbid_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Records are retained; end or revoke instead of deleting' using errcode = '42501';
end $$;
create trigger employees_no_delete before delete on public.employees for each row execute function private.forbid_delete();
create trigger offices_no_delete before delete on public.offices for each row execute function private.forbid_delete();

create trigger departments_touch before update on public.departments for each row execute function private.touch_version();
create trigger offices_touch before update on public.offices for each row execute function private.touch_version();
create trigger employees_touch before update on public.employees for each row execute function private.touch_version();
create trigger departments_audit after insert or update or delete on public.departments for each row execute function private.audit_mgmt_row();
create trigger offices_audit after insert or update or delete on public.offices for each row execute function private.audit_mgmt_row();
create trigger employees_audit after insert or update or delete on public.employees for each row execute function private.audit_mgmt_row();
create trigger office_assignments_audit after insert or update or delete on public.office_assignments for each row execute function private.audit_mgmt_row();

alter table public.departments enable row level security;
alter table public.offices enable row level security;
alter table public.employees enable row level security;
alter table public.office_assignments enable row level security;

revoke all on public.departments, public.offices, public.employees, public.office_assignments from anon, authenticated;
grant select on public.departments, public.offices, public.employees, public.office_assignments to authenticated;

create policy departments_members_read on public.departments for select to authenticated
  using (private.management_role() is not null);
create policy offices_members_read on public.offices for select to authenticated
  using (private.management_role() is not null);
create policy office_assignments_members_read on public.office_assignments for select to authenticated
  using (private.management_role() is not null);
-- Founder and CEO: whole directory. Co-Founder: own record, leadership and own department.
-- COO, Manager and Employee: own record only, until the Founder defines their scope (Phase 3).
create or replace function private.my_department() returns uuid
language sql stable security definer set search_path = '' as $$
  select department_id from public.employees where user_id = auth.uid();
$$;
create policy employees_read on public.employees for select to authenticated
  using (
    user_id = auth.uid() and private.management_role() is not null
    or private.management_role() in ('founder', 'ceo')
    or private.management_role() = 'co_founder' and (
      role in ('founder', 'ceo', 'co_founder')
      or department_id is not null and department_id = private.my_department()
    )
  );

revoke all on function private.api_error(text, text), private.require_member(), private.public_id(text, text, int),
  private.audit_event(text, text, text, jsonb, jsonb), private.audit_mgmt_row(), private.touch_version(),
  private.sync_employee_from_member(), private.employee_code(text), private.employee_identity_immutable(),
  private.forbid_delete() from public, anon, authenticated;
revoke all on function private.my_department() from public, anon;
grant execute on function private.my_department() to authenticated;

-- Stray empty table found in the Phase 1 audit (0 rows, no dependencies, no references in code or functions).
-- Recovery: create table public.table_name (id bigint, inserted_at timestamptz default timezone('utc', now()),
--   updated_at timestamptz default timezone('utc', now()), data jsonb, name text); alter table public.table_name enable row level security;
drop table if exists public.table_name;
