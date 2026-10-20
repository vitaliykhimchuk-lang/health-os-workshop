import {zipEntries,extractEntry} from './zip-reader.mjs';
import {watchSources,parseAppleHealth} from './apple-health.mjs';
let xml=null;
const progress=text=>postMessage({type:'progress',text});
const supported=/type="(?:HKQuantityTypeIdentifier(?:StepCount|DistanceWalkingRunning|ActiveEnergyBurned|AppleExerciseTime|RestingHeartRate|WalkingHeartRateAverage|HeartRateVariabilitySDNN|VO2Max|RespiratoryRate|OxygenSaturation)|HKCategoryTypeIdentifierAppleStandHour)"/;
function scanner(){let tail='',opened=false,closed=false,scanned=0,lastProgress=0,keptSize=0;const kept=[];const decoder=new TextDecoder();return {
 push(bytes,final=false){scanned+=bytes.length;if(scanned>2*1024**3)throw Error('Распакованный XML больше 2 ГБ. Для этого архива нужна подготовка на Mac.');tail+=decoder.decode(bytes,{stream:!final});if(/<HealthData(?:\s|>)/.test(tail))opened=true;if(tail.includes('</HealthData>'))closed=true;
 let end=0;for(const m of tail.matchAll(/<(?:Record|Workout)\b[^>]*>/g)){end=m.index+m[0].length;if(m[0].startsWith('<Workout')||supported.test(m[0])){keptSize+=m[0].length;if(keptSize>120*1024**2)throw Error('Слишком много данных активности для обработки на телефоне. Попробуйте открыть архив на Mac.');kept.push(m[0]);}}
 tail=tail.slice(Math.max(end,tail.length-65536));if(scanned-lastProgress>16*1024**2){progress(`Читаю экспорт: обработано ${Math.round(scanned/1024**2)} МБ XML. Выбираю только данные активности…`);lastProgress=scanned;}
 },finish(){if(!opened||!closed)return null;return '<HealthData>'+kept.join('\n')+'</HealthData>';}};}
async function readExport(file){const isZip=/\.zip$/i.test(file.name)||/zip/i.test(file.type);if(file.size>(isZip?1024**3:2*1024**3))throw Error(isZip?'ZIP больше 1 ГБ. Для такого архива используйте Mac.':'XML больше 2 ГБ. Для такого архива используйте Mac.');
 progress(isZip?'Читаю ZIP по частям на вашем устройстве. Большой экспорт может обрабатываться несколько минут…':'Читаю XML по частям на вашем устройстве…');
 let result=null;let foundXml=false;
 if(!isZip){const reader=file.stream().getReader();const scan=scanner();try{for(;;){const {done,value}=await reader.read();if(done)break;scan.push(value);}scan.push(new Uint8Array(),true);return scan.finish();}finally{await reader.cancel();}}
 const entries=(await zipEntries(file)).filter(e=>/\.xml$/i.test(e.name)&&!/(?:export_cda|workout|route)/i.test(e.name));
 for(const entry of entries){foundXml=true;const scan=scanner();await extractEntry(file,entry,(bytes,final)=>scan.push(bytes,final));result=scan.finish();if(result)break;}

 if(!foundXml)throw Error('В ZIP нет XML из Apple «Здоровье». Нужен полный экспорт здоровья, а не GPX тренировки.');return result;
}
self.onmessage=async({data})=>{try{
 if(data.type==='read'){xml=null;xml=await readExport(data.file);if(!xml)throw Error('Не найден полный XML Apple «Здоровье». Возможно, ZIP повреждён или выбран другой экспорт.');progress('Ищу ваши Apple Watch в данных активности…');const sources=watchSources(xml);if(!sources.length)throw Error('В экспорте нет поддерживаемых данных активности Apple Watch. Проверьте полный экспорт «Здоровья» с данными часов.');postMessage({type:'ready',sources});}
 else if(data.type==='parse'){if(!xml)throw Error('Сначала выберите экспорт здоровья.');progress('Собираю дневные показатели выбранных часов…');const days=parseAppleHealth(xml,data.source);if(!days.length)throw Error('Для выбранных часов нет поддерживаемых данных активности. Выберите другой источник часов.');postMessage({type:'days',days});}
 }catch(error){postMessage({type:'error',text:error.message||'Не удалось прочитать архив. Попробуйте выбрать распакованный XML.'});}};
