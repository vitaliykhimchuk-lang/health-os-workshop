import test from 'node:test';import assert from 'node:assert/strict';import {parseExerciseDiary} from './exercise-diary.mjs';
test('extracts exercise evidence without step counts or unrelated diary sentences',()=>{const e=parseExerciseDiary([['01.02.2026','Сделал 12 отжиманий, 15 повторений на пресс и прошёл 7 800 шагов.','']]);assert.equal(e.length,1);assert.match(e[0].notes[0],/12 отжиманий/);assert.doesNotMatch(JSON.stringify(e),/шаг|800|поработал|футбол/);});
test('negation stays evidence, blank days are not zero workouts; duplicates collapse',()=>{const row=['02.02.2026','Спорта не было.',''];const r=parseExerciseDiary([row,row,['03.02.2026','','']]);assert.equal(r.length,1);assert.deepEqual(r[0].notes,['Спорта не было.']);});
test('invalid dates and input are handled without fake diary entries',()=>{assert.deepEqual(parseExerciseDiary([['99.99.2026','Отжимался.','']]),[]);assert.throws(()=>parseExerciseDiary('oops'));});

test('rejects the legacy private diary format',()=>assert.throws(()=>parseExerciseDiary([['01.02.2026','title','private diary','categories']])));
