// Parses Apple's XML locally: raw archive and unrelated health records stay on the device.
const decode=s=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function attrs(s){return Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));}
function watchKey(a){const device=a.device||'';if(!/watch/i.test(a.sourceName||'')&&!/watch/i.test(device))return null;const hw=device.match(/hardware:\s*(Watch\d+,\d+)/i)?.[1]||'';return (a.sourceName||'Apple Watch')+(hw?' · '+hw:'');}
export function watchSources(xml){const sources=new Set();for(const m of xml.matchAll(/<(?:Record|Workout)\b([^>]*?)(?:\/?>)/g)){const key=watchKey(attrs(m[1]));if(key)sources.add(key);}return [...sources].sort();}
export function parseAppleHealth(xml,source){
 if(!xml.includes('<HealthData')||!xml.includes('</HealthData>'))throw Error('Нужен файл export.xml из Apple «Здоровье».');
 const days=new Map(),seen=new Set(),workoutSeen=new Set();
 const dayFor=date=>{if(!days.has(date))days.set(date,{date,source:'Apple Watch',device:source,steps:null,distanceKm:null,activeKcal:null,exerciseMinutes:null,standHours:null,restingHR:null,walkingHR:null,hrvMs:null,vo2Max:null,respiratoryRate:null,oxygenPercent:null,workouts:[],_samples:{},_hours:new Set()});return days.get(date);};
 const specs={HKQuantityTypeIdentifierStepCount:['steps','count'],HKQuantityTypeIdentifierDistanceWalkingRunning:['distanceKm','km'],HKQuantityTypeIdentifierActiveEnergyBurned:['activeKcal','kcal'],HKQuantityTypeIdentifierAppleExerciseTime:['exerciseMinutes','min'],HKQuantityTypeIdentifierRestingHeartRate:['restingHR','count/min'],HKQuantityTypeIdentifierWalkingHeartRateAverage:['walkingHR','count/min'],HKQuantityTypeIdentifierHeartRateVariabilitySDNN:['hrvMs','ms'],HKQuantityTypeIdentifierVO2Max:['vo2Max','mL/min·kg'],HKQuantityTypeIdentifierRespiratoryRate:['respiratoryRate','count/min'],HKQuantityTypeIdentifierOxygenSaturation:['oxygenPercent','%']};
 for(const m of xml.matchAll(/<Record\b([^>]*?)(?:\/?>)/g)){
  const a=attrs(m[1]);if(watchKey(a)!==source)continue;const spec=specs[a.type];if(!spec&&a.type!=='HKCategoryTypeIdentifierAppleStandHour')continue;
  const date=a.startDate?.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))continue;const id=[a.type,a.startDate,a.endDate,a.value,a.unit].join('|');if(seen.has(id))continue;seen.add(id);
  if(a.type==='HKCategoryTypeIdentifierAppleStandHour'){if(['HKCategoryValueAppleStandHourStood','HKCategoryValueAppleStandHourIdle'].includes(a.value)){const d=dayFor(date);if(a.value==='HKCategoryValueAppleStandHourStood')d._hours.add(a.startDate.slice(11,13));d.standHours=d._hours.size;}continue;}
  const [key,expected]=spec;let value=Number(a.value);if(!Number.isFinite(value)||value<0)continue;
  if(key==='distanceKm'&&a.unit==='mi')value*=1.609344;
  else if(key==='distanceKm'&&a.unit==='m')value/=1000;
  else if(key==='activeKcal'&&a.unit==='kJ')value/=4.184;
  else if(key==='exerciseMinutes'&&a.unit==='s')value/=60;
  else if(key==='oxygenPercent'&&a.unit==='%'&&value<=1)value*=100;
  else if(a.unit!==expected&&!(key==='vo2Max'&&a.unit==='mL/(kg*min)'))continue;
  const d=dayFor(date);if(['steps','distanceKm','activeKcal','exerciseMinutes'].includes(key))d[key]=(d[key]??0)+value;
  else{const sample=d._samples[key]||(d._samples[key]=[]);sample.push(value);}
 }
 for(const m of xml.matchAll(/<Workout\b([^>]*?)(?:\/?>)/g)){
  const a=attrs(m[1]);if(watchKey(a)!==source)continue;const date=a.startDate?.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))continue;
  const id=[a.workoutActivityType,a.startDate,a.endDate].join('|');if(workoutSeen.has(id))continue;workoutSeen.add(id);
  const n=Number(a.duration);if(!Number.isFinite(n)||n<0||!['min','s','hr'].includes(a.durationUnit))continue;
  dayFor(date).workouts.push({type:a.workoutActivityType||'Workout',start:a.startDate,end:a.endDate||'',minutes:n*(a.durationUnit==='s'?1/60:a.durationUnit==='hr'?60:1)});
 }
 return [...days.values()].map(d=>{for(const [k,v]of Object.entries(d._samples))d[k]=v.reduce((a,b)=>a+b,0)/v.length;delete d._samples;delete d._hours;for(const[k,v]of Object.entries(d))if(typeof v==='number')d[k]=Math.round(v*100)/100;return d;}).sort((a,b)=>a.date.localeCompare(b.date));
}
