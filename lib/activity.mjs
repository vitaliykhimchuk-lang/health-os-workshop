export const ACTIVITY_FIELDS=['steps','distanceKm','activeKcal','exerciseMinutes','standHours','restingHR','walkingHR','hrvMs','vo2Max','respiratoryRate','oxygenPercent'];
export function validateActivity(days){
 if(!Array.isArray(days)||!days.length||days.length>90)throw Error('Отправьте от 1 до 90 дней за один раз.');
 const used=new Set();return days.map(d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||new Date(d.date+'T12:00:00Z').toISOString().slice(0,10)!==d.date||used.has(d.date))throw Error('Неверные или повторяющиеся даты активности.');used.add(d.date);
  if(d.source!=='Apple Watch')throw Error('Раздел активности принимает только данные Apple Watch.');
  const out={date:d.date,source:'Apple Watch',device:String(d.device||'Apple Watch').slice(0,200),importedAt:new Date().toISOString()};
  for(const k of ACTIVITY_FIELDS){const v=d[k];if(v!==null&&v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Некорректное значение '+k);out[k]=v??null;}
  if(!Array.isArray(d.workouts)||d.workouts.length>100)throw Error('Некорректный список тренировок.');
  out.workouts=d.workouts.map(w=>{if(typeof w.minutes!=='number'||!Number.isFinite(w.minutes)||w.minutes<0||w.minutes>2880)throw Error('Некорректная длительность тренировки.');return {type:String(w.type||'Workout').slice(0,100),start:String(w.start||'').slice(0,40),end:String(w.end||'').slice(0,40),minutes:w.minutes};});return out;
 });
}
export function summarizeActivity(days){const selected=days.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);return {source:'Apple Watch',days:selected,lastImport:days.map(d=>d.importedAt).sort().at(-1)||null,totalDays:days.length,note:'Шаги только Apple Watch. Сон и ночной HRV берутся из Ultrahuman. HRV Apple Watch — отдельный показатель SDNN.'};}
