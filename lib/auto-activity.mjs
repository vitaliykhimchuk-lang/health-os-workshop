import {createHash} from 'node:crypto';
const metrics={step_count:['steps',1],walking_running_distance:['distanceKm',1],active_energy:['activeKcal',1],apple_exercise_time:['exerciseMinutes',1],resting_heart_rate:['restingHR',1]};
// Only individually sourced observations; aggregated/anonymous exports are not watch evidence.
export function parseAuto(body){
 if(!Array.isArray(body?.data?.metrics))throw Error('Нужен JSON Health Auto Export.');
 const groups=new Map();let skipped=0;
 for(const metric of body.data.metrics){const spec=metrics[metric.name];if(!spec)continue;
 for(const p of metric.data||[]){const source=String(p.source||'');const date=String(p.date||'').slice(0,10);const qty=p.qty;
 if(!/watch/i.test(source)||!/^(20\d\d)-\d\d-\d\d$/.test(date)||!Number.isFinite(qty)||qty<0){skipped++;continue;}
 if(new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date){skipped++;continue;}
 let factor=1;const unit=String(metric.units||'').toLowerCase();
 if(spec[0]==='distanceKm'){if(unit==='mi')factor=1.609344;else if(unit==='m')factor=.001;else if(unit!=='km')throw Error('Неизвестная единица расстояния.');}
 if(spec[0]==='activeKcal'){if(unit==='kj')factor=1/4.184;else if(!['kcal','cal'].includes(unit))throw Error('Выберите килокалории в Health Auto Export.');}
 if(spec[0]==='exerciseMinutes'){if(['s','sec'].includes(unit))factor=1/60;else if(!['min','minutes'].includes(unit))throw Error('Выберите минуты нагрузки.');}
 const key=date+'/'+spec[0];if(!groups.has(key))groups.set(key,{date,field:spec[0],points:[]});
 groups.get(key).points.push({key:String(p.date)+'|'+source,source,value:qty*factor});
 }}
 if(groups.size>450||[...groups.values()].some(g=>g.points.length>30000))throw Error('Отправляйте не более 90 дней за раз.');
 return {groups:[...groups.values()],skipped};
}
export function packetId(group){return createHash('sha256').update(JSON.stringify(group)).digest('hex');}
export function autoDays(packets){
 const grouped=new Map();for(const p of packets){const key=p.date+'/'+p.field;if(!grouped.has(key))grouped.set(key,{...p,points:new Map()});const g=grouped.get(key);for(const x of p.points)g.points.set(x.key,x);}
 const days=new Map();for(const g of grouped.values()){
 // Pick one watch source per metric/day, never sum different watches.
 const points=[...g.points.values()];const chosen=points.slice().sort((a,b)=>b.key.localeCompare(a.key))[0]?.source;
 const values=points.filter(p=>p.source===chosen).map(p=>p.value);if(!values.length)continue;
 if(!days.has(g.date))days.set(g.date,{date:g.date,source:'Apple Watch',device:chosen,workouts:[],importedAt:g.receivedAt});
 const d=days.get(g.date);d[g.field]=g.field==='restingHR'?values.reduce((a,b)=>a+b,0)/values.length:values.reduce((a,b)=>a+b,0);d.importedAt=[d.importedAt,g.receivedAt].sort().at(-1);
 }return [...days.values()];
}
