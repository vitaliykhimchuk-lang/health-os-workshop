import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildRecord} from './core.mjs';import {bodySeries} from '../public/body-math.mjs';
test('body measurements remain separate from blood tests and preserve dates and provenance',()=>{
 const entry=(id,date,value)=>({id,name:'synthetic scale.jpg',parsed:{documents:[{doc_type:'other',date,source_name:'Test scale',summary:'Synthetic measurement',bodyMetrics:[{key:'weightKg',value,unit:'kg'},{key:'bodyFatPercent',value:21,unit:'%'},{key:'fake',value:42,unit:'x'}],reminders:[]}]}});
 const r=buildRecord([entry('a','2026-01-10',80),entry('b','2026-02-10',79),entry('c','',78)]);
 assert.equal(r.biomarkers.length,0);assert.equal(r.bodyMeasurements.length,3);assert.equal(r.bodyMeasurements[0].date,'2026-02-10');assert.equal(r.bodyMeasurements[0].metrics.length,2);assert.equal(r.reports.length,3);assert.deepEqual(bodySeries(r.bodyMeasurements,'weightKg').map(x=>x.value),[80,79]);
});
test('missing or malformed body metrics cannot create an invented measurement',()=>{const r=buildRecord([{id:'x',parsed:{documents:[{doc_type:'other',bodyMetrics:[{key:'weightKg',value:NaN,unit:'kg'},{key:'bmi',value:-1,unit:'x'}]}]}}]);assert.deepEqual(r.bodyMeasurements,[]);});
