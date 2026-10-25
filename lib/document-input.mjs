import {createHash} from 'node:crypto';
export const documentError=(message,status=400)=>Object.assign(Error(message),{status});
export function prepareDocument(input,maxBytes=3000000){
 const {name,type,data}=input||{};if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(type)||typeof data!=='string'||data.length>Math.ceil(maxBytes*4/3)+8)throw documentError('Выберите PDF или изображение допустимого размера.');
 const bytes=Buffer.from(data,'base64');if(!bytes.length||bytes.length>maxBytes)throw documentError('Файл слишком большой.');
 const signature=type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!signature)throw documentError('Содержимое не соответствует формату файла.');
 return {id:createHash('sha256').update(bytes).digest('hex'),name:String(name||'document').replace(/[\r\n]/g,'').slice(0,180),type,data};
}
export function archiveOnly(input){return {...input,parsed:{documents:[],patientName:'',patientSpecies:'unknown'},patientName:'',patientSpecies:'unknown',parseStatus:'unparsed',parseNotice:'Автоматический разбор не выполнен. Можно сохранить оригинал в архив выбранной карты; показатели из него пока не добавлены.'};}
export function withParsed(input,parsed){const useful=Array.isArray(parsed?.documents)&&parsed.documents.some(d=>d.doc_type==='visit'||d.doc_type==='analysis'&&d.markers?.length||d.doc_type==='other'&&typeof d.summary==='string'&&d.summary.trim());return useful?{...input,parsed,patientName:parsed.patientName,patientSpecies:parsed.patientSpecies,parseStatus:'parsed'}:archiveOnly(input);}
