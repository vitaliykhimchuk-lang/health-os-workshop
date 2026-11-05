// Only exercise sentences leave the private source diary. Never import its step counts.
const exercise=/(отжим|присед|повторени\S*\s+на\s+пресс|качал\S*\s+пресс|планк|подтяг|трениров|занимал\S*\s+спорт|спорт\S*\s+не\s+был|не\s+было\s+спорт|растяж|пробеж|пробежал|плавал|поплавал|йог|пилатес|силов\S*\s+упражн)/iu;
export function parseExerciseDiary(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Object.assign(Error('Нужны строки дневника, не более 1000.'),{status:400});
 const entries=new Map();
 for(const row of rows){
  if(!Array.isArray(row)||row.length>4||row.some(x=>typeof x!=='string'||x.length>12000))throw Object.assign(Error('Неверный формат строки дневника.'),{status:400});
  const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(row[0]||'');if(!m)continue;
  const date=`${m[3]}-${m[2]}-${m[1]}`;if(!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)continue;
  const notes=(row[2]||'').split(/(?<=[.!?])\s+/u).filter(s=>exercise.test(s)).map(s=>s.replace(/(?:[,;]?\s*(?:и\s+)?(?:про[шй]?[её]л|прош[её]л|прошла|нашагал|сделал)?\s*\d[\d\s\u00a0]*\s*шаг\S*)/giu,'').trim()).filter(Boolean);
  if(notes.length)entries.set(date,{date,notes:[...new Set([...(entries.get(date)?.notes||[]),...notes])].slice(0,12)});
 }
 return [...entries.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
