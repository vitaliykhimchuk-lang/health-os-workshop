
window.renderWorkshop = function(D) {
const $ = id => document.getElementById(id);
const FLAG_RU = { high: "выше нормы", low: "ниже нормы", ok: "в норме" };
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

/* ---------- общие помощники ---------- */
const fmtDate = iso => { if (!iso) return "не указано"; const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };   // "2025-01-15" -> "15 января 2025"
const fmtShort = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)}`; };
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
const list = items => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>` : `<span class="empty">нет</span>`;
const lastOf = b => b.series[b.series.length - 1];
const bmByKey = k => D.biomarkers.find(b => b.key === k);
function ageYears(birthIso, now) {
  const b = new Date(birthIso + "T00:00:00");
  const a = now.getFullYear() - b.getFullYear();
  return now.getMonth() > b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate()) ? a : a - 1;
}

/* ---------- часы: среднее за 7 дней против нормы (нужно и обзору, и сну) ---------- */
const G = D.garmin && D.garmin.days && D.garmin.days.length >= 7 ? D.garmin : null;
const last7 = G ? G.days.slice(-7) : [];
const avg = k => last7.reduce((s, r) => s + r[k], 0) / last7.length;
const num = (v, dig) => dig ? v.toFixed(dig).replace(".", ",") : Math.round(v).toLocaleString("ru-RU");
// норма — коридор p25..p75 из личной истории; good: 1 — чем больше, тем лучше, -1 — чем меньше, тем лучше
function vsNorm(k, dig, good) {
  const a = avg(k), n = G.norms[k], r = v => Number(v.toFixed(dig));
  const pos = r(a) < r(n.p25) ? -1 : r(a) > r(n.p75) ? 1 : 0;
  const bad = pos !== 0 && pos !== good;
  return { a, text: pos === 0 ? "в вашей норме" : bad ? (pos < 0 ? "ниже нормы" : "выше нормы") : "лучше нормы",
           cls: bad ? "amber" : "green", range: `${num(n.p25, dig)}–${num(n.p75, dig)}` };
}

/* ---------- обзор ---------- */
const p = D.profile, today = new Date();
const age = p.birth ? ageYears(p.birth, today) : null;
$("name").textContent = p.name;
$("avatar").textContent = p.name.split(/\s+/).slice(0, 2).map(w => w[0]).join("");
const nAn = D.biomarkers.reduce((s, b) => s + b.series.length, 0);
$("meta").textContent = `${age === null ? "Возраст не указан" : age + " " + plural(age, "год", "года", "лет")} · ${D.biomarkers.length} показателей, ${nAn} замеров · ${D.visits.length} ${plural(D.visits.length, "визит", "визита", "визитов")} · обновлено ${fmtDate(D.generated)}`;

(function renderTiles() {
  const tiles = [];
  const bm = (key, label) => {
    const b = D.biomarkers.find(b => b.key === key || b.key.startsWith(key + "|")); if (!b) return;
    const l = lastOf(b);
    tiles.push({ label, val: l.value, unit: b.unit, cls: l.flag === "ok" ? "green" : "red",
      cap: `${FLAG_RU[l.flag]} · норма ${b.ref} · ${fmtDate(l.date)}`, href: "#analyses", key: b.key });
  };
  bm("ldl", "LDL"); bm("vitd", "Витамин D");
  if (G) {
    const hrs = vsNorm("sleepHours", 1, 1), hr = vsNorm("restingHR", 0, -1);
    tiles.push({ label: "Сон, 7 дней", val: num(hrs.a, 1), unit: "ч", cls: hrs.cls, cap: hrs.text, href: "#sleep" });
    tiles.push({ label: "Пульс в покое", val: num(hr.a, 0), unit: "уд/мин", cls: hr.cls, cap: hr.text, href: "#sleep" });
  }
  $("tiles").innerHTML = tiles.map(t => `<a class="tile ${t.cls}" href="${t.href}"${t.key ? ` data-key="${t.key}"` : ""}>
    <div class="tn">${t.label}</div><div class="tv">${t.val}<small>${t.unit}</small></div><div class="tc">${t.cap}</div></a>`).join("");
})();

// статусы: если строка про показатели — карточка раскрывается графиками
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentioned = text => D.biomarkers.filter(b => [b.name, b.fullName].some(n =>
  new RegExp(`(?<![\\p{L}\\p{N}])${esc(n)}(?![\\p{L}\\p{N}])`, "iu").test(text)));
function tldrMarkers(t) {
  if (t.markers && t.markers.length) return t.markers.map(bmByKey).filter(Boolean);
  return mentioned(t.text);
}
const chipsOf = b => b.series.slice(-3).map(s => {
  const [y, m, d] = s.date.split("-").map(Number);
  return `<span class="chip ${s.flag}" title="${fmtDate(s.date)}">${d} ${MONTHS[m - 1].slice(0, 3)} ${y} · <b>${s.value}</b> ${b.unit}</span>`;
}).join("");
const miniBlock = b => `<div class="mini" data-key="${b.key}">
  <div class="mini-h"><b>${b.name}</b>${b.fullName !== b.name ? ` · ${b.fullName}` : ""} · норма ${b.ref}</div>
  <div class="chartbox"><canvas></canvas></div>
  <div class="chips">${chipsOf(b)}</div>
  <a class="golink" href="#analyses" data-key="${b.key}">Открыть в анализах: ${b.name} →</a>
</div>`;
$("tldr").innerHTML = D.tldr.map((t, i) => {
  const ms = tldrMarkers(t);
  const ic = t.level === "ok" ? "✅" : t.level === "warn" ? "⚠️" : "ℹ️";
  if (!ms.length) return `<div class="row ${t.level}"><div class="rhead"><span>${ic}</span><span class="rtext">${t.text}</span></div></div>`;
  return `<div class="row exp ${t.level}" data-i="${i}" role="button" tabindex="0" aria-expanded="false" aria-controls="tb-${i}">
    <div class="rhead"><span>${ic}</span><span class="rtext">${t.text}</span><span class="chev" aria-hidden="true">▾</span></div>
    <div class="rbody" id="tb-${i}"><div class="rin"><div class="rpad">${ms.map(miniBlock).join("")}</div></div></div>
  </div>`;
}).join("");

function toggleRow(row) {
  const open = !row.classList.contains("open");
  row.classList.toggle("open", open);
  row.setAttribute("aria-expanded", open);
  row.querySelector(".chev").textContent = open ? "▴" : "▾";
  if (open && !row.dataset.drawn) {        // графики рисуем при первом раскрытии, когда у блока уже есть размер
    row.dataset.drawn = "1";
    requestAnimationFrame(() => row.querySelectorAll(".mini").forEach(m => drawChart(m.querySelector("canvas"), bmByKey(m.dataset.key))));
  }
}
function bindRows(box) {
  box.addEventListener("click", e => {
    const link = e.target.closest(".golink");
    if (link) {
      e.preventDefault();
      if (link.dataset.visit != null) goTo("visits", "visit-" + link.dataset.visit); else openInAnalyses(link.dataset.key);
      return;
    }
    const row = e.target.closest(".row.exp");
    if (row && e.target.closest(".rhead")) toggleRow(row);   // клики по графикам не сворачивают карточку
  });
  box.addEventListener("keydown", e => {
    const row = e.target.closest(".row.exp");
    if (row && e.target === row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleRow(row); }
  });
}
bindRows($("tldr"));
$("tiles").addEventListener("click", e => {
  const tile = e.target.closest(".tile[data-key]");
  if (tile) { e.preventDefault(); openInAnalyses(tile.dataset.key); }
});

// переход в раздел к нужной карточке (показатель в «Анализах», визит в «Визитах») с короткой подсветкой
let pendingFocus = null;
function focusCard(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1500);
}
function goTo(mod, elId) {
  pendingFocus = { mod, elId };
  if (location.hash === "#" + mod) { route(); } else { location.hash = "#" + mod; }
}
const openInAnalyses = key => goTo("analyses", "bm-" + key);

/* ---------- анализы ---------- */
const FLAG_COLOR = { ok: "#16a34a", high: "#dc2626", low: "#ea8a0c" };
// дробный год по дате: 2024-07-01 -> ~2024.5
const yearPos = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d), t0 = Date.UTC(y, 0, 1), t1 = Date.UTC(y + 1, 0, 1);
  return y + (t - t0) / (t1 - t0);
};
// границы оси Y: по значениям; норма попадает на ось, только если лежит рядом
function yRange(b) {
  const vals = b.series.map(s => s.value);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const near = Math.max(vMax - vMin, Math.abs(vMax) * 0.1);
  let lo = vMin, hi = vMax;
  for (const bound of [b.low, b.high]) {
    if (bound == null) continue;
    if (bound >= vMin - near && bound <= vMax + near) { lo = Math.min(lo, bound); hi = Math.max(hi, bound); }
  }
  let span = hi - lo;
  const minSpan = Math.abs(hi) * 0.2;               // минимальный размах — 20% от верхнего значения
  if (span < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; span = minSpan; }
  if (span <= 0) { lo -= 1; hi += 1; span = 2; }     // защита: все значения 0
  return { min: lo - span * 0.15, max: hi + span * 0.15 };
}
// светло-зелёная полоса нормы под линией
const normBand = {
  id: "normBand",
  beforeDatasetsDraw(chart, args, opts) {
    if (!opts || (opts.low == null && opts.high == null)) return;
    const { ctx, chartArea: ca, scales: { y } } = chart;
    const yTop = opts.high == null ? ca.top : y.getPixelForValue(opts.high);
    const yBot = opts.low == null ? ca.bottom : y.getPixelForValue(opts.low);
    const t = Math.max(ca.top, Math.min(yTop, yBot)), bt = Math.min(ca.bottom, Math.max(yTop, yBot));
    if (bt <= t) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(ca.left, ca.top, ca.right - ca.left, ca.bottom - ca.top); ctx.clip();
    ctx.fillStyle = "rgba(22, 163, 74, 0.13)";
    ctx.fillRect(ca.left, t, ca.right - ca.left, bt - t);
    ctx.restore();
  }
};
function drawChart(canvas, b) {
  const pts = b.series.map(s => ({ x: yearPos(s.date), y: s.value, date: s.date, lab: s.lab, flag: s.flag }));
  const xs = pts.map(p => p.x);
  const xMin = Math.floor(Math.min(...xs)), xMax = Math.max(Math.ceil(Math.max(...xs)), xMin + 1);
  const yr = yRange(b);
  new Chart(canvas, {
    type: "line",
    data: { datasets: [{
      data: pts, parsing: false, clip: false, borderColor: "#2563eb", borderWidth: 2, tension: 0.2, fill: false,
      pointRadius: 6, pointHoverRadius: 8, pointBorderWidth: 2, pointBorderColor: "#fff",
      pointBackgroundColor: pts.map(p => FLAG_COLOR[p.flag] || FLAG_COLOR.ok),
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      layout: { padding: { left: 2, right: 10, top: 8, bottom: 0 } },
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: { type: "linear", min: xMin, max: xMax, ticks: { stepSize: 1, callback: v => Number.isInteger(v) ? v : "", maxRotation: 0 }, grid: { display: false } },
        y: { suggestedMin: yr.min, suggestedMax: yr.max, ticks: { maxTicksLimit: 6 } },
      },
      plugins: {
        legend: { display: false },
        normBand: { low: b.low, high: b.high },
        tooltip: { callbacks: {
          title: items => fmtDate(items[0].raw.date),
          label: item => `${item.raw.y} ${b.unit}`,
          afterLabel: item => item.raw.lab || "",
        } },
      },
    },
    plugins: [normBand],
  });
}
function labCard(b, i) {
  const l = lastOf(b), n = b.series.length;
  return `<div class="bcard st-${l.flag}" id="bm-${b.key}">
    <div class="bhead">
      <div class="bl"><div class="bname">${b.name}</div>${b.fullName !== b.name ? `<div class="bfull">${b.fullName}</div>` : ""}</div>
      <div class="br"><div class="bval">${l.value}<small>${b.unit}</small></div><div class="blab">${FLAG_RU[l.flag]}</div></div>
    </div>
    <div class="binfo">Норма: ${b.ref}<br>Последний: ${fmtDate(l.date)} · ${n} ${plural(n, "замер", "замера", "замеров")}</div>
    <div class="chartbox"><canvas data-i="${i}"></canvas></div>
  </div>`;
}
function renderLabs() {
  const groups = [...new Set(D.biomarkers.map(b => b.group))];
  $("labs").innerHTML = groups.map(g => `<h3 class="gname">${g}</h3>
    <div class="lgrid">${D.biomarkers.map((b, i) => b.group === g ? labCard(b, i) : "").join("")}</div>`).join("");
  document.querySelectorAll("#labs canvas").forEach(c => drawChart(c, D.biomarkers[+c.dataset.i]));
}

/* ---------- сон и пульс ---------- */
const BLUE = "#2563eb";
// полоса личной нормы: зелёная заливка, пунктирные края, справа на полях подпись «ваша норма»
const sNorm = {
  id: "sNorm",
  beforeDatasetsDraw(chart, args, o) {
    if (!o) return;
    const { ctx, chartArea: ca, scales: { y } } = chart;
    const t = Math.max(ca.top, y.getPixelForValue(o.high)), bt = Math.min(ca.bottom, y.getPixelForValue(o.low));
    if (bt <= t) return;
    ctx.save();
    ctx.fillStyle = "rgba(22,163,74,.20)"; ctx.fillRect(ca.left, t, ca.right - ca.left, bt - t);
    ctx.strokeStyle = "rgba(22,163,74,.85)"; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(ca.left, t); ctx.lineTo(ca.right, t); ctx.moveTo(ca.left, bt); ctx.lineTo(ca.right, bt); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#15803d"; ctx.font = "600 11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const my = Math.min(Math.max((t + bt) / 2, ca.top + 14), ca.bottom - 14);
    ctx.fillText("ваша", ca.right + 6, my - 7); ctx.fillText("норма", ca.right + 6, my + 7);
    ctx.restore();
  }
};
// серая вертикальная полоса «простуда» (индексы дней [с, по] включительно)
const sCold = {
  id: "sCold",
  beforeDatasetsDraw(chart, args, o) {
    if (!o || !o.length) return;
    const { ctx, chartArea: ca, scales: { x } } = chart;
    const half = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
    ctx.save();
    for (const [s, e] of o) {
      const l = Math.max(ca.left, x.getPixelForValue(s) - half), r = Math.min(ca.right, x.getPixelForValue(e) + half);
      ctx.fillStyle = "rgba(107,114,128,.20)"; ctx.fillRect(l, ca.top, r - l, ca.bottom - ca.top);
      ctx.fillStyle = "#6b7280"; ctx.font = "600 11px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("пульс выше нормы", Math.min(Math.max((l + r) / 2, ca.left + 26), ca.right - 26), ca.top - 3);
    }
    ctx.restore();
  }
};
const roll7 = vals => vals.map((_, i) => i < 6 ? null : vals.slice(i - 6, i + 1).reduce((a, v) => a + v, 0) / 7);
// эпизоды: среднее за 7 дней пульса >= p75 + 2 (по округлённым числам) 4+ дня подряд; границы уточняем по дневным значениям
function findCold(hr, mean, p75) {
  const thr = Math.round(p75) + 2, out = [];
  let i = 0;
  while (i < hr.length) {
    if (mean[i] == null || Math.round(mean[i]) < thr) { i++; continue; }
    let j = i; while (j + 1 < hr.length && mean[j + 1] != null && Math.round(mean[j + 1]) >= thr) j++;
    if (j - i + 1 >= 4) {
      let s = i; while (s > 0 && hr[s - 1] >= thr && (!out.length || s - 1 > out[out.length - 1][1])) s--;
      let e = j; while (e > s && hr[e] < thr) e--;
      out.push([s, e]);
    }
    i = j + 1;
  }
  return out;
}
const rangeText = (a, b) => {
  const [, m1, d1] = a.split("-").map(Number), [, m2, d2] = b.split("-").map(Number);
  return m1 === m2 ? (d1 === d2 ? `${d1} ${MONTHS[m1 - 1]}` : `${d1}–${d2} ${MONTHS[m1 - 1]}`) : `${fmtShort(a)} – ${fmtShort(b)}`;
};
const fmtNum = (v, dig) => dig ? v.toFixed(dig).replace(".", ",") : Math.round(v).toLocaleString("ru-RU");
// границы оси Y: по значениям с запасом ~10%; балл и заряд не выше 100, всё не ниже 0
function axisY(vals, cap100) {
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.1 || 1;
  const y = { min: Math.max(0, lo - pad), max: cap100 ? Math.min(100, hi + pad) : hi + pad };
  return y;
}
const sBase = {
  responsive: true, maintainAspectRatio: false, animation: false,
  layout: { padding: { top: 14, right: 40, left: 2 } },
};
function sleepCard(title, hint) {
  return `<div class="card"><div class="sh">${title}</div><div class="shint">${hint}</div><div class="chartbox"><canvas></canvas></div></div>`;
}
function renderSleep() {
  if (D.ring && D.ring.days.length) { window.renderRingSleep(D.ring); return; }
  if (!G) { $("sleepTiles").innerHTML = '<span class="empty">Ваших данных часов пока нет. Загрузите их ниже — появятся графики сна, пульса и HRV.</span>'; return; }
  const days = G.days, N = days.length;
  // плитки: [ключ, подпись, единицы, знаков после запятой, что лучше: 1 — больше, -1 — меньше]
  const T = [["sleepHours", "Сон", "ч", 1, 1], ["sleepScore", "Балл сна", "из 100", 0, 1], ["restingHR", "Пульс в покое", "уд/мин", 0, -1],
             ["hrvMs", "HRV", "мс", 0, 1], ["bodyBatteryMorning", "Заряд утром", "из 100", 0, 1], ["steps", "Шаги", "в день", 0, 1]];
  $("sleepTiles").innerHTML = T.map(([k, label, unit, dig, good]) => {
    const v = vsNorm(k, dig, good);
    return `<div class="tile ${v.cls}"><div class="tn">${label}</div><div class="tv">${num(v.a, dig)}<small>${unit}</small></div>
      <div class="tc">${v.text}<br>норма ${v.range}</div></div>`;
  }).join("");

  const hr = days.map(r => r.restingHR), cold = findCold(hr, roll7(hr), G.norms.restingHR.p75);
  const coldText = cold.map(([s, e]) => rangeText(days[s].date, days[e].date)).join(", ");

  // по дням: бледные точки + жирная линия среднего за 7 дней + норма + простуда
  const D1 = [
    ["sleepHours", "Сон", "ч", 1, false, "Часов сна за ночь."],
    ["sleepScore", "Балл сна", "", 0, true, "Оценка сна по версии часов, от 0 до 100."],
    ["restingHR", "Пульс в покое", "уд/мин", 0, false, "Пульс в покое: ниже — лучше; устойчивый рост часто значит болезнь или усталость."],
    ["hrvMs", "HRV", "мс", 0, false, "HRV — вариабельность пульса: чем выше, тем лучше восстановление."],
    ["bodyBatteryMorning", "Заряд утром", "", 0, true, "Body Battery — запас сил утром по оценке часов, от 0 до 100."],
  ];
  $("sleepDaily").innerHTML = D1.map(([, title, unit, , , hint]) => sleepCard(title + (unit ? `, ${unit}` : ""), hint)).join("");
  const labels = days.map(r => r.date);
  document.querySelectorAll("#sleepDaily canvas").forEach((cv, n) => {
    const [k, title, unit, dig, cap] = D1[n], vals = days.map(r => r[k]), mean = roll7(vals), nm = G.norms[k];
    new Chart(cv, {
      type: "line",
      data: { labels, datasets: [
        { label: "День", data: vals, showLine: false, pointRadius: 2.4, pointHoverRadius: 4, pointBackgroundColor: "rgba(37,99,235,.22)", pointBorderWidth: 0, order: 1 },
        { label: "Среднее за 7 дней", data: mean, borderColor: BLUE, borderWidth: 4, pointRadius: 0, pointHoverRadius: 0, tension: 0.35, spanGaps: false, order: 0 },
      ] },
      options: { ...sBase, interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, callback(v) { return fmtShort(this.getLabelForValue(v)); } } },
          y: { ...axisY(vals, cap), ticks: { maxTicksLimit: 6, callback: v => fmtNum(v, dig) } },
        },
        plugins: { legend: { display: false }, sNorm: { low: nm.p25, high: nm.p75 }, sCold: cold,
          tooltip: { filter: it => it.raw != null, callbacks: {
            title: it => fmtDate(it[0].label),
            label: it => `${it.dataset.label}: ${fmtNum(it.raw, dig)}${unit ? " " + unit : ""}`,
          } } },
      },
      plugins: [sNorm, sCold],
    });
  });

  // по неделям: от последнего дня назад, последняя неделя = последние 7 дней
  const W = Math.floor(N / 7), wk = [];
  for (let w = 0; w < W; w++) wk.push(days.slice(N - 7 * (W - w), N - 7 * (W - w - 1)));
  const wl = wk.map(a => fmtShort(a[0].date)), wt = wk.map(a => rangeText(a[0].date, a[6].date));
  const wavg = k => wk.map(a => a.reduce((s, r) => s + r[k], 0) / 7);
  const wsum = k => wk.map(a => a.reduce((s, r) => s + r[k], 0));
  $("sleepWeekly").innerHTML = [
    sleepCard("Глубокий и быстрый сон", "Среднее минут за ночь по неделям (быстрый сон — REM)."),
    sleepCard("Шаги", "Среднее в день по неделям; зелёная полоса — ваша обычная норма."),
    sleepCard("Тренировки", "Сумма минут за неделю."),
  ].join("");
  const wc = document.querySelectorAll("#sleepWeekly canvas");
  const wBase = { ...sBase, interaction: { mode: "index", intersect: false },
    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: { ticks: { maxTicksLimit: 6, callback: v => fmtNum(v, 0) } } } };
  const wTip = (unit) => ({ callbacks: { title: it => wt[it[0].dataIndex], label: it => `${it.dataset.label}: ${fmtNum(it.raw, 0)} ${unit}` } });
  const deep = wavg("deepSleepMin"), rem = wavg("remSleepMin");
  new Chart(wc[0], { type: "line",
    data: { labels: wl, datasets: [
      { label: "Глубокий сон", data: deep, borderColor: "#4f46e5", backgroundColor: "#4f46e5", borderWidth: 3, pointRadius: 3.5, tension: 0.25 },
      { label: "Быстрый сон (REM)", data: rem, borderColor: "#0ea5e9", backgroundColor: "#0ea5e9", borderWidth: 3, pointRadius: 3.5, tension: 0.25 },
    ] },
    options: { ...wBase, scales: { ...wBase.scales, y: { ...axisY([...deep, ...rem], false), ticks: wBase.scales.y.ticks } },
      plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12, boxHeight: 3, usePointStyle: false } }, tooltip: wTip("мин") } } });
  new Chart(wc[1], { type: "bar",
    data: { labels: wl, datasets: [{ label: "Шаги в день", data: wavg("steps"), backgroundColor: "rgba(37,99,235,.85)", borderRadius: 3 }] },
    options: { ...wBase, scales: { ...wBase.scales, y: { beginAtZero: true, ticks: wBase.scales.y.ticks } },
      plugins: { legend: { display: false }, sNorm: { low: G.norms.steps.p25, high: G.norms.steps.p75 }, tooltip: wTip("") } },
    plugins: [sNorm] });
  new Chart(wc[2], { type: "bar",
    data: { labels: wl, datasets: [{ label: "Тренировки за неделю", data: wsum("trainingMinutes"), backgroundColor: "rgba(37,99,235,.85)", borderRadius: 3 }] },
    options: { ...wBase, scales: { ...wBase.scales, y: { beginAtZero: true, ticks: wBase.scales.y.ticks } },
      plugins: { legend: { display: false }, tooltip: wTip("мин") } } });

  $("sleepLegend").innerHTML = `<span><i class="l-dot"></i>точки — отдельные дни</span><span><i class="l-line"></i>жирная линия — среднее за 7 дней</span>
    <span><i class="l-norm"></i>зелёная полоса — ваша обычная норма</span>` +
    (cold.length ? `<span><i class="l-cold"></i>серая полоса — эпизод повышенного пульса (${coldText})</span>` : "");
}

/* ---------- визиты ---------- */
$("visits").innerHTML = D.visits.length ? D.visits.map((v, i) => ({ v, i })).sort((a, b) => b.v.date.localeCompare(a.v.date)).map(({ v, i }) => `
  <div class="card visit" id="visit-${i}">
    <div class="vh">${v.diagnosis}</div>
    <div class="vs">${fmtDate(v.date)} · ${v.doctor} · ${v.clinic}</div>
    <p>${v.findings}</p>
    <b class="rh">Рекомендации</b>${list(v.recs)}
  </div>`).join("") : `<div class="empty">Визитов пока нет.</div>`;

/* ---------- напоминания ---------- */
const DAY_MS = 864e5;
const dayNum = iso => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };
const todayNum = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS;   // сегодняшняя дата — из браузера
function remStatus(r) {
  const n = Math.round(dayNum(r.due) - todayNum);
  const days = k => `${k} ${plural(k, "день", "дня", "дней")}`;
  if (n < 0) return { cls: "over", n, text: `просрочено на ${days(-n)}` };
  const text = n === 0 ? "срок — сегодня" : `через ${days(n)}`;
  return { cls: n <= 30 ? "soon" : "later", n, text };
}
// какой визит рекомендовал: слова из названия напоминания и имён показателей ищем в рекомендациях (по основе слова)
const wordsOf = s => (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
const stemOf = w => w.length > 6 ? w.slice(0, w.length - 2) : w;
function remVisit(r, ms) {
  const stems = [...new Set([r.what, ...ms.flatMap(b => [b.name, b.fullName])].flatMap(wordsOf).map(stemOf))];
  let best = null;
  D.visits.forEach((v, i) => {
    const score = Math.max(0, ...v.recs.map(rec => { const ws = wordsOf(rec); return stems.filter(st => ws.some(w => w.startsWith(st))).length; }));
    if (score && (!best || score > best.score || (score === best.score && v.date > best.v.date))) best = { v, i, score };
  });
  return best;
}
const remMini = b => { const l = lastOf(b); return `<div class="mini" data-key="${b.key}">
  <div class="mini-h"><b>${b.name}</b>${b.fullName !== b.name ? ` · ${b.fullName}` : ""} · норма ${b.ref}</div>
  <div class="chartbox"><canvas></canvas></div>
  <div class="last">последняя сдача: ${fmtDate(l.date)}, <b>${l.value}</b> ${b.unit}</div>
</div>`; };
function remCard(r, scope) {
  const st = remStatus(r), ms = (r.markers || []).map(bmByKey).filter(Boolean), v = remVisit(r, ms);
  const head = `<span class="rtext"><span class="rwhat">${r.what}</span><span class="rwhy">${r.why}</span></span>
    <span class="rdue">срок: ${fmtDate(r.due)}<b class="rst">${st.text}</b></span>`;
  if (!ms.length && !v) return `<div class="row rem ${st.cls}"><div class="rhead">${head}</div></div>`;
  const id = `rb-${scope}-${r.id}`;
  return `<div class="row exp rem ${st.cls}" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}">
    <div class="rhead">${head}<span class="chev" aria-hidden="true">▾</span></div>
    <div class="rbody" id="${id}"><div class="rin"><div class="rpad">${ms.map(remMini).join("")}${v
      ? `<a class="golink recl" href="#visits" data-visit="${v.i}">рекомендовал: ${v.v.doctor}, ${fmtDate(v.v.date)} →</a>` : ""}</div></div></div>
  </div>`;
}
const planned = D.reminders.filter(r => r.status === "planned").sort((a, b) => a.due.localeCompare(b.due));
const done = D.reminders.filter(r => r.status === "done").sort((a, b) => b.due.localeCompare(a.due));
$("remsList").innerHTML = planned.length ? planned.map(r => remCard(r, "all")).join("") : `<div class="empty">Запланированных напоминаний нет.</div>`;
$("remsDone").innerHTML = done.length ? `<details class="rdone"><summary>Выполнено (${done.length})</summary>${done.map(r => `
  <div class="drow"><span><b>${r.what}</b><small>${r.why}</small></span><span class="dd">срок был: ${fmtDate(r.due)}</span></div>`).join("")}</details>` : "";
if (planned.length) {
  $("remsNear").innerHTML = planned.slice(0, 2).map(r => remCard(r, "near")).join("");
  $("remsOverview").hidden = false;
}
bindRows($("remsList")); bindRows($("remsNear"));
// счётчик в меню: запланированные, что просрочены или наступают в ближайшие 30 дней
const remDue = planned.filter(r => remStatus(r).n <= 30);
const remBadge = remDue.length ? { n: remDue.length, cls: remDue.some(r => remStatus(r).n < 0) ? "red" : "amber" } : null;

/* ---------- профиль ---------- */
$("profile").innerHTML = `
  <div class="pgrid">
    <div><div class="lbl">Имя</div><div class="pv">${p.name}</div></div>
    <div><div class="lbl">Дата рождения</div><div class="pv">${fmtDate(p.birth)}</div></div>
    <div><div class="lbl">Возраст</div><div class="pv">${age === null ? "не указан" : age + " " + plural(age, "год", "года", "лет")}</div></div>
    <div><div class="lbl">Пол</div><div class="pv">${p.sex}</div></div>
  </div>
  <div class="psections">
    <div class="psec"><div class="lbl">Диагнозы</div>${list(p.diagnoses)}</div>
    <div class="psec"><div class="lbl">Препараты</div>${list(p.meds)}</div>
    <div class="psec"><div class="lbl">Заметки</div>${list(p.notes)}</div>
  </div>`;

/* ---------- навигация по хэшу (#overview, #analyses, ...) ---------- */
// init — функция, которая рисует вкладку при первом открытии
const NAV = [
  { id: "overview", ic: "🏠", t: "Обзор" },
  { id: "analyses", ic: "🩸", t: "Анализы", b: D.biomarkers.length, init: renderLabs },
  { id: "activity", ic: "🏃", t: "Активность", init: () => window.renderActivity(D.activity || null) },
  { id: "sleep", ic: "⌚", t: "Сон и пульс", init: renderSleep },
  { id: "visits", ic: "🩺", t: "Визиты к врачам", b: D.visits.length || null },
  { id: "reminders", ic: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle;color:#16836b"><path fill="currentColor" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>`, t: "Напоминания", b: remBadge && remBadge.n, bc: remBadge && remBadge.cls },
  { id: "documents", ic: "📁", t: "Документы" },
  { id: "chat", ic: "💬", t: "Чат по медкарте" },
  { id: "profile", ic: "👤", t: "Профиль" },
].filter(n => !n.hide);
$("nav").innerHTML = `<div class="navgrp"><div class="gt">Карта здоровья</div>` + NAV.map(n =>
  `<a class="navitem" href="#${n.id}" data-id="${n.id}"><span class="ni-ic">${n.ic}</span><span class="ni-tx">${n.t}</span>` +
  (n.b ? `<span class="ni-b${n.bc ? " " + n.bc : ""}">${n.b}</span>` : "") + `</a>`).join("") + `</div>`;
const inited = {};
function route() {
  let id = location.hash.replace("#", "");
  if (!NAV.some(n => n.id === id)) id = "overview";
  document.querySelectorAll(".module").forEach(m => m.classList.toggle("active", m.id === "m-" + id));
  document.querySelectorAll(".navitem").forEach(a => {
    const on = a.dataset.id === id;
    a.classList.toggle("active", on);
    if (on && window.innerWidth < 760) a.scrollIntoView({ inline: "center", block: "nearest" });
  });
  const n = NAV.find(x => x.id === id);
  if (n.init && !inited[id]) { inited[id] = true; n.init(); }
  document.title = `${n.t} · Health OS`;
  window.scrollTo(0, 0);
  if (pendingFocus && id === pendingFocus.mod) { const k = pendingFocus.elId; pendingFocus = null; requestAnimationFrame(() => focusCard(k)); }
}
window.addEventListener("hashchange", route);
route();

};
