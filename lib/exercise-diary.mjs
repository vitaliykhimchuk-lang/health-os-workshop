// Accept only the dedicated three-column sports sheet. Never import the private diary.
export function parseExerciseDiary(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Object.assign(Error('Нужны строки дневника, не более 1000.'),{status:400});
 const entries=new Map();
 for(const row of rows){
  if(!Array.isArray(row)||row.length!==3||row.some(x=>typeof x!=='string'||x.length>12000))throw Object.assign(Error('Неверный формат строки дневника.'),{status:400});
  const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(row[0]||'');if(!m)continue;
  const date=`${m[3]}-${m[2]}-${m[1]}`;if(!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)continue;
  const notes=[row[1],row[2]].filter(Boolean).join('. ').split(/(?<=[.!?])\s+/u).map(s=>s.replace(/(?:[,;]?\s*(?:и\s+)?(?:про[шй]?[её]л|прош[её]л|прошла|нашагал|сделал)?\s*\d[\d\s\u00a0]*\s*шаг\S*)/giu,'').trim()).filter(Boolean);
  if(notes.length)entries.set(date,{date,notes:[...new Set([...(entries.get(date)?.notes||[]),...notes])].slice(0,12)});
 }
 return [...entries.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
