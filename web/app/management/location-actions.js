'use server';
import { requireManagement } from '@/lib/management/guard';

const fields = ['name','name_hi','district','region','kind','lat_lng','nearest_town','altitude_m','best_season','image_url'];
const localMatchFields = 'name,name_hi,district,region,kind,lat,lng';
const sources = ['places','locations','osm','derived','suggested','manual'];
const value = (f,k) => String(f.get(k) ?? '').trim();
const same = (a,b) => a.toLocaleLowerCase().trim() === b.toLocaleLowerCase().trim();
const cache = new Map();
let lastOsmCall = 0;
function mapped(row,source) {
 const f = {};
 for (const k of fields) {
  const v=k==='lat_lng' ? (row.lat != null && row.lng != null ? `${row.lat}, ${row.lng}` : '') : row[k];
  if (v != null && v !== '') f[k]={value:String(v),source};
 }
 return f;
}
function score(query,district,row) {
 const name=(row.name||'').toLowerCase();const q=query.toLowerCase();
 return Math.max(0,Math.min(100,Math.round((same(query,row.name||'')?85:name.includes(q)||q.includes(name)?62:25)+(district && same(district,row.district||'')?15:0))));
}
async function osm(query,district) {
 const key=`${query.toLowerCase()}|${district.toLowerCase()}`;
 if(cache.has(key) && Date.now()-cache.get(key).at<3600000) return cache.get(key).data;
 if(Date.now()-lastOsmCall<1100) return { rows:[],available:false };
 lastOsmCall=Date.now();
 const url=new URL(process.env.OSM_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
 url.searchParams.set('q',[query,district,'Uttarakhand','India'].filter(Boolean).join(', '));
 url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');url.searchParams.set('addressdetails','1');url.searchParams.set('namedetails','1');url.searchParams.set('countrycodes','in');
 try {
  const res=await fetch(url,{headers:{'User-Agent':'TheHimalayanHorizon/1.0 (https://thehimalayanhorizon.netlify.app/contact)'},signal:AbortSignal.timeout(4500)});
  if(!res.ok) throw new Error('OSM unavailable');
  const data=(await res.json()).filter((x)=>/uttarakhand/i.test(x.display_name||'')).slice(0,5);
  const result={rows:data,available:true};cache.set(key,{at:Date.now(),data:result});return result;
 } catch { return { rows:[],available:false }; }
}
export async function findMatches(form) {
 try {
  const name=value(form,'name'),district=value(form,'district');
  if(name.length<2||name.length>120||district.length>60) return {ok:false,status:'error',message:'Enter a place name of 2–120 characters.'};
  const {db,mfaNeeded}=await requireManagement('co_founder','/co-founder/locations');
  if(mfaNeeded) return {ok:false,status:'error',message:'Two-step verification required.'};
  const [places,locations,fromOsm]=await Promise.all([
   db.from('places').select('id,name,name_hi,district,region,kind,lat,lng').ilike('name',`%${name.replace(/[%_]/g,'')}%`).limit(20),
   db.from('locations').select('id,name,name_hi,district,region,kind,lat,lng,best_season,image_url,is_published').ilike('name',`%${name.replace(/[%_]/g,'')}%`).limit(20),
   osm(name,district),
  ]);
  if(places.error||locations.error) throw places.error||locations.error;
  const local=[...(locations.data||[]).map((r)=>({r,source:'locations'})),...(places.data||[]).map((r)=>({r,source:'places'}))];
  const matches=local.map(({r,source})=>({ id:`${source}:${r.id}`,score:score(name,district,r),name:r.name,sub:[r.district,r.region].filter(Boolean).join(' · '),distanceKm:null,lat:r.lat,lng:r.lng,fields:mapped(r,source) }));
  for(const r of fromOsm.rows) {
   const n=r.namedetails?.name || r.name || r.display_name?.split(',')[0];
   const a=r.address||{};const districtName=a.state_district||a.county||'';
   matches.push({id:`osm:${r.osm_type}:${r.osm_id}`,score:score(name,district,{name:n,district:districtName}),name:n,sub:r.display_name,distanceKm:null,lat:Number(r.lat),lng:Number(r.lon),fields:mapped({name:n,name_hi:r.namedetails?.['name:hi'],district:districtName,lat:r.lat,lng:r.lon},'osm')});
  }
  const duplicate=local.find(({r,source})=>source==='locations' && r.is_published && same(name,r.name) && (!district||same(district,r.district)));
  return {ok:true,status:'ok',matches:matches.sort((a,b)=>b.score-a.score).slice(0,12),duplicate:duplicate?{name:duplicate.r.name,distanceKm:null}:null,osmAvailable:fromOsm.available};
 } catch(e) { return {ok:false,status:'error',message:e?.message||'Search failed.'}; }
}
async function locationWrite(form,kind) {
 try {
  const {db,mfaNeeded}=await requireManagement('co_founder','/co-founder/locations');
  if(mfaNeeded) return {ok:false,message:'Two-step verification required.'};
  const input=Object.fromEntries(fields.map((k)=>[k,value(form,k)]));
  if(input.name.length<2||input.name.length>120||Object.values(input).some((v)=>v.length>500)) return {ok:false,message:'Check the place name and field lengths.'};
  const inputSources=JSON.parse(value(form,'field_sources')||'{}');
  if(!inputSources||typeof inputSources!=='object'||Object.entries(inputSources).some(([k,v])=>!fields.includes(k)||!sources.includes(v))) return {ok:false,message:'Invalid field sources.'};
  const match=value(form,'match_id');
  if(match&&!/^(places|locations):[0-9a-f-]{36}$|^osm:[a-z]+:[0-9]+$/i.test(match)) return {ok:false,message:'Invalid match.'};
  // Recheck local provenance: changed values must be recorded as manual.
  if(/^(places|locations):/.test(match)) {
   const [table,id]=match.split(':');
   const projection = table === 'locations' ? localMatchFields + ',best_season,image_url' : localMatchFields;
   const result=await db.from(table).select(projection).eq('id',id).maybeSingle();
   if(result.error||!result.data) return {ok:false,message:'Matched place is no longer available.'};
   const original=mapped(result.data,table);
   for(const k of fields) if(inputSources[k]===table && input[k]!==String(original[k]?.value||'')) inputSources[k]='manual';
  }
  const draftId=value(form,'draft_id');
  if (draftId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(draftId)) return {ok:false,message:'Invalid draft.'};
  const result=kind==='draft'
   ? await db.rpc('management_location_save',{p_id:draftId||null,p_fields:input,p_sources:inputSources,p_match:match||null})
   : await db.rpc('management_location_publish',{p_fields:input,p_sources:inputSources,p_match:match||null,p_home:value(form,'show_on_home')==='true',p_featured:value(form,'featured')==='true'});
  return result.error ? {ok:false,message:result.error.message} : {ok:true,id:result.data};
 } catch(e) { return {ok:false,message:e?.message||'Could not save the location.'}; }
}
export async function saveDraft(form) { return locationWrite(form,'draft'); }
export async function publish(form) { return locationWrite(form,'publish'); }
