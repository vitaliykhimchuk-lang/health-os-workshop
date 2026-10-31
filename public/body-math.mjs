export const bodyMetricLabels={weightKg:'Вес',heightCm:'Рост',bmi:'ИМТ',bodyFatPercent:'Доля жира',fatMassKg:'Жировая масса',fatFreeMassKg:'Безжировая масса',muscleMassKg:'Мышечная масса',skeletalMuscleKg:'Скелетные мышцы',boneMassKg:'Костная масса',basalMetabolismKcal:'Основной обмен',waterL:'Общая вода',intracellularWaterL:'Внутриклеточная вода',extracellularWaterL:'Внеклеточная вода',proteinKg:'Белок',visceralFatLevel:'Уровень висцерального жира',metabolicAgeYears:'Метаболический возраст',score:'Оценка прибора',impedanceOhm:'Импеданс'};
export const bodyMetricKeys=Object.keys(bodyMetricLabels);
export function bodyMeasurements(entries){
 const rows=[];
 for(const entry of entries)for(const doc of entry.parsed?.documents||[]){
  if(!Array.isArray(doc.bodyMetrics)||!doc.bodyMetrics.length)continue;
  const metrics=doc.bodyMetrics.filter(m=>bodyMetricKeys.includes(m.key)&&Number.isFinite(m.value)&&m.value>=0&&typeof m.unit==='string');
  if(metrics.length)rows.push({date:/^\d{4}-\d{2}-\d{2}$/.test(doc.date||'')?doc.date:'',source:doc.source_name||'',summary:doc.summary||'',documentId:entry.id,name:entry.name,metrics});
 }
 return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.documentId.localeCompare(b.documentId));
}
export function bodySeries(rows,key){return rows.filter(r=>r.date).flatMap(r=>r.metrics.filter(m=>m.key===key).map(m=>({date:r.date,value:m.value,unit:m.unit,source:r.source}))).sort((a,b)=>a.date.localeCompare(b.date));}
