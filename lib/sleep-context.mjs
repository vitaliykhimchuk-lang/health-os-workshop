export const CONTEXT_TAGS=['alcohol','illness','lateMeal','stress','lateTraining','travel'];
export function validateSleepContext(body,now=new Date()){
 const date=body?.date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<'2000-01-01'||Date.parse(date+'T00:00:00Z')>now.getTime()+86400000)throw Error('Выберите корректную дату прошедшей ночи.');
 if(!Array.isArray(body.tags)||body.tags.length>6||body.tags.some(t=>!CONTEXT_TAGS.includes(t)))throw Error('Неизвестная отметка вечера.');return {date,tags:[...new Set(body.tags)],reviewed:true};
}
