const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function renderExerciseDiary(root,diary){
 if(!diary)return;
 const block=el('section','activity-block');block.id='exerciseDiary';block.append(el('h2','section','Дневник упражнений'),el('p','activity-muted','Ваши записи из Google-таблицы. Повторения и заметки сохраняются отдельно от тренировок часов; шаги из дневника не импортируются.'));
 if(diary.syncedAt)block.append(el('p','activity-muted',`Проверено ${new Date(diary.syncedAt).toLocaleString('ru-RU')} · ежедневное обновление через Codex на Mac`));
 const entries=diary.entries||[];
 block.append(el('p','',`${entries.length} дней с упоминаниями упражнений. День без записи не означает отсутствие тренировки.`));
 const list=el('div');for(const entry of [...entries].reverse()){const card=el('article','card');card.append(el('h3','',new Date(entry.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})));for(const note of entry.notes)card.append(el('p','',note));list.append(card);}block.append(list);
 if(!entries.length)block.append(el('p','activity-muted','В проверенных строках пока нет записей об упражнениях.'));
 if(diary.sourceUrl){const a=el('a','activity-text-button','Открыть исходный дневник →');a.href=diary.sourceUrl;a.target='_blank';a.rel='noopener';block.append(a);}root.append(block);
}
