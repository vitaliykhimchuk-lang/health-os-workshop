const fail=()=>{throw Object.assign(Error('Проверьте формат разбора анализа.'),{status:400});};
export function validateLabDocuments(documents){
 if(!Array.isArray(documents)||!documents.length||documents.length>20)fail();
 for(const d of documents){if(d.doc_type!=='analysis'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||typeof d.source_name!=='string'||d.source_name.length>200||typeof d.summary!=='string'||d.summary.length>18000||!Array.isArray(d.markers)||d.markers.length>300)fail();for(const m of d.markers){if(!Number.isFinite(m.value)||!['name','unit','ref','key'].every(k=>typeof m[k]==='string'&&m[k].length<1500)||!['ok','low','high'].includes(m.flag)||m.comparator&&!['=','<','>','<=','>='].includes(m.comparator))fail();}}
 return documents;
}
export function validateLabNotes(input){
 if(!input||!Array.isArray(input.documentIds)||!input.documentIds.length||input.documentIds.length>20||input.documentIds.some(x=>!/^[a-f0-9]{64}$/.test(x))||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||typeof input.title!=='string'||input.title.length>200||typeof input.intro!=='string'||input.intro.length>12000||!Array.isArray(input.sections)||input.sections.length>20||!Array.isArray(input.actions)||input.actions.length>20||!Array.isArray(input.sources)||input.sources.length>20||JSON.stringify(input).length>100000)fail();
 for(const s of input.sections){if(typeof s.title!=='string'||s.title.length>200||!Array.isArray(s.items)||s.items.length>100)fail();for(const item of s.items)if(!['name','result','reference','meaning'].every(k=>typeof item[k]==='string'&&item[k].length<6000))fail();}
 if(input.actions.some(x=>typeof x!=='string'||x.length>3000)||input.sources.some(x=>typeof x.title!=='string'||x.title.length>200||typeof x.url!=='string'||x.url.length>1000||!x.url.startsWith('https://')))fail();
 return {documentIds:[...new Set(input.documentIds)],date:input.date,title:input.title,intro:input.intro,sections:input.sections.map(s=>({title:s.title,items:s.items.map(({name,result,reference,meaning})=>({name,result,reference,meaning}))})),actions:input.actions,sources:input.sources.map(({title,url})=>({title,url}))};
}
