// All records, names and measurements in this test are synthetic fixtures.
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
const memory=new Map();let etag=0;const failure=name=>Object.assign(Error(name),{name});
mock.module('@vercel/blob',{namedExports:{
 get:async path=>{const b=memory.get(path);return b?{stream:new Response(b.value).body,blob:{etag:b.etag}}:null;},
 put:async(path,value,opts={})=>{const old=memory.get(path);if(opts.ifMatch&&opts.ifMatch!==old?.etag)throw failure('BlobPreconditionFailedError');if(old&&!opts.allowOverwrite&&!opts.ifMatch)throw failure('BlobAlreadyExistsError');memory.set(path,{value:Buffer.isBuffer(value)?value:Buffer.from(value),etag:String(++etag)});return {pathname:path};},
 list:async({prefix,limit=100,cursor})=>{const all=[...memory.keys()].filter(p=>p.startsWith(prefix)).sort();const start=Number(cursor||0);return {blobs:all.slice(start,start+limit).map(pathname=>({pathname})),hasMore:start+limit<all.length,cursor:String(start+limit)};}
}});
const {default:handler}=await import('../api/index.mjs');const {passwordHash,ensureFamily,createCode,consumeCode,getPatient,patientSession}=await import('./family.mjs');const {session}=await import('./core.mjs');
process.env.HEALTH_PASSWORD='gate-test';process.env.SESSION_SECRET='test-secret';process.env.TELEGRAM_WEBHOOK_SECRET='hook-test';process.env.FAMILY_INITIAL_PROFILES=JSON.stringify(['owner','member1','pet1'].map(id=>({id,name:id,species:id==='pet1'?'dog':'human',passwordHash:passwordHash('personal-'+id)})));
const gate='health_session='+session(process.env.SESSION_SECRET,Date.now()+60000);
async function request(path,{body,cookie=gate,method=body?'POST':'GET',headers={}}={}){let status=200,data;const res={setHeader(){},status(s){status=s;return this;},json(d){data=d;return this;},send(d){data=d;return this;}};await handler({url:'/api/'+path,method,body,headers:{host:'localhost',cookie,...headers}},res);return {status,data};}
const save=(key,value)=>memory.set(key,{value:Buffer.from(JSON.stringify(value)),etag:String(++etag)});
await test('family API and Telegram authorization',async t=>{
 await ensureFamily();const member1=await getPatient('member1'),owner=await getPatient('owner');const ac=gate+'; health_patient='+patientSession(member1,process.env.SESSION_SECRET),vc=gate+'; health_patient='+patientSession(owner,process.env.SESSION_SECRET);
 const id='a'.repeat(64);save('records/'+id+'.json',{id,path:'originals/'+id+'.pdf',name:'owner secret document',created:'2026-10-19',parsed:{documents:[]}});save('settings/profile.json',{name:'private',notes:['VITALIY_PRIVATE_NOTE']});
 await t.test('common gate alone cannot read health, files, export, or ask',async()=>{for(const route of ['record','export','file?id='+id])assert.equal((await request(route)).status,403);assert.equal((await request('ask',{body:{question:'anything'}})).status,403);});
 await t.test('member gets no owner notes, documents, ring, or activity; injected patient ignored',async()=>{const r=await request('record?patient=owner',{cookie:ac});assert.equal(r.status,200);assert.equal(r.data.patient.id,'member1');assert.equal(r.data.documents.length,0);assert.equal(r.data.record.ring,undefined);assert.ok(!JSON.stringify(r.data).includes('VITALIY_PRIVATE'));const mine=await request('record',{cookie:vc});assert.equal(mine.data.documents.length,1);assert.equal((await request('file?id='+id,{cookie:ac})).status,404);});
 await t.test('wrong personal password cannot create patient session',async()=>{assert.equal((await request('patient/login',{body:{id:'member1',password:'gate-test'}})).status,403);});
 await t.test('one-time Telegram code cannot be replayed, even concurrently',async()=>{const code=await createCode(member1);const results=await Promise.allSettled([consumeCode(code,'1'),consumeCode(code,'2')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await assert.rejects(consumeCode(code,'3'));});
 await t.test('forged Telegram webhook rejected before processing',async()=>assert.equal((await request('telegram/webhook',{body:{update_id:1},cookie:'',headers:{'x-telegram-bot-api-secret-token':'wrong'}})).status,401));
 await t.test('version revocation invalidates existing patient sessions',async()=>{save('family/patients/member1.json',{...member1,version:2});assert.equal((await request('record',{cookie:ac})).status,403);});
 await t.test('only organizer adds patients; every profile needs own password',async()=>{assert.equal((await request('patients/create',{cookie:ac,body:{}})).status,403);assert.equal((await request('patients/create',{cookie:vc,body:{name:'Parent',species:'human',password:'new-password'}})).status,200);});
 await t.test('renaming only changes authenticated patient metadata and preserves access version',async()=>{
  const current=await getPatient('member1');const cookie=gate+'; health_patient='+patientSession(current,process.env.SESSION_SECRET);
  const r=await request('patient/name',{cookie,body:{name:'Corrected test name',id:'owner'}});assert.equal(r.status,200);assert.equal(r.data.patient.id,'member1');
  const updated=await getPatient('member1');assert.equal(updated.version,current.version);assert.ok(updated.aliases.includes(current.name));assert.equal((await getPatient('owner')).name,'owner');
 });
 await t.test('requested short personal passwords accepted; three characters rejected',async()=>{
  assert.equal((await request('patients/create',{cookie:vc,body:{name:'Test member',species:'human',password:'2468'}})).status,200);
  assert.equal((await request('patients/create',{cookie:vc,body:{name:'Test member',species:'human',password:'246'}})).status,400);
  assert.equal((await request('patient/password',{cookie:vc,body:{current:'personal-owner',password:'2468'}})).status,200);
  const login=await request('patient/login',{body:{id:'owner',password:'2468'}});assert.equal(login.status,200);
 });

});
await test('Telegram workflow routes documents only after authorized confirmation',async t=>{
 const {handleTelegram}=await import('./telegram.mjs');const {patientContext}=await import('./storage.mjs');process.env.TELEGRAM_BOT_TOKEN='test-not-real';const originalFetch=globalThis.fetch;const sent=[];let sequence=100;const saves=[],questions=[];
 globalThis.fetch=async(url,options)=>{if(String(url).includes('/getFile'))return Response.json({ok:true,result:{file_path:'test.jpg',file_size:3}});if(String(url).includes('/file/bot'))return new Response(Buffer.from([255,216,255]));sent.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});return Response.json({ok:true,result:{}});};
 const services={parseDocument:async()=>({id:'test-doc',patientName:'member1',patientSpecies:'human',type:'image/jpeg',name:'test.jpg',data:'',parsed:{documents:[]}}),saveDocument:async()=>{saves.push(patientContext().id);return {message:'saved'};},askPatient:async q=>{questions.push({patient:patientContext().id,q});return 'answer';}};
 const message=(text,extra={})=>({update_id:sequence++,message:{from:{id:123},chat:{type:'private',id:123},text,...extra}});const callback=data=>({update_id:sequence++,callback_query:{id:'cb-'+sequence,from:{id:123},message:{chat:{type:'private',id:123}},data}});
 try{
  const member1=await getPatient('member1');const code=await createCode(member1);await handleTelegram(message('/start '+code),services);
  await t.test('question scoped to Telegram owner patient',async()=>{await handleTelegram(message('my question'),services);assert.equal(questions.at(-1).patient,'member1');});
  await t.test('forged selection cannot access owner',async()=>{await handleTelegram(callback('select:owner'),services);await handleTelegram(message('next question'),services);assert.equal(questions.at(-1).patient,'member1');});
  await t.test('photo remains pending until confirmation and rejects wrong target',async()=>{await handleTelegram(message('',{photo:[{file_id:'file',file_size:3}]}),services);assert.equal(saves.length,0);const prompt=sent.findLast(x=>x.body.reply_markup);const action=prompt.body.reply_markup.inline_keyboard[0][0].callback_data;assert.ok(action.endsWith(':member1'));await handleTelegram(callback(action.replace(':member1',':owner')),services);assert.equal(saves.length,0);await handleTelegram(callback(action),services);assert.deepEqual(saves,['member1']);await handleTelegram(callback(action),services);assert.deepEqual(saves,['member1']);});
  await t.test('unlinked sender gets no personal answer',async()=>{await handleTelegram(message('/unlink'),services);const before=questions.length;await handleTelegram(message('my health'),services);assert.equal(questions.length,before);});
 }finally{globalThis.fetch=originalFetch;}
});
await test('successful logins never consume failure quota; patients are isolated',async()=>{
 for(let i=0;i<20;i++)assert.equal((await request('patient/login',{body:{id:'owner',password:'2468'},headers:{'x-forwarded-for':'good-client'}})).status,200);
 for(let i=0;i<12;i++)assert.equal((await request('patient/login',{body:{id:'owner',password:'incorrect'},headers:{'x-forwarded-for':'bad-client'}})).status,403);
 const denied=await request('patient/login',{body:{id:'owner',password:'2468'},headers:{'x-forwarded-for':'bad-client'}});assert.equal(denied.status,429);assert.ok(denied.data.retryAfter>0);
 assert.equal((await request('patient/login',{body:{id:'member1',password:'personal-member1'},headers:{'x-forwarded-for':'bad-client'}})).status,200);
 assert.equal((await request('patient/login',{body:{id:'owner',password:'2468'},headers:{'x-forwarded-for':'another-client'}})).status,200);
});
