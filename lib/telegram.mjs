import {randomBytes} from 'node:crypto';
import {inPatient,rawRead,rawSave,rawWrite,mutate} from './storage.mjs';
import {ensureFamily,patients,getPatient,consumeCode,allowedIds,rateLimit} from './family.mjs';
export async function telegramRequest(method,body={}){
 if(!process.env.TELEGRAM_BOT_TOKEN)throw Error('Telegram не подключён.');
 const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok||!d.ok)throw Error('Telegram API '+r.status);return d.result;
}
const send=async(chat,text,reply_markup)=>{for(let i=0;i<text.length;i+=3900)await telegramRequest('sendMessage',{chat_id:chat,text:text.slice(i,i+3900),...(i===0&&reply_markup?{reply_markup}:{})});};
const keyboard=rows=>({inline_keyboard:rows});
export function privateSender(update){const m=update.message||update.callback_query?.message;const from=update.message?.from||update.callback_query?.from;return m?.chat?.type==='private'&&from&&!from.is_bot&&String(m.chat.id)===String(from.id)?{chat:m.chat.id,user:String(from.id),message:m,callback:update.callback_query}:null;}
export async function handleTelegram(update,services){
 const sender=privateSender(update);if(!sender)return;const {chat,user,message:m,callback}=sender;
 if(!Number.isSafeInteger(update.update_id))return;
 await ensureFamily();let claimed=false;
 await mutate(`family/updates/${update.update_id}.json`,old=>{claimed=false;if(old?.done||old?.until>Date.now())return old;claimed=true;return {until:Date.now()+300000,done:false};});if(!claimed)return;
 try{await processPrivate(sender,services);}catch(e){console.error('Telegram processing',e.name);try{await send(chat,e.status?e.message:'Не удалось обработать запрос. Попробуйте ещё раз. Документы других карт не изменены.');}catch{}}
 await rawSave(`family/updates/${update.update_id}.json`,{done:true,at:new Date().toISOString()});
}
async function processPrivate({chat,user,message:m,callback},services){
 const text=String(m.text||'').trim();const bindingPath=`family/telegram/${user}.json`;
 if(!callback&&text.startsWith('/start ')){
  if(!await rateLimit('tg-link:'+user,10))return send(chat,'Слишком много попыток подключения. Подождите 15 минут.');
  let p;try{p=await consumeCode(text.split(/\s+/)[1],user);}catch{return send(chat,'Ссылка использована или истекла. Войдите в свою карту на сайте и нажмите «Подключить Telegram» ещё раз.');}
  await mutate(bindingPath,old=>({links:[...(old?.links||[]).filter(l=>l.id!==p.id),{id:p.id,version:p.version}],selectedId:p.id}));
  return send(chat,'Подключена карта «'+p.name+'». Теперь можно задавать вопросы и отправлять PDF или фото анализов. Перед сохранением документа я покажу получателя. Чужие карты без подключения недоступны.');
 }
 const all=await patients(),binding=(await rawRead(bindingPath))?.data;const ids=allowedIds(binding,all);const available=all.filter(p=>ids.includes(p.id));
 if(!ids.length)return send(chat,'Здравствуйте! Это семейная медкарта. Откройте https://chimczuk.vercel.app, войдите в СВОЮ карту и нажмите «Подключить Telegram». Пароли и анализы до подключения сюда не присылайте.');
 const current=available.find(p=>p.id===binding.selectedId)||available[0];
 const choose=()=>send(chat,'Доступные вам карты. Сейчас: '+current.name,keyboard(available.map(p=>[{text:p.name,callback_data:'select:'+p.id}])));
 if(callback){
  await telegramRequest('answerCallbackQuery',{callback_query_id:callback.id});const [action,arg,pid]=String(callback.data||'').split(':');
  if(action==='select'){
   const p=available.find(p=>p.id===arg);if(!p)return send(chat,'Нет доступа к этой карте. Подключите её кодом с сайта.');await mutate(bindingPath,old=>({...old,selectedId:p.id}));return send(chat,'Текущая карта: '+p.name+'. Вопросы относятся только к ней.');
  }
  if(['cancel','save'].includes(action)&&!/^([a-f0-9]{16})$/.test(arg||''))return;
  if(action==='cancel'){const pending=await rawRead(`family/inbox/${user}/${arg}.json`);if(pending)await rawSave(`family/inbox/${user}/${arg}.json`,{done:true,expires:0});return send(chat,'Загрузка отменена.');}
  if(action==='save'){
   const p=available.find(p=>p.id===pid);if(!p)return send(chat,'Нет доступа к этой карте.');
   const path=`family/inbox/${user}/${arg}.json`;const pending=await rawRead(path);if(!pending?.data?.document||pending.data.done||pending.data.expires<Date.now())return send(chat,'Документ уже обработан или срок подтверждения истёк.');
   const species=pending.data.document.patientSpecies;if(species&&species!=='unknown'&&species!==p.species)return send(chat,'Вид пациента в документе не соответствует этой карте. Выберите подходящую карту.');
   let acquired=false;await mutate(path,old=>{acquired=false;if(!old||old.done||old.lockUntil>Date.now())return old;acquired=true;return {...old,lockUntil:Date.now()+300000};});if(!acquired)return send(chat,'Документ уже обрабатывается.');
   try{const r=await inPatient(p,()=>services.saveDocument(pending.data.document));await rawSave(path,{done:true,expires:0});return send(chat,r.message);}catch(e){await mutate(path,old=>({...old,lockUntil:0}));throw e;}
  }
  return;
 }
 if(text==='/profiles'||text==='/profile')return choose();
 if(text==='/unlink'){await rawSave(bindingPath,{links:[],selectedId:null});return send(chat,'Все карты отключены от этого Telegram. Для нового подключения используйте ссылку из своей карты.');}
 if(text==='/start'||text==='/help')return send(chat,'Ваша карта: '+current.name+'.\nОтправьте вопрос, PDF или фото документа. Перед сохранением выберите получателя кнопкой.\n/profiles — доступные карты\n/unlink — отключить Telegram\nСайт: https://chimczuk.vercel.app');
 if(!await rateLimit('tg-usage:'+user,60,60))return send(chat,'Достигнут лимит запросов за час. Попробуйте позже.');
 const attachment=m.document||m.photo?.at(-1);
 if(attachment){
  const type=m.document?.mime_type||'image/jpeg';if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(type))return send(chat,'Пришлите PDF, JPEG, PNG или WebP.');
  if(attachment.file_size>12000000)return send(chat,'Этот файл больше 12 МБ. Отправьте меньший PDF или фото.');
  await send(chat,'Получил файл. Пробую прочитать содержимое; затем предложу выбрать карту. Пока он никуда не сохранён…');
  const meta=await telegramRequest('getFile',{file_id:attachment.file_id});if(meta.file_size>12000000||!meta.file_path)return send(chat,'Не удалось получить файл допустимого размера.');
  const response=await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${meta.file_path}`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Telegram download');
  const reader=response.body.getReader(),chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000000){await reader.cancel();return send(chat,'Файл слишком большой.');}chunks.push(value);}
  const document=await inPatient(current,()=>services.parseDocument({name:m.document?.file_name||'Фото из Telegram.jpg',type,data:Buffer.concat(chunks).toString('base64')},12000000));
  const id=randomBytes(8).toString('hex');await rawWrite(`family/inbox/${user}/${id}.json`,{document,expires:Date.now()+86400000,done:false});
  const normalize=s=>s.toLowerCase().replace(/[^\p{L}]/gu,'');const detected=available.find(p=>[p.name,...(p.aliases||[])].some(a=>normalize(a)===normalize(document.patientName||'')));
  const ordered=[...available].sort((a,b)=>Number(b.id===detected?.id)-Number(a.id===detected?.id));
  return send(chat,(document.parseNotice?document.parseNotice+'\n\n':'')+(document.patientName?'В документе: '+document.patientName+'.':'Имя пациента не удалось прочитать.')+'\nКому сохранить? Доступны только подключённые вами карты. Если нужной нет, отмените загрузку и подключите её через сайт.',keyboard([...ordered.map(p=>[{text:'Сохранить: '+p.name,callback_data:`save:${id}:${p.id}`}]),[{text:'Отмена',callback_data:'cancel:'+id}]]));
 }
 if(!text)return send(chat,'Отправьте текст вопроса, PDF или фото документа.');
 if(text.length>3000)return send(chat,'Сократите вопрос до 3000 символов.');
 const historyPath=`family/conversations/${user}/${current.id}.json`;const history=(await rawRead(historyPath))?.data?.messages||[];
 await telegramRequest('sendChatAction',{chat_id:chat,action:'typing'});
 const answer=await inPatient(current,()=>services.askPatient(text,history.slice(-6)));
 await send(chat,'Карта: '+current.name+'\n\n'+answer);
 await rawSave(historyPath,{messages:[...history,{role:'user',text},{role:'assistant',text:answer}].slice(-6)});
}
