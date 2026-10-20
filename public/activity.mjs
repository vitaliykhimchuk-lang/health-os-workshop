const $=id=>document.getElementById(id);
const fmt=(n,d=0)=>n===null||n===undefined?'—':Number(n.toFixed(d)).toLocaleString('ru-RU');
const day=iso=>new Date(iso+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
const metrics=[['steps','Шаги','в день',0],['distanceKm','Расстояние','км',1],['activeKcal','Активные калории','ккал',0],['exerciseMinutes','Нагрузка','мин',0],['standHours','Часы с разминкой','ч',0],['restingHR','Пульс в покое — часы','уд/мин',0],['walkingHR','Пульс при ходьбе','уд/мин',0],['vo2Max','Кардиофитнес — VO₂ max','мл/кг/мин',1],['respiratoryRate','Частота дыхания','в минуту',1],['oxygenPercent','Кислород в крови','%',1],['hrvMs','HRV часов — SDNN','мс',0]];
const mean=(days,key)=>{const v=days.map(d=>d[key]).filter(v=>v!==null&&v!==undefined);return {value:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,count:v.length};};
let charts=[];
export function renderActivity(activity){
 charts.forEach(c=>c.destroy());charts=[];const days=activity?.days||[];
 $('activityEmpty').hidden=!!days.length;$('activityContent').hidden=!days.length;
 if(!days.length){$('activityState').textContent='Apple Watch ещё не подключены. Сон уже поступает из Ultrahuman; шаги кольца здесь не используются.';return;}
 $('activityState').textContent=`Источник: Apple Watch · ${days.at(-1).device} · ${day(days[0].date)} — ${day(days.at(-1).date)}. Данные из последнего импорта, не автоматическая синхронизация.`;
 const end=Date.parse(days.at(-1).date+'T12:00:00Z'),recent=days.filter(d=>Date.parse(d.date+'T12:00:00Z')>=end-6*86400000);
 $('activityTiles').replaceChildren();
 for(const [key,title,unit,digits] of metrics.filter(([key],i)=>i<5||days.some(d=>d[key]!==null)).slice(0,11)){
  const m=mean(recent,key),tile=document.createElement('div');tile.className='tile';const tn=document.createElement('div');tn.className='tn';tn.textContent=title;const v=document.createElement('div');v.className='tv';v.textContent=fmt(m.value,digits);const u=document.createElement('small');u.textContent=m.value===null?'':unit;v.appendChild(u);const cap=document.createElement('div');cap.className='tc';cap.textContent=`среднее по ${m.count} дням из последних 7`;tile.append(tn,v,cap);$('activityTiles').appendChild(tile);
 }
 const prior=days.filter(d=>{const t=Date.parse(d.date+'T12:00:00Z');return t<end-6*86400000&&t>=end-13*86400000;});const a=mean(recent,'steps'),b=mean(prior,'steps');
 $('activitySummary').textContent=a.count>=4&&b.count>=4?`Шаги: в среднем ${fmt(a.value)} в день за последнее окно 7 дней против ${fmt(b.value)} за предыдущее. Изменение: ${a.value>=b.value?'+':''}${fmt(a.value-b.value)} шагов в день.`:'Для сравнения двух недель нужно больше дней с данными. История будет накапливаться при импорте.';
 const keys=['steps','distanceKm','activeKcal','exerciseMinutes'];$('activityCharts').replaceChildren();
 for(const key of keys){if(!days.some(d=>d[key]!==null))continue;const [,title,unit]=metrics.find(m=>m[0]===key);const card=document.createElement('div');card.className='card';const h=document.createElement('div');h.className='sh';h.textContent=`${title}, ${unit}`;const box=document.createElement('div');box.className='chartbox';const cv=document.createElement('canvas');box.appendChild(cv);card.append(h,box);$('activityCharts').appendChild(card);
  const moving=days.map((d,i)=>{const cut=Date.parse(d.date+'T12:00:00Z')-6*86400000;const w=days.filter((x,j)=>j<=i&&Date.parse(x.date+'T12:00:00Z')>=cut&&x[key]!==null);return w.length===7?mean(w,key).value:null;});
  charts.push(new Chart(cv,{type:'bar',data:{labels:days.map(d=>d.date),datasets:[{label:'День',data:days.map(d=>d[key]),backgroundColor:'rgba(37,99,235,.25)',borderRadius:3,order:1},{type:'line',label:'Среднее за 7 дней',data:moving,borderColor:'#2563eb',borderWidth:3,pointRadius:0,spanGaps:false,order:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},scales:{x:{ticks:{maxTicksLimit:6,maxRotation:0,callback(v){return day(this.getLabelForValue(v));}},grid:{display:false}},y:{beginAtZero:true}},plugins:{legend:{display:false}}}}));
 }
 const workouts=days.flatMap(d=>d.workouts.map(w=>({...w,date:d.date}))).sort((a,b)=>b.start.localeCompare(a.start));$('activityWorkouts').replaceChildren();
 const types={HKWorkoutActivityTypeWalking:'Ходьба',HKWorkoutActivityTypeRunning:'Бег',HKWorkoutActivityTypeCycling:'Велосипед',HKWorkoutActivityTypeSwimming:'Плавание',HKWorkoutActivityTypeTraditionalStrengthTraining:'Силовая тренировка',HKWorkoutActivityTypeFunctionalStrengthTraining:'Функциональная тренировка',HKWorkoutActivityTypeYoga:'Йога',HKWorkoutActivityTypeHiking:'Поход'};
 if(!workouts.length)$('activityWorkouts').textContent='Тренировок в импортированных данных нет.';
 for(const w of workouts.slice(0,40)){const row=document.createElement('div');row.className='doc';row.textContent=`${day(w.date)} · ${types[w.type]||w.type.replace('HKWorkoutActivityType','')} · ${fmt(w.minutes,1)} мин`;$('activityWorkouts').appendChild(row);}
}
window.renderActivity=renderActivity;
export function bindActivityImport(api){
 let worker=null,ready=false,busy=false;const status=$('activityImportStatus');status.setAttribute('aria-live','polite');
 const say=text=>{status.textContent=text;};
 const update=()=>{$('appleImport').disabled=!ready||busy||!$('appleSource').value;};
 const save=async days=>{busy=true;update();let total=0;try{for(let i=0;i<days.length;i+=90){say(`Сохраняю ${total} из ${days.length} дней…`);await api('activity/import',{days:days.slice(i,i+90)});total+=Math.min(90,days.length-i);}say(`Сохранено ${total} дней. Открываю вашу активность…`);location.reload();}catch(e){say('Не удалось сохранить все дни: '+e.message+' Можно повторить импорт — шаги не удвоятся.');}finally{busy=false;update();}};
 $('appleFile').onchange=()=>{worker?.terminate();worker=null;ready=false;busy=false;$('appleSource').replaceChildren();update();const file=$('appleFile').files[0];if(!file){say('Сначала выберите ZIP или XML из Apple «Здоровье».');return;}say(`Выбран ${file.name} (${(file.size/1024/1024).toFixed(1)} МБ). Подготавливаю обработку…`);
  try{worker=new Worker(new URL('./activity-worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{if(data.type==='progress')say(data.text);else if(data.type==='ready'){for(const source of data.sources){const o=document.createElement('option');o.value=source;o.textContent=source;$('appleSource').appendChild(o);}ready=true;busy=false;update();say(data.sources.length===1?'Часы найдены и выбраны. Теперь нажмите «Импортировать активность».':'Архив прочитан. Выберите свои часы в списке и нажмите «Импортировать активность».');}else if(data.type==='error'){busy=false;update();say(data.text);}else if(data.type==='days')save(data.days);};
   worker.onerror=()=>{ready=false;busy=false;update();say('Не удалось обработать архив на этом устройстве. Попробуйте распаковать ZIP в «Файлах» и выбрать XML или открыть сайт на Mac.');};worker.postMessage({type:'read',file});
  }catch(e){say('Не удалось начать обработку: '+e.message);}
 };
 $('appleSource').onchange=update;
 $('appleForm').onsubmit=e=>{e.preventDefault();if(!ready||busy)return;busy=true;update();say('Обрабатываю выбранные часы…');worker.postMessage({type:'parse',source:$('appleSource').value});};
 say('Выберите ZIP или XML. Кнопка включится, когда файл будет прочитан и найдены ваши часы.');
}
