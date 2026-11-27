-- Homepage extras as editable home sections (UI: PR "home extras in CMS", 27 Nov 2026).
-- NOT APPLIED YET. Apply on staging first, then production with the owner's approval.
-- Effect: the five extras (trust, season, map, sample_plan, today_rides) become home_sections
-- rows that Admin (and the Co-founder once the management policies land) can show, hide,
-- reorder and retitle. The site switches to this mode only when home_layout.extras_in_cms = true,
-- so running this file is what turns it on; before that the extras keep their fixed places.

alter table public.home_sections drop constraint if exists home_sections_kind_check;
alter table public.home_sections add constraint home_sections_kind_check check (kind = any (array[
  'hero','themes','destinations','itineraries','villages','stays','workspaces','cabs','partner_cta','text',
  'trust','season','map','sample_plan','today_rides'
]));

-- Same order as the current fixed layout: trust right after the hero, the other four after
-- every existing section. Existing sections from position 2 move down one place first.
update public.home_sections set position = position + 1
where kind not in ('hero','trust','season','map','sample_plan','today_rides') and position >= 2
  and not exists (select 1 from public.home_sections h where h.kind = 'trust');

insert into public.home_sections (kind, position, enabled)
select v.k, case when v.k = 'trust' then 2 else m.top + v.n end, true
from (values ('trust', 0), ('season', 1), ('map', 2), ('sample_plan', 3), ('today_rides', 4)) as v(k, n)
cross join (select coalesce(max(position), 1) as top from public.home_sections
            where kind not in ('trust','season','map','sample_plan','today_rides')) m
where not exists (select 1 from public.home_sections h where h.kind = v.k);

insert into public.site_settings (key, value)
values ('home_layout', jsonb_build_object('extras_in_cms', true))
on conflict (key) do update set value = coalesce(public.site_settings.value, '{}'::jsonb) || jsonb_build_object('extras_in_cms', true);
