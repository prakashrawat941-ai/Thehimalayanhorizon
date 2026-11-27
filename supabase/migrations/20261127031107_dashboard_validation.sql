-- Keep direct RPC callers under the same name validation as the server action.
create or replace function private.validate_location_fields(p_fields jsonb,p_sources jsonb) returns void language plpgsql set search_path='' as $$
declare k text; v text;
begin
 if jsonb_typeof(p_fields)<>'object' or jsonb_typeof(p_sources)<>'object' then raise exception 'Invalid place details'; end if;
 if coalesce(length(trim(p_fields->>'name')),0) not between 2 and 120 then raise exception 'Place name required'; end if;
 for k,v in select key,value from jsonb_each_text(p_fields) loop
  if k not in ('name','name_hi','district','region','kind','lat_lng','nearest_town','altitude_m','best_season','image_url') or length(v)>500 then raise exception 'Invalid place field'; end if;
 end loop;
 for k,v in select key,value from jsonb_each_text(p_sources) loop
  if k not in ('name','name_hi','district','region','kind','lat_lng','nearest_town','altitude_m','best_season','image_url')
     or v not in ('places','locations','osm','derived','suggested','manual') then raise exception 'Invalid field source'; end if;
 end loop;
end $$;
