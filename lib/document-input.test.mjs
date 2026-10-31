import test from 'node:test';import assert from 'node:assert/strict';import {prepareDocument,archiveOnly,withParsed,documentContent} from './document-input.mjs';import {buildRecord} from './core.mjs';
const input={name:'ring-report.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.7\nsynthetic fixture').toString('base64')};
test('valid original survives an unreadable or unsupported report with no invented observations',()=>{const prepared=prepareDocument(input),d=archiveOnly(prepared);assert.equal(d.data,input.data);assert.equal(d.parseStatus,'unparsed');assert.deepEqual(d.parsed.documents,[]);assert.equal(d.patientSpecies,'unknown');assert.equal(withParsed(prepared,{documents:[]}).parseStatus,'unparsed');});
test('wearable report becomes chat context without laboratory or visit entries',()=>{const parsed={patientName:'Test person',patientSpecies:'human',documents:[{doc_type:'other',date:'2026-10-01',source_name:'Wearable',summary:'Synthetic sleep: 7 h',markers:[],reminders:[]}]};const d=withParsed(prepareDocument(input),parsed);assert.equal(d.parseStatus,'parsed');const r=buildRecord([{...d,created:'2026-10-01'}]);assert.equal(r.reports.length,1);assert.equal(r.reports[0].summary,'Synthetic sleep: 7 h');assert.equal(r.biomarkers.length,0);assert.equal(r.visits.length,0);});
test('unknown formats and incorrect MIME never discard a valid original; size and empty checks remain',()=>{const d=prepareDocument({...input,data:Buffer.from('not a pdf').toString('base64')});assert.equal(d.type,'application/octet-stream');assert.equal(documentContent(d).content,undefined);assert.throws(()=>prepareDocument(input,5));assert.throws(()=>prepareDocument({...input,data:''}));assert.equal(prepareDocument({...input,type:'application/zip'}).type,'application/pdf');});


import {zipSync,strToU8} from 'fflate';
test('text, office XML, and screenshots are read independently of a supplied MIME label',()=>{
 const prepare=(name,bytes)=>prepareDocument({name,type:'application/octet-stream',data:Buffer.from(bytes).toString('base64')});
 assert.ok(documentContent(prepare('report.txt',Buffer.from('Synthetic measurement: 42'))).content.text.includes('42'));
 const zipped=zipSync({'word/document.xml':strToU8('<w:document>Synthetic test report</w:document>'),'media/image.bin':new Uint8Array(20)});
 const source=documentContent(prepare('report.docx',zipped));assert.ok(source.content.text.includes('Synthetic test report'));assert.ok(!source.content.text.includes('media/image.bin'));
 const xlsx=zipSync({'xl/sharedStrings.xml':strToU8('<si>synthetic label</si>'),'xl/worksheets/sheet1.xml':strToU8('<c><v>42</v></c>')});assert.ok(documentContent(prepare('report.xlsx',xlsx)).content.text.includes('42'));
 assert.equal(prepare('unknown.dat',Buffer.from([255,216,255])).type,'image/jpeg');
 assert.ok(documentContent(prepare('broken.docx',Buffer.from('bad zip'))).reason.includes('сохранён'));
});
