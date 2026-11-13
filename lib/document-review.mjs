import {validateLabDocuments} from './lab-review.mjs';
import {bodyMetricKeys} from '../public/body-math.mjs';
// Metadata corrections retain the authenticated patient's original bytes and document identity.
export function validateDocumentReview(documents){
 const fail=()=>{throw Object.assign(new Error('Проверьте исправленные разделы документа.'),{status:400});};
 const str=(s,n)=>typeof s==='string'&&s.length<=n;
 if(!Array.isArray(documents)||!documents.length||documents.length>30||JSON.stringify(documents).length>180000)fail();
 for(const d of documents){
  if(!['analysis','visit','other'].includes(d.doc_type)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!str(d.source_name,200)||!str(d.summary,18000)||!Array.isArray(d.markers)||!Array.isArray(d.reminders)||d.reminders.length>30)fail();
  if(d.doc_type==='analysis')validateLabDocuments([d]);else if(d.markers.length)fail();
  if(d.doc_type==='visit'){
   if(!d.visit||!['doctor','specialty','clinic','complaints','findings','diagnosis'].every(k=>str(d.visit[k],8000))||!Array.isArray(d.visit.recs)||d.visit.recs.length>40||d.visit.recs.some(s=>!str(s,3000)))fail();
  }
  for(const r of d.reminders)if(!str(r.what,500)||!str(r.why,2000)||!/^\d{4}-\d{2}-\d{2}$/.test(r.due||'')||!Array.isArray(r.markers)||r.markers.some(s=>!str(s,100)))fail();
  if(d.bodyMetrics&&(!Array.isArray(d.bodyMetrics)||d.bodyMetrics.length>bodyMetricKeys.length||d.bodyMetrics.some(m=>!bodyMetricKeys.includes(m.key)||!Number.isFinite(m.value)||m.value<0||!str(m.unit,30))))fail();
 }
 return structuredClone(documents);
}
