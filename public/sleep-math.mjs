// Calendar windows, missing observations and device estimates remain explicit.
export const DAY=86400000;
export const dayNumber=date=>Date.parse(date+'T12:00:00Z')/DAY;
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const valid=v=>typeof v==='number'&&Number.isFinite(v);
export const values=(days,key)=>days.map(d=>d[key]).filter(valid);
export function calendar(end,count){return Array.from({length:count},(_,i)=>new Date((dayNumber(end)-count+1+i)*DAY).toISOString().slice(0,10));}
export function windowDays(days,end,count,offset=0){const n=dayNumber(end)-offset;return days.filter(d=>dayNumber(d.date)<=n&&dayNumber(d.date)>n-count);}
export function clockMinutes(timestamp,zone='UTC'){if(!valid(timestamp))return null;try{const ms=timestamp<1e12?timestamp*1000:timestamp;const date=new Date(ms);if(date.getUTCFullYear()<2000||date.getUTCFullYear()>2100)return null;const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);return Number(p.find(x=>x.type==='hour').value)*60+Number(p.find(x=>x.type==='minute').value);}catch{return null;}}
export const overnightMinute=m=>m===null?null:m<720?m+1440:m;
export function regularity(days,key){const x=days.map(d=>overnightMinute(clockMinutes(d[key],d.timeZone))).filter(valid);return {count:x.length,mean:mean(x),spread:x.length>=3?Math.sqrt(mean(x.map(v=>(v-mean(x))**2))):null};}
export function rolling(days,dates,key){return dates.map(date=>{const x=values(windowDays(days,date,7),key);return {count:x.length,value:x.length>=3?mean(x):null,complete:x.length===7};});}
export function buildSleepReport(raw){
 const days=raw.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));const nights=days.filter(d=>valid(d.sleepHours));if(!nights.length)return null;
 const last=nights.at(-1),week=windowDays(nights,last.date,7),previous=windowDays(nights,last.date,7,7),beforeLast=windowDays(nights,last.date,7,1);const comparisons={};
 for(const key of ['sleepHours','sleepScore','hrvMs','restingHR','sleepEfficiency']){const a=values(week,key),b=values(previous,key),c=values(beforeLast,key);comparisons[key]={mean:mean(a),previousMean:mean(b),count:a.length,previousCount:b.length,delta:a.length>=4&&b.length>=4?mean(a)-mean(b):null,lastDelta:valid(last[key])&&c.length>=3?last[key]-mean(c):null,previousNights:c.length};}
 return {days,nights,last,week,previous,comparisons,bedtime:regularity(week,'bedtimeStart'),wake:regularity(week,'bedtimeEnd'),sevenHours:week.filter(d=>d.sleepHours>=7).length,shortfallHours:week.reduce((sum,d)=>sum+Math.max(0,7-d.sleepHours),0),range:{min:Math.min(...week.map(d=>d.sleepHours)),max:Math.max(...week.map(d=>d.sleepHours))}};
}
