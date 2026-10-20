const DAY=86400000;
export const number=v=>typeof v==='number'&&Number.isFinite(v);
export const stamp=d=>Date.parse(d+'T12:00:00Z');
export const dateAt=t=>new Date(t).toISOString().slice(0,10);
export const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export const observed=(days,key)=>days.map(d=>d[key]).filter(number);
export function calendar(end,length){return Array.from({length},(_,i)=>dateAt(stamp(end)-(length-1-i)*DAY));}
export function windowDays(days,end,length,offset=0){const t=stamp(end)-offset*DAY;return days.filter(d=>stamp(d.date)<=t&&stamp(d.date)>t-length*DAY);}
export function comparison(days,key,end,length=30){const a=observed(windowDays(days,end,length),key),b=observed(windowDays(days,end,length,length),key);const min=Math.ceil(length/3);return {current:average(a),previous:average(b),count:a.length,previousCount:b.length,delta:a.length>=min&&b.length>=min?average(a)-average(b):null,percent:a.length>=min&&b.length>=min&&average(b)>0?(average(a)/average(b)-1)*100:null};}
export function rolling(days,dates,key){return dates.map(date=>{const a=observed(windowDays(days,date,7),key);return {value:a.length>=3?average(a):null,count:a.length,complete:a.length===7};});}
const quantile=(sorted,p)=>{const i=(sorted.length-1)*p,lo=Math.floor(i);return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo);};
export function baseline(days,key,end){const a=observed(windowDays(days,end,30,1),key).sort((a,b)=>a-b);return {count:a.length,low:a.length>=10?quantile(a,.1):null,high:a.length>=10?quantile(a,.9):null};}
export function monthly(days){const groups=new Map();for(const d of days){const key=d.date.slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(d);}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([month,ds])=>({month,days:ds.length,values:Object.fromEntries(['steps','exerciseMinutes','restingHR','hrvMs','vo2Max'].map(k=>[k,{value:average(observed(ds,k)),count:observed(ds,k).length}])),workouts:ds.flatMap(d=>d.workouts||[]).length}));}
export function weeks(days,end){const out=[];for(let i=7;i>=0;i--){const offset=i*7,ds=windowDays(days,end,7,offset),dates=calendar(dateAt(stamp(end)-offset*DAY),7),v=observed(ds,'exerciseMinutes');out.push({start:dates[0],end:dates.at(-1),minutes:v.length?v.reduce((s,x)=>s+x,0):null,count:v.length,workouts:ds.flatMap(d=>d.workouts||[]).length});}return out;}
