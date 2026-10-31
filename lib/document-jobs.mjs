import {rawRead,mutate,inPatient} from './storage.mjs';
import {getPatient,allowedIds} from './family.mjs';
const queuePath='family/document-queue.json';
async function schedule(path,at){await mutate(queuePath,old=>{const next={...old};if(at===null)delete next[path];else next[path]=at;return next;});}
const pathFor=(p,id)=>`family/document-jobs/${p}/${id}.json`;
export async function queueDocument(patient,document,chat,user){
 const path=pathFor(patient.id,document.id);
 const queued=await mutate(path,old=>old?.state==='done'||old?.state==='processing'&&old.lockUntil>Date.now()?old:{patientId:patient.id,version:patient.version,documentId:document.id,chat:chat??null,user:user?String(user):null,attempts:0,state:'queued',nextAt:Date.now(),created:old?.created||new Date().toISOString()});if(queued.state!=='done')await schedule(path,queued.nextAt||Date.now());return path;
}
export async function runDocumentJob(path,services,{force=false}={}){
 let claimed=false;
 const job=await mutate(path,old=>{claimed=false;if(!old||old.state==='done'||old.state==='cancelled'||old.lockUntil>Date.now()||(!force&&(old.state==='review'||old.nextAt>Date.now())))return old;claimed=true;return {...old,state:'processing',attempts:old.attempts+1,lockUntil:Date.now()+270000};});
 if(!claimed)return {state:job?.state||'missing'};
 const patient=await getPatient(job.patientId);let binding=job.user?(await rawRead(`family/telegram/${job.user}.json`))?.data:null;
 if(!patient||patient.version!==job.version||job.user&&!allowedIds(binding,[patient]).includes(patient.id)){await mutate(path,old=>({...old,state:'cancelled',lockUntil:0}));await schedule(path,null);return {state:'cancelled'};}
 let result;
 try{
  result=await inPatient(patient,async()=>{
   const input=await services.loadDocument(job.documentId);
   const parsed=await services.parseDocument(input,20000000);
   if(parsed.parseStatus==='unparsed')return {state:parsed.parseRetryable?'queued':'review',reason:parsed.parseNotice};
   const latest=await getPatient(patient.id),latestBinding=job.user?(await rawRead(`family/telegram/${job.user}.json`))?.data:null;
   if(!latest||latest.version!==job.version||job.user&&!allowedIds(latestBinding,[latest]).includes(latest.id))return {state:'cancelled'};
   await inPatient(latest,()=>services.saveDocument(parsed,{replaceUnparsed:true}));return {state:'done',summary:(parsed.parsed.documents||[]).map(d=>d.summary||'').filter(Boolean).join('\n').slice(0,1800)};
  });
 }catch(e){console.error('Document job failed',JSON.stringify({name:e.name}));result={state:'queued',reason:'Разбор временно недоступен. Оригинал остаётся в архиве.'};}
 if(result.state==='queued'&&job.attempts>=3)result.state='review';
 await mutate(path,old=>({...old,state:result.state,reason:result.reason||'',lockUntil:0,nextAt:Date.now()+3600000,finishedAt:new Date().toISOString()}));
 await schedule(path,result.state==='queued'?Date.now()+3600000:null);
 return {...result,patient,job};
}
export async function retryDocument(patient,id,services){
 const path=pathFor(patient.id,id);const existing=await rawRead(path);if(!existing?.data){await inPatient(patient,()=>services.loadDocument(id));await queueDocument(patient,{id});}else if(existing.data.version!==patient.version)return {state:'cancelled'};
 await mutate(path,old=>old?.lockUntil>Date.now()?old:({...old,attempts:0,state:'queued',nextAt:0}));await schedule(path,0);return runDocumentJob(path,services,{force:true});
}
export async function pendingDocumentJobs(){const queue=(await rawRead(queuePath))?.data||{};return Object.entries(queue).filter(([path,at])=>/^family\/document-jobs\/[-a-z0-9]{1,48}\/[a-f0-9]{64}\.json$/.test(path)&&Number.isFinite(at)&&at<=Date.now()).sort((a,b)=>a[1]-b[1]).slice(0,3).map(([path])=>path);}
