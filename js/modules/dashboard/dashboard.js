import { Repository } from "../../db/repository.js";
import { buildDailyMatrix } from "../../engine/normalizer.js";
import { computeWellbeingByDay, averageWellbeing, wellbeingColor } from "../../engine/wellbeing.js";
import { escapeHtml, formatDate, formatDateTime } from "../../utils/dom.js";

const MODULES = [
  { key: "daily_checkin", label: "Check-in ràpid", dateField: "date" },
  { key: "pain_events", label: "Dolor corporal", dateField: "timestamp" },
  { key: "headache_events", label: "Mal de cap", dateField: "timestamp" },
  { key: "vertigo_events", label: "Vertígens", dateField: "timestamp" },
  { key: "digestive_events", label: "Digestiu (símptomes)", dateField: "timestamp" },
  { key: "bowel_movements", label: "Deposicions", dateField: "timestamp" },
  { key: "sleep_log", label: "Son", dateField: "date" },
  { key: "exercise_log", label: "Exercici", dateField: "timestamp" },
  { key: "cycle_log", label: "Cicle menstrual", dateField: "date" },
  { key: "skin_episodes", label: "Pell", dateField: "dataInici" },
  { key: "medications", label: "Medicació", dateField: "timestamp" },
];

const METRICS = [
  { key: "wellbeing", label: "Benestar general", max: 100, color: "sage" },
  { key: "dolor_general", label: "Dolor", max: 10, color: "clay" },
  { key: "digestiu_general", label: "Digestiu", max: 10, color: "amber" },
  { key: "son_qualitat", label: "Son", max: 10, color: "teal" },
  { key: "energia_fisica", label: "Energia física", max: 10, color: "sage" },
];

let currentMetric = "wellbeing";
let selectedDate = null;

function dateOnly(v) {
  return (v || "").slice(0, 10);
}

function lastNDates(n, endDate = new Date()) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function renderDashboard(container) {
  currentMetric = "wellbeing";
  selectedDate = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Dashboard</h1>
      <p class="view-sub">Vista general de com evolucionen les teves dades. Toca qualsevol dia del calendari per veure'n el detall complet.</p>
    </div>
    <div class="card"><p class="ledger-empty">Calculant…</p></div>
  `;

  const matrix = await buildDailyMatrix();
  const byDay = computeWellbeingByDay(matrix);
  const allDates = Object.keys(matrix).sort();

  if (allDates.length === 0) {
    container.querySelector(".card").innerHTML = emptyState("Encara no hi ha cap dada registrada. Comença pel check-in ràpid i els altres mòduls.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const last7 = lastNDates(7);
  const prev7 = lastNDates(7, new Date(Date.now() - 7 * 86400000));
  const last30 = lastNDates(30);
  const avg7 = averageWellbeing(byDay, last7);
  const avgPrev7 = averageWellbeing(byDay, prev7);
  const avg30 = averageWellbeing(byDay, last30);
  const todayScore = byDay[today] ?? null;

  const moduleStats = await getModuleStats();

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Dashboard</h1>
      <p class="view-sub">Vista general de com evolucionen les teves dades. Toca qualsevol dia del calendari per veure'n el detall complet.</p>
    </div>

    <div class="grid-2" style="grid-template-columns: 1fr 1fr;">
      ${wellbeingCard(todayScore, avg7, avgPrev7, avg30)}
      ${heatmapCard(byDay)}
    </div>

    <div class="card" style="margin-top: var(--sp-6);" id="day-detail-card">
      ${await dayDetailHtml(selectedDate)}
    </div>

    <div class="card" style="margin-top: var(--sp-6);">
      <h2 class="card-title">Evolució</h2>
      <div class="tabs" id="metric-tabs">
        ${METRICS.map(m => `<button class="tab-btn ${m.key === currentMetric ? "active" : ""}" data-metric="${m.key}">${m.label}</button>`).join("")}
      </div>
      <div id="line-chart-wrap">${lineChart(matrix, byDay, allDates, currentMetric)}</div>
    </div>

    <div class="card" style="margin-top: var(--sp-6);">
      <h2 class="card-title">Constància de registre</h2>
      ${moduleTable(moduleStats)}
    </div>
  `;

  container.querySelectorAll("[data-date-cell]").forEach(cell => {
    cell.addEventListener("click", async () => {
      selectedDate = cell.dataset.dateCell;
      container.querySelector("#day-detail-card").innerHTML = await dayDetailHtml(selectedDate);
    });
  });

  container.querySelectorAll("[data-metric]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentMetric = btn.dataset.metric;
      container.querySelectorAll("[data-metric]").forEach(b => b.classList.toggle("active", b === btn));
      container.querySelector("#line-chart-wrap").innerHTML = lineChart(matrix, byDay, allDates, currentMetric);
    });
  });
}

function emptyState(message) {
  return `<div class="empty-state"><div class="emoji-mark">···</div><p>${escapeHtml(message)}</p></div>`;
}

function trendArrow(avg7, avgPrev7) {
  if (avg7 == null || avgPrev7 == null) return "";
  const diff = avg7 - avgPrev7;
  if (Math.abs(diff) < 3) return `<span style="color: var(--ink-faint);">→ estable</span>`;
  return diff > 0
    ? `<span style="color: var(--sage);">↑ millorant (+${diff})</span>`
    : `<span style="color: var(--clay);">↓ empitjorant (${diff})</span>`;
}

function wellbeingCard(todayScore, avg7, avgPrev7, avg30) {
  const display = todayScore ?? avg7 ?? avg30;
  const color = wellbeingColor(display);
  return `
    <div class="card">
      <h2 class="card-title">Índex de benestar</h2>
      <p style="font-family: var(--font-mono); font-size: var(--fs-xxl); margin: 0; color: ${color};">${display ?? "—"}<span style="font-size: var(--fs-md); color: var(--ink-faint);">/100</span></p>
      <p style="margin: var(--sp-2) 0 0; font-size: var(--fs-sm); color: var(--ink-soft);">
        Mitjana 7 dies: <strong>${avg7 ?? "—"}</strong> · Mitjana 30 dies: <strong>${avg30 ?? "—"}</strong>
      </p>
      <p style="margin: var(--sp-1) 0 0; font-size: var(--fs-sm);">${trendArrow(avg7, avgPrev7)}</p>
      <p style="margin: var(--sp-3) 0 0; font-size: var(--fs-xs); color: var(--ink-faint); font-style: italic;">Combina totes les variables amb valència coneguda (dolor, digestiu, son, energia, pell...). No és una mètrica mèdica, només una referència pròpia.</p>
    </div>
  `;
}

function heatmapCard(byDay) {
  const weeks = 12;
  const totalDays = weeks * 7;
  const dates = lastNDates(totalDays);
  const first = new Date(dates[0] + "T00:00:00");
  const pad = first.getDay();
  const cells = [...Array(pad).fill(null), ...dates];

  const cellsHtml = cells.map(d => {
    if (!d) return `<div style="width:12px;height:12px;"></div>`;
    const score = byDay[d];
    const color = score != null ? wellbeingColor(score) : "var(--paper-alt)";
    const opacity = score != null ? 0.35 + (score / 100) * 0.65 : 1;
    return `<div data-date-cell="${d}" title="${d}${score != null ? `: ${score}/100` : ": sense dades"}" style="width:12px;height:12px;border-radius:2px;background:${color};opacity:${opacity};cursor:pointer;"></div>`;
  }).join("");

  return `
    <div class="card">
      <h2 class="card-title">Calendari (últimes 12 setmanes)</h2>
      <div style="display:grid; grid-template-columns: repeat(${Math.ceil(cells.length / 7)}, 12px); grid-template-rows: repeat(7, 12px); grid-auto-flow: column; gap: 3px;">
        ${cellsHtml}
      </div>
      <p style="margin: var(--sp-3) 0 0; font-size: var(--fs-xs); color: var(--ink-faint);">Més verd = millor benestar. Gris = sense dades. Toca un dia per veure'n el detall.</p>
    </div>
  `;
}

function seriesFor(matrix, byDay, metricKey) {
  if (metricKey === "wellbeing") return byDay;
  const series = {};
  for (const date of Object.keys(matrix)) {
    const v = matrix[date][metricKey];
    if (v != null) series[date] = v;
  }
  return series;
}

function lineChart(matrix, byDay, allDates, metricKey) {
  const metric = METRICS.find(m => m.key === metricKey) || METRICS[0];
  const series = seriesFor(matrix, byDay, metricKey);
  const dates = allDates.length > 90 ? allDates.slice(-90) : allDates;
  const usableDates = dates.filter(d => series[d] != null);

  if (usableDates.length < 2) {
    return `<p class="ledger-empty">Encara no hi ha prou dies amb "${escapeHtml(metric.label)}" per dibuixar una línia.</p>`;
  }

  const w = 800, h = 200, padding = 20;
  const step = (w - padding * 2) / Math.max(1, usableDates.length - 1);

  const coords = usableDates.map((d, i) => {
    const x = padding + i * step;
    const y = padding + (1 - series[d] / metric.max) * (h - padding * 2);
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h - padding} L${coords[0][0].toFixed(1)},${h - padding} Z`;

  const firstLabel = formatDate(usableDates[0]);
  const lastLabel = formatDate(usableDates[usableDates.length - 1]);
  const colorVar = `var(--${metric.color})`;
  const bgVar = `var(--${metric.color}-bg, var(--paper-alt))`;

  return `
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto;">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${h - padding}" stroke="var(--line)" stroke-width="1" />
      <line x1="${padding}" y1="${h - padding}" x2="${w - padding}" y2="${h - padding}" stroke="var(--line)" stroke-width="1" />
      <path d="${areaPath}" fill="${bgVar}" opacity="0.6" />
      <path d="${path}" fill="none" stroke="${colorVar}" stroke-width="2" />
    </svg>
    <div style="display:flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--ink-faint); margin-top: var(--sp-1);">
      <span>${escapeHtml(firstLabel)}</span>
      <span>${escapeHtml(lastLabel)}</span>
    </div>
  `;
}

async function getModuleStats() {
  const stats = [];
  for (const m of MODULES) {
    const repo = new Repository(m.key);
    const all = await repo.getAll();
    const dates = new Set(all.map(r => dateOnly(r[m.dateField])).filter(Boolean));
    const sorted = [...dates].sort();
    stats.push({
      label: m.label,
      days: dates.size,
      lastDate: sorted.length ? sorted[sorted.length - 1] : null,
    });
  }
  return stats;
}

function moduleTable(stats) {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div style="display:flex; flex-direction:column; gap: var(--sp-2);">
      ${stats.map(s => {
        const daysSince = s.lastDate ? Math.round((new Date(today) - new Date(s.lastDate)) / 86400000) : null;
        const staleness = daysSince == null ? "var(--ink-faint)" : daysSince <= 1 ? "var(--sage)" : daysSince <= 7 ? "var(--amber)" : "var(--clay)";
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding: var(--sp-2) 0; border-bottom: 1px solid var(--line);">
            <span style="font-size: var(--fs-sm);">${escapeHtml(s.label)}</span>
            <span style="font-size: var(--fs-xs); color: var(--ink-faint);">${s.days} dies registrats</span>
            <span style="font-size: var(--fs-xs); color: ${staleness};">${s.lastDate ? `últim: ${formatDate(s.lastDate)}` : "sense registres"}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ---------------- Detall d'un dia concret ---------------- */

async function dayDetailHtml(date) {
  const rows = [];

  const checkin = (await new Repository("daily_checkin").getByIndex("date", date))[0];
  if (checkin) {
    rows.push(row("Check-in", `dolor ${checkin.dolorGeneral}/10 · digestiu ${checkin.digestiuGeneral}/10 · son ${checkin.sonQualitat}/10 · energia física ${checkin.energiaFisica}/10 · energia mental ${checkin.energiaMental}/10${checkin.malDeCap ? " · mal de cap" : ""}`));
  }

  const pains = (await new Repository("pain_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  pains.forEach(p => {
    const summary = (p.entries || []).map(en => `${en.zonaLabels.join("+")}: ${en.tipus.join(", ")}`).join(" · ");
    rows.push(row("Dolor corporal", `${summary} (intensitat ${p.intensitat}/10)`));
  });

  const headaches = (await new Repository("headache_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  headaches.forEach(h => rows.push(row("Mal de cap", `intensitat ${h.intensitat}/10${h.tipus?.length ? " · " + h.tipus.join(", ") : ""}`)));

  const vertigos = (await new Repository("vertigo_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  vertigos.forEach(v => rows.push(row("Vertígens", `intensitat ${v.intensitat}/10`)));

  const digestives = (await new Repository("digestive_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  digestives.forEach(d => {
    const parts = ["inflor", "dolorAbdominal", "retortijons", "gasos", "acidesa", "nausees"]
      .filter(k => d[k] > 0).map(k => `${k} ${d[k]}/10`);
    if (d.llaguesBoca) parts.push("llagues a la boca");
    rows.push(row("Digestiu", parts.join(", ") || "sense símptomes destacats"));
  });

  const bowels = (await new Repository("bowel_movements").getAll()).filter(e => dateOnly(e.timestamp) === date);
  bowels.forEach(b => rows.push(row("Deposició", `Bristol ${b.bristol}${b.urgencia ? " · urgència" : ""}${b.sang ? " · sang" : ""}`)));

  const sleep = (await new Repository("sleep_log").getByIndex("date", date))[0];
  if (sleep) {
    rows.push(row("Son", `qualitat ${sleep.qualitat}/10 · ${sleep.numDespertars ?? 0} despertars${sleep.mocsMati?.length ? " · mocs matinals" : ""}`));
  }

  const exercises = (await new Repository("exercise_log").getAll()).filter(e => dateOnly(e.timestamp) === date);
  exercises.forEach(ex => rows.push(row("Exercici", `${ex.tipus}${ex.durada ? " · " + ex.durada + " min" : ""}`)));

  const cycle = (await new Repository("cycle_log").getByIndex("date", date))[0];
  if (cycle && (cycle.sagnat || cycle.simptomes?.length)) {
    rows.push(row("Cicle", `${cycle.sagnat ? "regla (" + cycle.sagnat + ")" : ""}${cycle.simptomes?.length ? " · " + cycle.simptomes.join(", ") : ""}`));
  }

  const skins = (await new Repository("skin_episodes").getAll()).filter(sk => {
    if (!sk.dataInici) return false;
    const end = sk.dataFi || new Date().toISOString().slice(0, 10);
    return sk.dataInici <= date && date <= end;
  });
  skins.forEach(sk => {
    const summary = (sk.entries || []).map(en => `${en.zonaLabel}: ${en.tipus.join(", ")}`).join(" · ");
    rows.push(row("Pell", summary || "brot actiu"));
  });

  const meds = (await new Repository("medications").getAll()).filter(m => dateOnly(m.timestamp) === date);
  meds.forEach(m => rows.push(row("Medicació", `${m.nom}${m.dosi ? " · " + m.dosi : ""}${m.motiu ? " · " + m.motiu : ""}`)));

  return `
    <h2 class="card-title">Detall del dia — ${escapeHtml(formatDate(date))}</h2>
    ${rows.length ? `<div class="event-list">${rows.join("")}</div>` : `<p class="ledger-empty">Sense registres aquest dia.</p>`}
  `;
}

function row(label, text) {
  return `
    <div class="event-row">
      <div class="event-row-top"><span class="badge">${escapeHtml(label)}</span></div>
      <div class="event-tags">${escapeHtml(text)}</div>
    </div>
  `;
}
