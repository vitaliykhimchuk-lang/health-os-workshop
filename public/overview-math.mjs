import {comparison,windowDays,observed,average,stamp} from './activity-math.mjs';
import {bodySeries} from './body-math.mjs';
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(stamp(d))&&new Date(stamp(d)).toISOString().slice(0,10)===d;
export function ageOn(birth,today){if(!validDate(birth)||!validDate(today)||birth>today)return null;const b=new Date(birth+'T12:00:00Z'),t=new Date(today+'T12:00:00Z');const a=t.getUTCFullYear()-b.getUTCFullYear()-(today.slice(5)<birth.slice(5)?1:0);return a>=0&&a<=130?a:null;}
export function overviewSummary(record,documents=[],length=30,today=new Date().toISOString().slice(0,10)){
 if(![7,30,90,365].includes(length))length=30;
 const clean=rows=>(rows||[]).filter(d=>validDate(d.date)&&d.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 const ring=clean(record.ring?.days),watch=clean(record.activity?.days),body=record.bodyMeasurements||[];
 const latestMetric=key=>bodySeries(body,key).filter(d=>d.date<=today).at(-1)||null;
 const weight=latestMetric('weightKg'),height=latestMetric('heightCm'),bmi=latestMetric('bmi'),fat=latestMetric('bodyFatPercent');
 const weights=bodySeries(body,'weightKg').filter(d=>d.date<=today),previousWeight=weight?weights.slice(0,-1).findLast(d=>d.date<weight.date&&d.unit===weight.unit&&d.source===weight.source):null;
 const source=(days,keys)=>{const end=days.at(-1)?.date||null;return {end,staleDays:end?Math.floor((stamp(today)-stamp(end))/86400000):null,totalDays:days.length,first:days[0]?.date||null,metrics:Object.fromEntries(keys.map(k=>[k,end?{...comparison(days,k,end,length),points:windowDays(days,end,length).filter(d=>Number.isFinite(d[k])).map(d=>({date:d.date,value:d[k]}))}:{current:null,previous:null,count:0,previousCount:0,delta:null}]))};};
 const sleep=source(ring,['sleepHours','restingHR','hrvMs']),activity=source(watch,['steps','exerciseMinutes','restingHR','vo2Max']);
 const workouts=activity.end?windowDays(watch,activity.end,length).flatMap(d=>d.workouts||[]):[];
 const dates=[...new Set([...ring,...watch].map(d=>d.date).concat(body.map(d=>d.date),documents.flatMap(d=>d.dates||[])).filter(d=>validDate(d)&&d<=today))].sort();
 const yearStart=today.slice(0,4)+'-01-01',annualWatch=watch.filter(d=>d.date>=yearStart),annualRing=ring.filter(d=>d.date>=yearStart);
 const visits=(record.visits||[]).filter(v=>v.date>=yearStart&&v.date<=today),reports=(record.reports||[]).filter(v=>v.date>=yearStart&&v.date<=today);
 return {length,today,age:ageOn(record.profile?.birth,today),weight,height,bmi,fat,previousWeight,weightDelta:previousWeight?weight.value-previousWeight.value:null,sleep,activity,workouts:workouts.length,coverage:{first:dates[0]||null,last:dates.at(-1)||null,documents:documents.length,bodyMeasurements:body.length,labMetrics:record.biomarkers?.length||0},year:{label:today.slice(0,4),watchDays:annualWatch.length,ringDays:annualRing.length,steps:observed(annualWatch,'steps').reduce((a,b)=>a+b,0),stepDays:observed(annualWatch,'steps').length,workouts:annualWatch.flatMap(d=>d.workouts||[]).length,sleepMean:average(observed(annualRing,'sleepHours')),sleepNights:observed(annualRing,'sleepHours').length,visits:visits.length,reports:reports.length}};
}
