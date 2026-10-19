import test from 'node:test';import assert from 'node:assert/strict';import {parseAuto,autoDays,packetId} from './auto-activity.mjs';
const packet=(name,points,units='count')=>parseAuto({data:{metrics:[{name,units,data:points}]}});
const p=(qty,source='Apple Watch',time='10:00:00')=>({qty,source,date:'2026-10-18 '+time+' +0100'});
test('only sourced watch samples, never phone or anonymous',()=>{const x=packet('step_count',[p(100),p(500,'iPhone'),p(600,'')]);assert.equal(x.skipped,2);assert.equal(autoDays(x.groups)[0].steps,100);});
test('repeated packets and overlapping batches do not double steps',()=>{const a=packet('step_count',[p(100)]).groups[0],b=packet('step_count',[p(100),p(50,'Apple Watch','11:00:00')]).groups[0];assert.equal(packetId(a),packetId({...a}));assert.equal(autoDays([a,a,b])[0].steps,150);});
test('separate metric batches retain other metrics and convert units',()=>{const a=packet('step_count',[p(100)]),b=packet('walking_running_distance',[p(1000)],'m');const d=autoDays([...a.groups,...b.groups])[0];assert.equal(d.steps,100);assert.equal(d.distanceKm,1);assert.equal(d.sleepHours,undefined);});
test('multiple watches are never summed',()=>{const a=packet('step_count',[p(100,'Old Apple Watch'),p(200,'New Apple Watch','12:00:00')]);assert.equal(autoDays(a.groups)[0].steps,200);});
