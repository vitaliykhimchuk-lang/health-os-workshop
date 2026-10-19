import {randomBytes,scryptSync,createHmac,createHash} from 'node:crypto';
import {safeEqual} from './core.mjs';
import {rawRead,rawWrite,rawList,mutate} from './storage.mjs';
export const digest=s=>createHash('sha256').update(s).digest('hex');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(String(password),salt,32).toString('hex');}
export function passwordMatches(password,hash){const [salt,value]=String(hash||'').split(':');if(!salt||!value)return false;return safeEqual(value,scryptSync(String(password).slice(0,256),salt,32).toString('hex'));}
export function patientSession(p,secret,expires=Date.now()+12*3600000){const body=Buffer.from(JSON.stringify({id:p.id,version:p.version,exp:expires})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('hex');}
export function sessionClaims(value,secret){try{const [body,sig]=value.split('.');if(!safeEqual(sig,createHmac('sha256',secret).update(body).digest('hex')))return null;const c=JSON.parse(Buffer.from(body,'base64url'));return c.exp>Date.now()&&/^[-a-z0-9]{1,48}$/.test(c.id)?c:null;}catch{return null;}}
export function publicPatient(p){return {id:p.id,name:p.name,species:p.species,admin:p.id==='owner'};}
export async function ensureFamily(){
 if(await rawRead('family/initialized.json'))return;
 const initial=JSON.parse(process.env.FAMILY_INITIAL_PROFILES||'[]');if(!initial.some(p=>p.id==='owner'))throw Error('Семейный доступ ещё не настроен.');
 for(const p of initial){if(!/^[-a-z0-9]{1,48}$/.test(p.id))throw Error('Invalid patient');if(await rawRead(`family/patients/${p.id}.json`))continue;try{await rawWrite(`family/patients/${p.id}.json`,{...p,version:1,created:new Date().toISOString()});}catch(e){if(!String(e.name+e.message).match(/already|exists/i))throw e;}}
 try{await rawWrite('family/initialized.json',{ready:true});}catch(e){if(!String(e.name+e.message).match(/already|exists/i))throw e;}
}
export async function patients(){await ensureFamily();return Promise.all((await rawList('family/patients/')).map(async b=>(await rawRead(b.pathname)).data));}
export async function getPatient(id){if(!/^[-a-z0-9]{1,48}$/.test(id||''))return null;return (await rawRead(`family/patients/${id}.json`))?.data||null;}
export async function authenticatedPatient(value,secret){const c=sessionClaims(value||'',secret);if(!c)return null;const p=await getPatient(c.id);return p&&p.version===c.version?p:null;}
export async function rateLimit(key,max=12,minutes=15){const now=Date.now();const r=await mutate('family/limits/'+digest(key)+'.json',old=>{if(!old||old.until<now)old={count:0,until:now+minutes*60000};return {...old,count:old.count+1};});return r.count<=max;}
export async function createCode(patient){const token=randomBytes(24).toString('base64url');await rawWrite('family/codes/'+digest(token)+'.json',{patientId:patient.id,version:patient.version,expires:Date.now()+600000,used:false});return token;}
export async function consumeCode(code,userId){if(!/^[A-Za-z0-9_-]{32}$/.test(code))throw Error('Код неверный или истёк.');let result;await mutate('family/codes/'+digest(code)+'.json',async old=>{if(!old||old.used||old.expires<Date.now())throw Error('Код неверный или истёк.');const p=await getPatient(old.patientId);if(!p||p.version!==old.version)throw Error('Код больше не действует.');result=p;return {...old,used:true,usedBy:String(userId)};});return result;}
export function allowedIds(binding,all){return (binding?.links||[]).filter(link=>all.some(p=>p.id===link.id&&p.version===link.version)).map(l=>l.id);}

export async function loginWait(key,max=12){const state=(await rawRead('family/login-limits-v2/'+digest(key)+'.json'))?.data;return state&&state.count>=max&&state.until>Date.now()?Math.ceil((state.until-Date.now())/1000):0;}
export async function loginFailed(key){const now=Date.now();return mutate('family/login-limits-v2/'+digest(key)+'.json',old=>{if(!old||old.until<=now)old={count:0,until:now+5*60000};return {...old,count:old.count+1};});}
export async function loginSucceeded(key){await mutate('family/login-limits-v2/'+digest(key)+'.json',()=>({count:0,until:0}));}
