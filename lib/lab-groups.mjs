export function labGroup(marker){
 const n=String(marker.name||'').toLowerCase();
 if(/мочи|моча|urine/.test(n))return 'Анализ мочи';
 if(/hba1c|гликоз|гликозил|инсулин|глюкоз/.test(n))return 'Обмен веществ';
 if(/холестерин|липопротеин|триглицер|не-лпвп|non.hdl/.test(n))return 'Липиды';
 if(/креатинин|egfr|мочевин|\bbun\b/.test(n))return 'Почки';
 if(/натрий|калий|магний/.test(n))return 'Электролиты';
 if(/билирубин|белок общий|общий белок|аланин|аспартат/.test(n))return 'Печень';
 if(/амилаза|липаза/.test(n))return 'Поджелудочная железа';
 if(/витамин|фолиев|ферритин/.test(n))return 'Железо и витамины';
 if(/psa|пса/.test(n))return 'Простата';
 if(/ттг|тиреотроп|т4 свобод/.test(n))return 'Щитовидная железа';
 if(/лейкоц|нейтроф|лимфоц|моноц|эозиноф|базоф|гранулоц|эритроц|гемоглоб|гематок|тромбоц|плотк|\b(?:mcv|mch|mchc|rdw|plt|pct|pdw|mpv)\b|соэ|оседания/.test(n))return 'Кровь';
 return 'Другие показатели';
}
