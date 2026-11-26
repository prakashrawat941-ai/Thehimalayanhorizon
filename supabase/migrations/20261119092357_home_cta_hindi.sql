-- Hindi text for home page buttons.
alter table public.home_sections add column cta_label_hi text not null default '' check (char_length(cta_label_hi) <= 60);
update public.home_sections set cta_label_hi = case kind
  when 'hero' then 'मेरी यात्रा प्लान करें' when 'villages' then 'गाँव देखें' when 'itineraries' then 'सभी प्लान'
  when 'destinations' then 'और जगहें' when 'stays' then 'होमस्टे देखें' when 'workspaces' then 'वर्कस्पेस खोजें'
  when 'cabs' then 'राइड खोजें' when 'partner_cta' then 'पार्टनर बनें' else '' end;
