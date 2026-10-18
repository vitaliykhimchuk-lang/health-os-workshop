import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDay,summarizeRing,datesBefore} from './ultrahuman.mjs';
const entry={date:'2026-10-18',syncedAt:'2026-10-19T00:00:00Z',payload:{data:{metrics:{'2026-10-18':[{type:'sleep',object:{total_sleep:{seconds:24420},sleep_score:{score:71},deep_sleep:{minutes:97},rem_sleep:{minutes:110},sleep_efficiency:{percentage:96},temperature_deviation:{celsius:.63}}},{type:'avg_sleep_hrv',object:{value:63}},{type:'steps',object:{total:4377}}]}}}};
test('sleep seconds and stages are converted explicitly; missing heart rate stays null',()=>{const d=normalizeDay(entry);assert.equal(d.sleepHours,24420/3600);assert.equal(d.deepSleepMin,97);assert.equal(d.hrvMs,63);assert.equal(d.restingHR,null);assert.equal(d.ringSteps,4377);assert(!('steps' in d));});
test('unknown responses do not become fictitious nights',()=>assert.equal(normalizeDay({date:'2026-10-18',payload:{}}),null));
test('summary uses observed nights only',()=>{const r=summarizeRing([entry]);assert.equal(r.summary.nights,1);assert.equal(r.summary.sleepHoursMean7,6.78);assert.equal(r.summary.restingHRMean7,null);});
test('sync window contains seven unique dates',()=>assert.equal(new Set(datesBefore(new Date('2026-10-19T12:00:00Z'))).size,7));
