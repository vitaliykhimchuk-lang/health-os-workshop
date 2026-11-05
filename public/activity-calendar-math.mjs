import {number,stamp,dateAt,windowDays,average} from './activity-math.mjs';
export const warsawToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function completedWeek(today){const d=new Date(stamp(today)),offset=(d.getUTCDay()+6)%7+1;return dateAt(stamp(today)-offset*86400000);}
export function weekMetric(days,key,end){const a=windowDays(days,end,7).map(d=>d[key]).filter(number),b=windowDays(days,end,7,7).map(d=>d[key]).filter(number);return {current:average(a),previous:average(b),count:a.length,previousCount:b.length,delta:a.length>=5&&b.length>=5?average(a)-average(b):null};}
export function monthDates(month){const start=month+'-01',d=new Date(stamp(start));if(!Number.isFinite(d.getTime()))return [];const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();return Array.from({length:n},(_,i)=>dateAt(stamp(start)+i*86400000));}
export function exerciseStatus(entry){if(!entry)return 'unknown';const text=entry.notes.join(' ');if(/^(?:спорт[а]?\s+не\s+было|без\s+(?:спорта|тренировки)|не\s+тренировался|день\s+отдыха)[.!\s]*$/iu.test(text))return 'rest';return 'noted';}
