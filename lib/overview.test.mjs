import {test} from 'node:test';import assert from 'node:assert/strict';
import {overviewSummary,ageOn} from '../public/overview-math.mjs';
const day=(i)=>new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10);
const row=(date,key,value,unit='kg',source='Test scale')=>({date,source,metrics:[{key,value,unit}]});
test('personal overview compares calendar periods and reports stale sources without inventing a current health state',()=>{
 const days=Array.from({length:60},(_,i)=>({date:day(i),steps:i<30?4000:6000,exerciseMinutes:20,workouts:i%10===0?[{minutes:30}]:[]}));
 const record={profile:{birth:'1980-06-01'},activity:{days},ring:{days:days.map(d=>({date:d.date,sleepHours:7,hrvMs:50,restingHR:60}))},bodyMeasurements:[row(day(10),'weightKg',80),row(day(40),'weightKg',79)],biomarkers:[],visits:[],reports:[]};
 const s=overviewSummary(record,[{dates:[day(10)]}],30,'2026-03-15');assert.equal(s.age,45);assert.equal(s.weight.value,79);assert.equal(s.weightDelta,-1);assert.equal(s.activity.metrics.steps.current,6000);assert.equal(s.activity.metrics.steps.previous,4000);assert.equal(s.activity.metrics.steps.delta,2000);assert.equal(s.activity.staleDays,14);assert.equal(s.year.workouts,6);assert.equal(s.coverage.documents,1);
 assert.equal(s.sleep.metrics.sleepHours.current,7);assert.equal(s.sleep.metrics.hrvMs.current,50);
});
test('missing samples, unknown personal facts and future dates are not fabricated or averaged as zero',()=>{
 const record={profile:{},activity:{days:[{date:'2026-01-01',steps:5000},{date:'2026-01-30',steps:7000},{date:'2027-01-01',steps:99000}]},ring:{days:[]},bodyMeasurements:[row('2026-01-01','weightKg',80),row('2026-01-31','weightKg',79,'lb','Another scale')],biomarkers:[]};
 const s=overviewSummary(record,[],30,'2026-02-01');assert.equal(s.age,null);assert.equal(s.activity.metrics.steps.current,6000);assert.equal(s.activity.metrics.steps.count,2);assert.equal(s.activity.metrics.steps.delta,null);assert.equal(s.sleep.metrics.sleepHours.current,null);assert.equal(s.height,null);assert.equal(s.weightDelta,null);assert.equal(s.year.stepDays,2);assert.equal(s.year.steps,12000);
});
test('year view describes only available data and age is calculated from birth, not scale configuration',()=>{
 assert.equal(ageOn('2000-11-01','2026-10-31'),25);assert.equal(ageOn('2000-10-31','2026-10-31'),26);assert.equal(ageOn('2000-02-31','2026-10-31'),null);assert.equal(ageOn('2030-01-01','2026-10-31'),null);
 const s=overviewSummary({profile:{},activity:{days:[{date:'2026-01-01',steps:1000}]},bodyMeasurements:[]},[],365,'2026-10-31');assert.equal(s.year.watchDays,1);assert.equal(s.year.steps,1000);assert.equal(s.activity.metrics.steps.delta,null);assert.equal(s.age,null);
});
