import {createHmac, timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
export function safeEqual(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);}
export function session(secret,expires){const body=String(expires);return body+'.'+createHmac('sha256',secret).update(body).digest('hex');}
export function validSession(value,secret){if(!secret||!value)return false;const exp=Number(value.split('.')[0]);return exp>Date.now()&&safeEqual(value,session(secret,exp));}
export function buildRecord(entries){
 const record={generated:new Date().toISOString().slice(0,10),profile:{name:'Моя медкарта',diagnoses:[],meds:[],notes:[]},biomarkers:[],visits:[],reminders:[],events:[],tldr:[]};
 const byKey=new Map();
 for(const entry of entries){for(const doc of entry.parsed.documents){
  if(doc.doc_type==='analysis')for(const m of doc.markers){
   const def=catalog.markers[m.key];let unit=m.unit,value=m.value;
   const u=unit.replaceAll(' ','').toLowerCase();
   if(def?.mgdl_k&&['mg/dl','мг/дл'].includes(u)){value=Math.round(value/def.mgdl_k*100)/100;unit=def.si;}
   else if(m.key==='hb'&&['g/dl','г/дл'].includes(u)){value=Math.round(value*10);unit=def.si;}
   const recognized=def&&(unit===def.si||[def.si_pl,def.si_en].filter(Boolean).some(v=>v.toLowerCase()===unit.toLowerCase()));
   const key=(m.key||m.name)+'|'+(recognized?def.si:unit);let b=byKey.get(key);
   if(!b){b={key,name:recognized?def.short:m.name,fullName:recognized?def.ru:m.name,group:recognized?def.group:'Другие показатели',low:recognized?(def.lo??null):null,high:recognized?(def.hi??null):null,unit:recognized?def.si:unit,ref:recognized?def.ref_si:m.ref,series:[]};byKey.set(key,b);}
   const flag=recognized?(def.hi!==undefined&&value>def.hi?'high':def.lo!==undefined&&value<def.lo?'low':'ok'):m.flag;
   if(!b.series.some(x=>x.documentId===entry.id&&x.date===doc.date&&x.value===value))b.series.push({date:doc.date,value,flag,lab:doc.source_name,documentId:entry.id,original:`${m.value} ${m.unit}`});
  }
  if(doc.doc_type==='visit')record.visits.push({...doc.visit,date:doc.date,documentId:entry.id});
  for(const r of doc.reminders||[])record.reminders.push({...r,date:doc.date,doctor:doc.visit?.doctor||'',status:'planned'});
 }}
 record.biomarkers=[...byKey.values()].map(b=>({...b,series:b.series.sort((a,b)=>a.date.localeCompare(b.date))}));
 record.visits.sort((a,b)=>b.date.localeCompare(a.date));
 record.reminders=record.reminders.map((r,i)=>({...r,id:`rem-${i}`,markers:r.markers.map(k=>record.biomarkers.find(b=>b.key.startsWith(k+'|'))?.key).filter(Boolean),status:r.markers.length&&r.markers.every(k=>record.biomarkers.some(b=>b.key.startsWith(k+'|')&&b.series.some(s=>s.date>r.date&&s.date<=record.generated)))?'done':'planned'})).sort((a,b)=>a.due.localeCompare(b.due));
 record.tldr=record.biomarkers.map(b=>{const l=b.series.at(-1);return {level:l.flag==='ok'?'ok':'warn',text:`${b.name}: ${l.value} ${b.unit} — ${l.flag==='ok'?'в пределах референса':l.flag==='high'?'выше референса':'ниже референса'} (${l.date}).`,markers:[b.key]};});
 return record;
}
