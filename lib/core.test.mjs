import test from 'node:test';
import assert from 'node:assert/strict';
import {session,validSession,buildRecord} from './core.mjs';
test('session rejects forged and expired cookies',()=>{const token=session('secret',Date.now()+10000);assert(validSession(token,'secret'));assert(!validSession(token,'other'));assert(!validSession(session('secret',1),'secret'));assert(!validSession('NaN.fake','secret'));});
test('lipids converted while unsupported units remain separate',()=>{const e={id:'one',parsed:{documents:[{doc_type:'analysis',date:'2026-01-01',source_name:'Lab',markers:[{key:'ldl',name:'LDL',value:112,unit:'mg/dl',ref:'<115',flag:'ok'},{key:'ldl',name:'LDL',value:50,unit:'other',ref:'',flag:'high'}],reminders:[]}]}};const r=buildRecord([e]);assert.equal(r.biomarkers.length,2);assert.equal(r.biomarkers[0].series[0].value,2.9);assert.equal(r.biomarkers[0].unit,'ммоль/л');assert.equal(r.biomarkers[1].unit,'other');assert.equal(r.biomarkers[0].series[0].original,'112 mg/dl');});
test('empty personal record contains no workshop patient',()=>{const r=buildRecord([]);assert.equal(r.biomarkers.length,0);assert.equal(r.visits.length,0);assert.equal(r.profile.name,'Моя медкарта');});
