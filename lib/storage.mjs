import * as blob from '@vercel/blob';
import {AsyncLocalStorage} from 'node:async_hooks';
const context=new AsyncLocalStorage();
export const patientContext=()=>context.getStore();
export function inPatient(patient,fn){if(!patient||!/^[-a-z0-9]{1,48}$/.test(patient.id))throw Error('Invalid patient');return context.run(patient,fn);}
export function scopedPath(path){const p=patientContext();if(!p)throw Error('Patient context required');if(!/^(records|originals|settings|wearables|activity)\//.test(path)||path.includes('..')||path.includes('\\'))throw Error('Invalid storage path');return p.id==='owner'?path:`patients/${p.id}/${path}`;}
function unscoped(path){const p=patientContext();return p.id==='owner'?path:path.replace(`patients/${p.id}/`,'');}
export const put=(path,data,opts)=>blob.put(scopedPath(path),data,opts);
export const get=(path,opts)=>blob.get(scopedPath(path),opts);
export async function list(opts){const r=await blob.list({...opts,prefix:scopedPath(opts.prefix)});return {...r,blobs:r.blobs.map(b=>({...b,pathname:unscoped(b.pathname)}))};}
export async function rawRead(path){const r=await blob.get(path,{access:'private',useCache:false});return r?.stream?{data:await new Response(r.stream).json(),etag:r.blob.etag}:null;}
export async function rawWrite(path,data,etag){return blob.put(path,JSON.stringify(data),{access:'private',addRandomSuffix:false,contentType:'application/json',...(etag?{ifMatch:etag,allowOverwrite:true}:{allowOverwrite:false})});}
export async function rawSave(path,data){return blob.put(path,JSON.stringify(data),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});}
export async function rawList(prefix){let cursor,all=[];do{const r=await blob.list({prefix,limit:100,cursor});all.push(...r.blobs);cursor=r.hasMore?r.cursor:undefined;}while(cursor);return all;}
// Delivery ETags from get() can differ from the storage revision used by put(ifMatch).
// Bracket the uncached body read with metadata revisions to avoid lost updates.
async function mutationSnapshot(path){
 let before;try{before=await blob.head(path);}catch(e){if(e.name==='BlobNotFoundError')return null;throw e;}
 const old=await rawRead(path);let after;try{after=await blob.head(path);}catch(e){if(e.name==='BlobNotFoundError')return {retry:true};throw e;}
 return !old||before.etag!==after.etag?{retry:true}:{data:old.data,etag:after.etag};
}
export async function mutate(path,fn){for(let i=0;i<5;i++){const old=await mutationSnapshot(path);if(old?.retry)continue;const next=await fn(old?.data);try{await rawWrite(path,next,old?.etag);return next;}catch(e){if(!['BlobPreconditionFailedError','BlobAlreadyExistsError'].includes(e.name)&&!String(e.message).match(/precondition|already exists|etag/i))throw e;}}throw Error('Повторите запрос: данные обновляются.');}
