import {get,list,put} from '@vercel/blob';
const options={access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'};
export function datesBefore(now=new Date(),count=7){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Atlantic/Canary',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return Array.from({length:count},(_,i)=>new Date(Date.parse(today+'T12:00:00Z')-i*86400000).toISOString().slice(0,10));}
export function shape(value,depth=0){if(depth>11)return typeof value;if(Array.isArray(value))return value.slice(0,value.some(x=>x&&typeof x==="object"&&"type" in x)?40:2).map(x=>shape(x,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['email','name','user_id'].includes(k)).map(([k,v])=>[k,shape(v,depth+1)]));return value;}
export async function syncRing(){
 if(!process.env.ULTRAHUMAN_API_TOKEN)throw Error('Ultrahuman: токен не настроен в Vercel.');
 let received=0;const errors=[];
 for(const date of datesBefore()){
  const response=await fetch('https://partner.ultrahuman.com/api/v1/partner/daily_metrics?date='+date,{headers:{Authorization:process.env.ULTRAHUMAN_API_TOKEN},signal:AbortSignal.timeout(25000)});
  if(response.status===401||response.status===403)throw Error('Ultrahuman: токен не принят. Проверьте Personal API Token.');
  if(response.status===404){errors.push(date);continue;}
  if(!response.ok)throw Error('Ultrahuman: сервис вернул ошибку '+response.status+'. Попробуйте позже.');
  const payload=await response.json();
  if(payload.error||payload.status&&payload.status!==200)throw Error('Ultrahuman: сервис не вернул корректные данные.');
  const metrics=payload.data?.metrics?.[date];
  if(!Array.isArray(metrics)||!metrics.length){errors.push(date);continue;}
  await put(`wearables/ultrahuman/${date}.json`,JSON.stringify({date,source:'Ultrahuman',syncedAt:new Date().toISOString(),payload}),options);received++;
 }
 await put('settings/ultrahuman-sync.json',JSON.stringify({lastSync:new Date().toISOString(),received,missing:errors}),options);
 return {ok:true,received,missing:errors,message:`Ultrahuman: получены ответы за ${received} дней. Данные сохранены в закрытом хранилище.`};
}
export async function ringDays(){let cursor,blobs=[];do{const r=await list({prefix:'wearables/ultrahuman/',limit:100,cursor});blobs.push(...r.blobs);cursor=r.hasMore?r.cursor:undefined;}while(cursor);return Promise.all(blobs.map(async b=>{const r=await get(b.pathname,{access:'private',useCache:false});return new Response(r.stream).json();}));}
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function normalizeDay(entry){
 const all=entry.payload?.data?.metrics?.[entry.date];if(!Array.isArray(all))return null;
 const metric=k=>all.find(m=>m.type===k)?.object;const sleep=metric('sleep');
 const seconds=numeric(sleep?.total_sleep?.seconds);const minutes=numeric(sleep?.total_sleep?.minutes);
 const duration=seconds!==null?seconds/3600:minutes!==null?minutes/60:null;
 return {date:entry.date,source:'Ultrahuman',syncedAt:entry.syncedAt,lastDeviceSync:entry.payload.data.last_synced_at??null,timeZone:entry.payload.data.latest_time_zone||'Atlantic/Canary',
 sleepHours:duration,sleepScore:numeric(sleep?.sleep_score?.score),deepSleepMin:numeric(sleep?.deep_sleep?.minutes),remSleepMin:numeric(sleep?.rem_sleep?.minutes),
 restingHR:numeric(metric('sleep_rhr')?.value)??numeric(metric('night_rhr')?.avg),hrvMs:numeric(metric('avg_sleep_hrv')?.value),
 recoveryScore:numeric(metric('recovery_index')?.value),sleepEfficiency:numeric(sleep?.sleep_efficiency?.percentage),temperatureDeviation:numeric(sleep?.temperature_deviation?.celsius),
 skinTemperature:numeric(sleep?.average_body_temperature?.celsius),ringSteps:numeric(metric('steps')?.total),activeMinutes:numeric(metric('active_minutes')?.value),
 bedtimeStart:numeric(sleep?.bedtime_start),bedtimeEnd:numeric(sleep?.bedtime_end)};
}
export function summarizeRing(raw){const days=raw.map(normalizeDay).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)).slice(-90);const latestSleep=[...days].reverse().find(d=>d.sleepHours!==null);const mean=k=>{const v=days.slice(-7).map(d=>d[k]).filter(v=>v!==null);return v.length?Number((v.reduce((a,b)=>a+b,0)/v.length).toFixed(2)):null;};return {source:'Ultrahuman',days,lastSync:raw.map(d=>d.syncedAt).sort().at(-1)||null,latestSleepDate:latestSleep?.date||null,summary:{sleepHoursMean7:mean('sleepHours'),hrvMean7:mean('hrvMs'),restingHRMean7:mean('restingHR'),nights:days.slice(-7).filter(d=>d.sleepHours!==null).length},stepsSource:'Apple Watch не подключены; ringSteps — только шаги кольца'};}
