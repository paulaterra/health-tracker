import { Repository } from "../../db/repository.js";
import { buildDailyMatrix, VARIABLE_META } from "../../engine/normalizer.js";
import { computeWellbeingByDay, averageWellbeing, wellbeingColor } from "../../engine/wellbeing.js";
import { escapeHtml, formatDate, formatDateTime } from "../../utils/dom.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml, sectionalIntelligenceHtml } from "../../engine/intelligence-view.js";
import { renderBodyMapSvg } from "../pain/zones.js";
import { renderHeadMapSvg } from "../pain/head-zones.js";
import { buildPersonalProfile, buildPredictions, calendarIconsForDay } from "../../engine/personal-insights.js";

const MODULES = [
  { key: "daily_checkin", label: "Check-in ràpid", dateField: "date" },
  { key: "pain_events", label: "Dolor corporal", dateField: "timestamp" },
  { key: "movement_limitations", label: "Limitacions de moviment", dateField: "timestamp" },
  { key: "headache_events", label: "Mal de cap", dateField: "timestamp" },
  { key: "vertigo_events", label: "Vertígens i boira mental", dateField: "timestamp" },
  { key: "digestive_events", label: "Digestiu (símptomes)", dateField: "timestamp" },
  { key: "bowel_movements", label: "Digestiu", dateField: "timestamp" },
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
  { key: "son_qualitat", label: "Mal descans", max: 10, color: "teal" },
  { key: "energia_fisica", label: "Cansament físic", max: 10, color: "sage" },
];

let currentMetric = "wellbeing";
let selectedDate = null;
let calendarMonth = null;
let currentAnalysisDays = 30;


function analysisDateRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function matrixForLastDays(matrix, days) {
  const { start, end } = analysisDateRange(days);
  return Object.fromEntries(Object.entries(matrix).filter(([date]) => date >= start && date <= end));
}

function analysisPeriodHtml(matrix, intel, days) {
  return `
    <div class="card dashboard-analysis-period" style="margin-top: var(--sp-6);">
      <div class="section-analysis-heading" style="margin-bottom: var(--sp-4);">
        <div>
          <span class="view-eyebrow">Període d’anàlisi</span>
          <h2 class="card-title">Anàlisi intel·ligent</h2>
        </div>
        <div class="tabs" id="analysis-period-tabs" aria-label="Selecciona el període de l’anàlisi">
          ${[30, 60, 90].map(value => `<button type="button" class="tab-btn ${value === days ? "active" : ""}" data-analysis-days="${value}">Últims ${value} dies</button>`).join("")}
        </div>
      </div>
      <div id="sectional-intelligence-wrap">
        ${sectionalIntelligenceHtml(matrix, intel, { title: `Lectura dels últims ${days} dies` })}
      </div>
    </div>`;
}

function wireAnalysisPeriod(container, fullMatrix) {
  container.querySelectorAll("[data-analysis-days]").forEach(button => {
    button.addEventListener("click", async () => {
      const days = Number(button.dataset.analysisDays);
      if (!days || days === currentAnalysisDays) return;
      currentAnalysisDays = days;
      container.querySelectorAll("[data-analysis-days]").forEach(item => {
        item.classList.toggle("active", item === button);
        item.disabled = true;
      });
      const wrap = container.querySelector("#sectional-intelligence-wrap");
      if (wrap) wrap.innerHTML = `<div class="ledger-empty">Calculant l’anàlisi dels últims ${days} dies…</div>`;
      try {
        const range = analysisDateRange(days);
        const intel = await generateIntelligence(range);
        if (wrap) wrap.innerHTML = sectionalIntelligenceHtml(matrixForLastDays(fullMatrix, days), intel, { title: `Lectura dels últims ${days} dies` });
      } catch (error) {
        console.error("No s’ha pogut actualitzar el període d’anàlisi", error);
        if (wrap) wrap.innerHTML = `<div class="ledger-empty">No s’ha pogut calcular l’anàlisi. Torna-ho a provar.</div>`;
      } finally {
        container.querySelectorAll("[data-analysis-days]").forEach(item => { item.disabled = false; });
      }
    });
  });
}

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

function movementShortLabel(value) {
  const text = String(value || "").toLowerCase();
  const labels = [
    [/girar el cap.*esquerra/, "Girar cap · esquerra"],
    [/girar el cap.*dreta/, "Girar cap · dreta"],
    [/mirar amunt/, "Mirar amunt"],
    [/mirar avall/, "Mirar avall"],
    [/inclinar el cap.*esquerra/, "Inclinar cap · esquerra"],
    [/inclinar el cap.*dreta/, "Inclinar cap · dreta"],
    [/inclinar l'esquena endavant/, "Inclinar esquena · endavant"],
    [/estendre l'esquena enrere/, "Estendre esquena · enrere"],
    [/inclinar (?:el tronc|l'esquena).*esquerra/, "Inclinar esquena · esquerra"],
    [/inclinar (?:el tronc|l'esquena).*dreta/, "Inclinar esquena · dreta"],
    [/girar el tronc.*esquerra/, "Girar tronc · esquerra"],
    [/girar el tronc.*dreta/, "Girar tronc · dreta"],
    [/ajupir/, "Ajupir-se"],
    [/incorporar/, "Incorporar-se"],
  ];
  return labels.find(([pattern]) => pattern.test(text))?.[1] || value;
}

export async function renderDashboard(container) {
  currentMetric = "wellbeing";
  currentAnalysisDays = 30;
  selectedDate = new Date().toISOString().slice(0, 10);
  calendarMonth = selectedDate.slice(0, 7);

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Dashboard</h1>
      <p class="view-sub">Vista general de com evolucionen les teves dades. Toca qualsevol dia del calendari per veure'n el detall complet.</p>
    </div>
    <div class="card"><p class="ledger-empty">Calculant…</p></div>
  `;

  const initialRange = analysisDateRange(currentAnalysisDays);
  const [matrix, intel, analysisIntel] = await Promise.all([
    buildDailyMatrix(),
    generateIntelligence(),
    generateIntelligence(initialRange),
  ]);
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

  const [moduleStats, dailyRecordCounts] = await Promise.all([getModuleStats(), getDailyRecordCounts()]);
  const personalProfile = buildPersonalProfile(matrix, intel);
  const predictions = buildPredictions(matrix, intel);

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Dashboard</h1>
      <p class="view-sub">Vista general de com evolucionen les teves dades. Toca qualsevol dia del calendari per veure'n el detall complet.</p>
    </div>

    ${smartTodayHtml(matrix, byDay, intel, personalProfile, predictions)}

    ${intelligentSummaryHtml(intel, { compact: true, title: "Què destaca ara" })}

    <div class="grid-2" style="grid-template-columns: 1fr 1fr;">
      ${wellbeingCard(todayScore, avg7, avgPrev7, avg30)}
      ${heatmapCard(byDay)}
    </div>

    <div class="card dashboard-calendar-card" style="margin-top: var(--sp-6);">
      <div id="detailed-calendar-wrap">${detailedCalendarHtml(byDay, dailyRecordCounts, calendarMonth, selectedDate, matrix)}</div>
    </div>

    <div class="card" style="margin-top: var(--sp-6);" id="day-detail-card">
      ${await dayDetailHtml(selectedDate)}
    </div>

    ${analysisPeriodHtml(matrixForLastDays(matrix, currentAnalysisDays), analysisIntel, currentAnalysisDays)}

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

  wireDateCells(container, container, byDay, dailyRecordCounts, matrix);
  wireDayNavigation(container, byDay, dailyRecordCounts, matrix);
  wireDetailedCalendar(container, byDay, dailyRecordCounts, matrix);
  wireAnalysisPeriod(container, matrix);
  container.querySelectorAll("[data-smart-route]").forEach(button => button.addEventListener("click", () => {
    const route = button.dataset.smartRoute;
    document.querySelector(`[data-route="${route}"]`)?.click();
  }));

  container.querySelectorAll("[data-metric]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentMetric = btn.dataset.metric;
      container.querySelectorAll("[data-metric]").forEach(b => b.classList.toggle("active", b === btn));
      container.querySelector("#line-chart-wrap").innerHTML = lineChart(matrix, byDay, allDates, currentMetric);
    });
  });
}


async function selectDashboardDate(container, date, { scrollToDetail = false, byDay = null, dailyRecordCounts = null, matrix = null } = {}) {
  selectedDate = date;

  // Si canviem de mes amb les fletxes del resum diari, actualitzem també el calendari
  // perquè el dia seleccionat continuï sent visible i marcat.
  const nextMonth = selectedDate.slice(0, 7);
  if (nextMonth !== calendarMonth && byDay && dailyRecordCounts && matrix) {
    calendarMonth = nextMonth;
    const wrap = container.querySelector("#detailed-calendar-wrap");
    if (wrap) {
      wrap.innerHTML = detailedCalendarHtml(byDay, dailyRecordCounts, calendarMonth, selectedDate, matrix);
      wireDateCells(container, wrap, byDay, dailyRecordCounts, matrix);
      wireDetailedCalendar(container, byDay, dailyRecordCounts, matrix);
    }
  } else {
    container.querySelectorAll("[data-date-cell]").forEach(c => c.classList.toggle("is-selected", c.dataset.dateCell === selectedDate));
  }

  const detail = container.querySelector("#day-detail-card");
  if (detail) {
    detail.innerHTML = await dayDetailHtml(selectedDate);
    wireDayNavigation(container, byDay, dailyRecordCounts, matrix);
    if (scrollToDetail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function wireDateCells(container, root = container, byDay = null, dailyRecordCounts = null, matrix = null) {
  root.querySelectorAll("[data-date-cell]").forEach(cell => {
    cell.addEventListener("click", async () => {
      await selectDashboardDate(container, cell.dataset.dateCell, {
        scrollToDetail: true,
        byDay,
        dailyRecordCounts,
        matrix,
      });
    });
  });
}

function shiftIsoDate(date, amount) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function wireDayNavigation(container, byDay, dailyRecordCounts, matrix) {
  container.querySelectorAll("[data-day-nav]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      const nextDate = shiftIsoDate(selectedDate, Number(button.dataset.dayNav));
      await selectDashboardDate(container, nextDate, {
        scrollToDetail: false,
        byDay,
        dailyRecordCounts,
        matrix,
      });
    });
  });
}

function wireDetailedCalendar(container, byDay, dailyRecordCounts, matrix) {
  const wrap = container.querySelector("#detailed-calendar-wrap");
  if (!wrap) return;
  wrap.querySelectorAll("[data-calendar-nav]").forEach(button => {
    button.addEventListener("click", () => {
      const [year, month] = calendarMonth.split("-").map(Number);
      const next = new Date(year, month - 1 + Number(button.dataset.calendarNav), 1);
      calendarMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      wrap.innerHTML = detailedCalendarHtml(byDay, dailyRecordCounts, calendarMonth, selectedDate, matrix);
      wireDateCells(container, wrap, byDay, dailyRecordCounts, matrix);
      wireDetailedCalendar(container, byDay, dailyRecordCounts, matrix);
  wireAnalysisPeriod(container, matrix);
    });
  });
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ca-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function detailedCalendarHtml(byDay, dailyRecordCounts, monthKey, activeDate, matrix = {}) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  const today = new Date().toISOString().slice(0, 10);
  const blanks = Array.from({ length: mondayOffset }, () => `<div class="month-calendar-cell is-empty" aria-hidden="true"></div>`).join("");
  const days = Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const score = byDay[date];
    const records = dailyRecordCounts[date] || 0;
    const color = score != null ? wellbeingColor(score) : "var(--paper-alt)";
    const selected = date === activeDate ? " is-selected" : "";
    const current = date === today ? " is-today" : "";
    const hasData = records > 0 ? " has-data" : "";
    const icons = calendarIconsForDay(matrix[date] || {});
    return `<button type="button" class="month-calendar-cell${selected}${current}${hasData}" data-date-cell="${date}" aria-label="${date}: ${records ? `${records} registres` : "sense dades"}">
      <span class="month-calendar-day">${day}</span>
      <span class="month-calendar-score" style="--day-color:${color};">${score != null ? `${score}/100` : "—"}</span>
      <span class="month-calendar-icons">${icons.map(item=>`<i class="calendar-symptom-icon tone-${item.tone}" title="${escapeHtml(item.label)}">${item.icon}</i>`).join("")}</span>
      <span class="month-calendar-count">${records ? `${records} ${records === 1 ? "registre" : "registres"}` : "Tot OK / sense registres"}</span>
    </button>`;
  }).join("");
  return `
    <div class="detailed-calendar-heading">
      <div>
        <span class="view-eyebrow">Calendari detallat</span>
        <h2 class="card-title">${escapeHtml(monthLabel(monthKey))}</h2>
        <p class="detailed-calendar-help">Toca qualsevol dia per veure, per separat, el dolor, el son, el digestiu, l'exercici, el cicle, la pell, la medicació i la resta de registres.</p>
      </div>
      <div class="detailed-calendar-nav" aria-label="Canviar de mes">
        <button type="button" class="btn btn-ghost" data-calendar-nav="-1" aria-label="Mes anterior">←</button>
        <button type="button" class="btn btn-ghost" data-calendar-nav="1" aria-label="Mes següent">→</button>
      </div>
    </div>
    <div class="month-calendar-weekdays" aria-hidden="true">
      ${["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"].map(d => `<span>${d}</span>`).join("")}
    </div>
    <div class="month-calendar-grid">${blanks}${days}</div>
    <div class="month-calendar-legend">
      <span><i class="calendar-legend-dot has-records"></i> Amb registres</span>
      <span><i class="calendar-legend-dot selected"></i> Dia seleccionat</span>
      <span>La barra de color indica el benestar estimat del dia.</span>
    </div>`;
}

async function getDailyRecordCounts() {
  const counts = {};
  for (const module of MODULES) {
    const all = await new Repository(module.key).getAll();
    for (const record of all) {
      const date = dateOnly(record[module.dateField]);
      if (date) counts[date] = (counts[date] || 0) + 1;
    }
  }
  return counts;
}

function numericAverage(matrix, dates, key) {
  const values = dates.map(d => matrix[d]?.[key]).filter(v => Number.isFinite(Number(v))).map(Number);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function changeDescriptor(current, previous, meta) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return { icon: "→", word: "estable", tone: "neutral", diff };
  const improved = meta?.valence === "negative" ? diff < 0 : diff > 0;
  return { icon: diff > 0 ? "↑" : "↓", word: improved ? "millor" : "pitjor", tone: improved ? "good" : "bad", diff };
}

function smartTodayHtml(matrix, byDay, intel, profile, predictions) {
  const today = new Date().toISOString().slice(0, 10);
  const score = byDay[today];
  const todayDay = matrix[today] || {};
  const icons = calendarIconsForDay(todayDay);
  const main = intel.patterns?.[0]?.text || intel.cycle?.detected?.[0]?.text || "Encara estic recollint dades per trobar un patró consistent.";
  const status = score == null ? "Encara no hi ha dades d’avui" : score >= 75 ? "Avui sembla un dia favorable" : score >= 50 ? "Avui hi ha alguns símptomes a observar" : "Avui és un dia més complicat que la teva mitjana";
  const predictionItems = predictions.items.length ? predictions.items.slice(0,2).map(x=>`<li>${escapeHtml(x.label)} <span>confiança ${escapeHtml(x.confidence)}</span></li>`).join("") : `<li>${escapeHtml(predictions.note)}</li>`;
  return `<section class="smart-dashboard card">
    <div class="smart-dashboard-main">
      <span class="view-eyebrow">Avui</span><h2 class="card-title">${escapeHtml(status)}</h2>
      <div class="smart-score">${score ?? "—"}<small>/100</small></div>
      <div class="smart-today-icons">${icons.length?icons.map(i=>`<span class="tone-${i.tone}">${i.icon} ${escapeHtml(i.label)}</span>`).join(""):`<span class="all-ok">✓ Cap símptoma registrat: s’interpreta com a tot OK</span>`}</div>
    </div>
    <div class="smart-dashboard-side">
      <div><span class="view-eyebrow">El més destacat</span><p>${escapeHtml(main)}</p></div>
      <div><span class="view-eyebrow">Predicció personal</span><ul>${predictionItems}</ul></div>
      <div class="smart-links"><button type="button" class="btn btn-ghost" data-smart-route="perfil">Veure el meu perfil</button><button type="button" class="btn btn-ghost" data-smart-route="assistent">Fer una pregunta</button></div>
    </div>
  </section>`;
}

function healthAssistantHtml(matrix, byDay, intel) {
  const today = new Date();
  const recent = lastNDates(7, today);
  const previous = lastNDates(7, new Date(today.getTime() - 7 * 86400000));
  const candidates = ["dolor_intensitat_max", "dolor_general", "son_qualitat", "energia_fisica", "digestiu_general", "digestiu_inflor"]
    .map(key => {
      const current = numericAverage(matrix, recent, key);
      const prev = numericAverage(matrix, previous, key);
      const meta = VARIABLE_META[key];
      const change = changeDescriptor(current, prev, meta);
      return { key, current, prev, meta, change, magnitude: change ? Math.abs(change.diff) : 0 };
    })
    .filter(x => x.current != null)
    .sort((a, b) => b.magnitude - a.magnitude);

  const changes = candidates.slice(0, 4);
  const mainPattern = intel.patterns?.[0]?.text || null;
  const painTrend = changes.find(x => x.key === "dolor_intensitat_max" || x.key === "dolor_general");
  const sleepTrend = changes.find(x => x.key === "son_qualitat");

  let greeting = "Encara estic aprenent de les teves dades.";
  if (painTrend?.change?.tone === "bad") greeting = `Aquesta setmana el dolor és ${Math.abs(painTrend.change.diff).toFixed(1)} punts més alt que la setmana anterior.`;
  else if (painTrend?.change?.tone === "good") greeting = `Aquesta setmana el dolor ha baixat ${Math.abs(painTrend.change.diff).toFixed(1)} punts respecte de l'anterior.`;
  else if (intel.pain?.profile?.count) greeting = `He analitzat ${intel.pain.profile.count} registres de dolor i ${intel.period.days} dies amb dades.`;

  const observe = [];
  if (mainPattern) observe.push(mainPattern);
  if (sleepTrend?.change?.tone === "bad") observe.push("Continua registrant el son: aquesta setmana el mal descans ha augmentat i convé comprovar si coincideix amb més dolor.");
  if (intel.pain?.profile?.topTrigger) observe.push(`Marca de manera constant “${intel.pain.profile.topTrigger[0]}” per comprovar si la coincidència es manté.`);
  if (!observe.length) observe.push("Completa dolor, mal descans i check-in el mateix dia per augmentar la fiabilitat dels patrons.");

  const changeRows = changes.length ? changes.map(x => {
    const label = x.meta?.label || x.key;
    const c = x.change;
    const color = c?.tone === "good" ? "var(--sage)" : c?.tone === "bad" ? "var(--clay)" : "var(--ink-faint)";
    const value = x.current != null ? x.current.toFixed(1) : "—";
    return `<div class="assistant-change"><span>${escapeHtml(label)}</span><strong style="color:${color};">${c?.icon || "·"} ${escapeHtml(c?.word || "sense comparació")} · ${value}</strong></div>`;
  }).join("") : `<p class="ledger-empty">Encara no hi ha prou dades per comparar setmanes.</p>`;

  return `
    <div class="card health-assistant" style="border-left:4px solid var(--sage); margin-bottom:var(--sp-6);">
      <div class="assistant-heading">
        <div><span class="view-eyebrow">Assistent de salut</span><h2 class="card-title" style="margin-top:var(--sp-1);">El més rellevant ara</h2></div>
        <span class="badge">dades pròpies</span>
      </div>
      <p class="assistant-lead">${escapeHtml(greeting)}</p>
      <div class="grid-2 assistant-grid" style="grid-template-columns:1fr 1fr;">
        <div><h3 class="assistant-subtitle">Què està canviant?</h3>${changeRows}</div>
        <div><h3 class="assistant-subtitle">Què convé observar?</h3><div class="event-list">${observe.slice(0,3).map(x => `<div class="event-row"><div class="event-tags">${escapeHtml(x)}</div></div>`).join("")}</div></div>
      </div>
      <p class="assistant-note">Resumeix tendències i associacions observades; no identifica causes ni substitueix una valoració mèdica.</p>
    </div>`;
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
    return `<button type="button" class="compact-calendar-cell ${d === selectedDate ? "is-selected" : ""}" data-date-cell="${d}" title="${d}${score != null ? `: ${score}/100` : ": sense dades"}" style="--cell-color:${color};--cell-opacity:${opacity};" aria-label="${d}${score != null ? `: ${score}/100` : ": sense dades"}"></button>`;
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


/* ---------------- Mapes visuals del dolor ---------------- */

function painActiveZones(pain) {
  return [...new Set((pain?.entries || []).flatMap(entry => entry.zonaIds || []))];
}


function safePainColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? String(value) : "#777777";
}

const PAIN_VISUAL_COLORS = Object.freeze({
  "dolor": "#B85C45",
  "sord (mal difús)": "#E78FB3",
  "dolor difús": "#E78FB3",
  "difus": "#E78FB3",
  "muscular": "#8A6D55",
  "tensió": "#4F8A72",
  "punxant": "#C62828",
  "punxant / ganivet": "#C62828",
  "polsàtil": "#A33D73",
  "cremor": "#EF7B45",
  "elèctric / descàrrega": "#D9A21B",
  "descàrrega / elèctric": "#D9A21B",
  "pressió / opressiu": "#7D6CCF",
  "pressio": "#7D6CCF",
  "rigidesa": "#6F8FAE",
  "contractura": "#C94F72",
  "espasme": "#6D7D3B",
  "estrebada": "#3F7C85",
  "formigueig": "#6B62A8",
  "adormiment": "#7B8794",
  "mal de tendó": "#3F8F6B",
  "mal de tendo": "#3F8F6B",
  "tendó": "#3F8F6B",
  "em tiba": "#D9822B",
  "tiba": "#D9822B",
  "altres": "#777777"
});

function canonicalPainColor(label, fallback = "#777777") {
  return PAIN_VISUAL_COLORS[String(label || "").trim().toLowerCase()] || safePainColor(fallback);
}

function painDrawingLegendHtml(pain) {
  const unique = [];
  const seen = new Set();
  for (const stroke of (pain?.painDrawing || [])) {
    const label = stroke.label || stroke.type || "Dolor pintat";
    const key = `${label}|${stroke.color}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ label, color: canonicalPainColor(label, stroke.color) });
    }
  }
  if (!unique.length) return "";
  return `<div class="pain-drawing-legend" aria-label="Llegenda dels colors del mapa pintat">
    <span class="pain-legend-title">Llegenda del dibuix</span>
    <div class="pain-legend-items">${unique.map(item => `<span class="pain-legend-item"><i style="--legend-color:${item.color};"></i>${escapeHtml(item.label)}</span>`).join("")}</div>
  </div>`;
}

function painMapPairHtml(pain, { compact = false, part = "auto" } = {}) {
  const activeZones = painActiveZones(pain);
  const strokes = Array.isArray(pain?.painDrawing) ? pain.painDrawing : [];

  const headZones = activeZones.filter(id => String(id).startsWith("head_"));
  const bodyZones = activeZones.filter(id => !String(id).startsWith("head_"));
  const headStrokes = strokes.filter(stroke => stroke.view === "head_back");
  const bodyStrokes = strokes.filter(stroke => stroke.view !== "head_back");

  const renderHead = part === "head" || (part === "auto" && (headZones.length || headStrokes.length));
  const renderBody = part === "body" || (part === "auto" && (bodyZones.length || bodyStrokes.length));
  const maps = [];

  if (renderBody) {
    const backZoneIds = new Set(["cervical","lumbar","columna_dorsal_alta","columna_dorsal_mitjana","columna_dorsal_baixa","trapezi_esquerre","trapezi_dret","omoplat_esquerre","omoplat_dret","costat_esquerre_post","costat_dret_post","natja_esquerra","natja_dreta","cuixa_esquerra_post","cuixa_dreta_post","bessons_esquerre","bessons_dret","taló_esquerre","taló_dret","cap_post"]);
    const hasFront = bodyStrokes.some(stroke => stroke.view === "front") || bodyZones.some(id => !String(id).endsWith("_post") && !backZoneIds.has(id));
    const hasBack = bodyStrokes.some(stroke => stroke.view === "back") || bodyZones.some(id => String(id).endsWith("_post") || backZoneIds.has(id));

    if (hasFront || (!hasFront && !hasBack)) {
      maps.push(`<div class="dashboard-bodymap"><span>Cos · davant</span>${renderBodyMapSvg("front", bodyZones, [], bodyStrokes)}</div>`);
    }
    if (hasBack || (!hasFront && !hasBack)) {
      maps.push(`<div class="dashboard-bodymap"><span>Cos · darrere</span>${renderBodyMapSvg("back", bodyZones, [], bodyStrokes)}</div>`);
    }
  }

  if (renderHead && (headZones.length || headStrokes.length || part === "head")) {
    maps.push(`<div class="dashboard-bodymap"><span>Detall del cap · darrere</span>${renderHeadMapSvg("head_back", headZones, [], headStrokes)}</div>`);
  }

  return `<div class="dashboard-bodymap-pair ${compact ? "is-compact" : ""}">${maps.join("")}</div>`;
}


function painRecordVisualSummary(pain) {
  const entries = Array.isArray(pain?.entries) ? pain.entries : [];
  const groups = entries.map((entry, index) => {
    const zones = (entry.zonaLabels || []).filter(Boolean);
    const types = (entry.tipus || []).filter(Boolean);
    const patterns = (entry.patroTemporal || []).filter(Boolean);
    if (!zones.length && !types.length && !patterns.length) return "";
    return `<div class="pain-detail-group">
      <div class="pain-detail-group-title"><span>${index + 1}</span><strong>${zones.length ? escapeHtml(zones.join(" · ")) : "Zona no especificada"}</strong></div>
      ${types.length ? `<div class="pain-detail-label">Tipus de dolor</div>${listChips(types, "is-types")}` : ""}
      ${patterns.length ? `<div class="pain-detail-label">Patró temporal</div>${listChips(patterns)}` : ""}
    </div>`;
  }).filter(Boolean).join("");

  const context = [
    ["Empitjora", (pain?.empitjora || []).join(", ")],
    ["Naturalesa", (pain?.naturalesaDolor || []).join(", ")],
    ["Impacte en el son", (pain?.impacteSon || []).join(", ")],
  ].filter(([, value]) => value);

  return `<div class="pain-record-visual-summary">
    ${groups ? `<div class="pain-detail-groups">${groups}</div>` : ""}
    ${context.length ? `<div class="pain-context-grid">${context.map(([label,value]) => `<div class="pain-context-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : ""}
    ${pain?.comentari ? `<div class="pain-comment-box"><span>Comentari</span><p>${escapeHtml(pain.comentari)}</p></div>` : ""}
  </div>`;
}

function isHeadPainZone(id = "", label = "") {
  const normalizedId = String(id || "").toLowerCase();
  const normalizedLabel = String(label || "").toLowerCase();
  return normalizedId.startsWith("head_")
    || /occipital|suboccipital|darrere de l[’']orella|coll superior/.test(normalizedLabel);
}

function painRecordForPart(pain, part) {
  const wantHead = part === "head";
  const entries = (Array.isArray(pain?.entries) ? pain.entries : []).map(entry => {
    const ids = Array.isArray(entry.zonaIds) ? entry.zonaIds : [];
    const labels = Array.isArray(entry.zonaLabels) ? entry.zonaLabels : [];
    const maxLength = Math.max(ids.length, labels.length);
    const selectedIndexes = [];
    for (let i = 0; i < maxLength; i += 1) {
      const head = isHeadPainZone(ids[i], labels[i]);
      if (head === wantHead) selectedIndexes.push(i);
    }
    if (!selectedIndexes.length) return null;
    return {
      ...entry,
      zonaIds: selectedIndexes.map(i => ids[i]).filter(Boolean),
      zonaLabels: selectedIndexes.map(i => labels[i]).filter(Boolean),
    };
  }).filter(Boolean);

  const painDrawing = (Array.isArray(pain?.painDrawing) ? pain.painDrawing : []).filter(stroke =>
    wantHead ? stroke.view === "head_back" : stroke.view !== "head_back"
  );

  return { ...pain, entries, painDrawing };
}

function painRecordHasPart(pain, part) {
  const filtered = painRecordForPart(pain, part);
  return filtered.entries.length > 0 || filtered.painDrawing.length > 0;
}

function movementLimitationsCompactHtml(records = []) {
  const neck = [...new Set(records.flatMap(item => Array.isArray(item?.neck) ? item.neck : []).filter(Boolean))];
  const back = [...new Set(records.flatMap(item => Array.isArray(item?.back) ? item.back : []).filter(Boolean))];
  if (!neck.length && !back.length) return "";

  const chips = [
    ...neck.map(value => `<span class="pain-movement-chip"><i aria-hidden="true">↺</i>${escapeHtml(movementShortLabel(value))}</span>`),
    ...back.map(value => `<span class="pain-movement-chip"><i aria-hidden="true">↔</i>${escapeHtml(movementShortLabel(value))}</span>`),
  ].join("");

  return `<aside class="pain-movement-summary" aria-label="Limitacions de moviment del dia">
    <div class="pain-movement-summary-title"><span aria-hidden="true">↔</span><strong>Limitacions de moviment</strong></div>
    <div class="pain-movement-chip-list">${chips}</div>
  </aside>`;
}

function painGroupedRecordsHtml(records, part, movementLimitations = []) {
  const label = part === "head" ? "Cap" : "Cos";
  const filteredRecords = records
    .filter(record => painRecordHasPart(record, part) || (part === "body" && !painRecordHasPart(record, "head")))
    .map(record => ({ original: record, filtered: painRecordForPart(record, part) }));
  if (!filteredRecords.length) return "";

  return `<section class="day-pain-part day-pain-part-${part}">
    <div class="day-pain-part-heading">
      <div><span class="day-pain-part-kicker">Dolor corporal</span><h4>${label}</h4></div>
      <span class="badge">${filteredRecords.length} ${filteredRecords.length === 1 ? "registre" : "registres"}</span>
    </div>
    ${part === "body" ? movementLimitationsCompactHtml(movementLimitations) : ""}
    <div class="day-pain-records">
      ${filteredRecords.map(({ original, filtered }) => `<article class="day-pain-record">
        <div class="day-pain-record-head"><strong>${escapeHtml(formatDateTime(original.timestamp))}</strong><span class="badge">${Number(original.intensitat) || 0}/10</span></div>
        ${painMapPairHtml(filtered, { compact: true, part })}
        ${painDrawingLegendHtml(filtered)}
        ${painRecordVisualSummary(filtered)}
      </article>`).join("")}
    </div>
  </section>`;
}

function painTextSummary(pain) {
  const groups = (pain?.entries || []).map(entry => {
    const zones = (entry.zonaLabels || []).join(" + ");
    const type = (entry.tipus || []).join(", ");
    return [zones, type].filter(Boolean).join(": ");
  }).filter(Boolean);
  const extras = [];
  if (Number.isFinite(Number(pain?.intensitat))) extras.push(`intensitat ${pain.intensitat}/10`);
  if (pain?.impacteSon?.length) extras.push(pain.impacteSon.join(", "));
  return [...groups, ...extras].join(" · ") || "Mapa de dolor registrat";
}


const DAY_MODULE_META = {
  checkin: { label: "Check-in", color: "#4F7462", soft: "#E3EBE2", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m7.5 12 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  pain: { label: "Dolor corporal", color: "#6C8F57", soft: "#E9F0E3", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 21v-5.5L7 11.5c-.6-1.8.4-3.8 2.2-4.4L12 6.2l2.8.9c1.8.6 2.8 2.6 2.2 4.4l-1.5 4V21M9 12h6M12 8v8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  movement: { label: "Limitacions de moviment", color: "#9A5B45", soft: "#F5E9E3", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v5a5 5 0 0 0 5 5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m14 11 3 3-3 3M9 20v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  headache: { label: "Mal de cap", color: "#C85B52", soft: "#FAE9E6", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 20H9.8a5 5 0 0 1-5-5v-4a7 7 0 0 1 7-7h1.4a5.8 5.8 0 0 1 5.8 5.8V13l-3.5 1.8V20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m19.5 5.5 1.8-1.2M20.2 9h2.2M19.3 12.3l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  vertigo: { label: "Vertígens i boira mental", color: "#6F5AA8", soft: "#EEEAF8", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8.3a7.2 7.2 0 1 0 .4 6.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 11.8a4.3 4.3 0 1 0-1.2 4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.7 14.1a1.7 1.7 0 1 0-2.3 1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  digestive: { label: "Digestiu", color: "#D28A20", soft: "#FBF0D8", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5v5c0 1.2-.8 2.2-2 2.6-1.8.6-3 2.2-3 4.1 0 2.9 2.4 5.3 5.3 5.3h2.4c4.6 0 8.3-3.7 8.3-8.3V9.8c0-2.2-1.8-4-4-4h-1.5v4.4c0 1.1-.9 2-2 2h-.3c-1.8 0-3.2-1.4-3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  bowel: { label: "Digestiu", color: "#B47227", soft: "#F8ECD9", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h10M6 9h12M7.5 12.5h9M9 16h6M10.5 19.5h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  sleep: { label: "Son", color: "#8252A1", soft: "#F1E8F5", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.7 15.2A8 8 0 0 1 8.8 4.3 8.2 8.2 0 1 0 19.7 15.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m17.5 4 .5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z" fill="currentColor"/></svg>` },
  exercise: { label: "Exercici", color: "#3978B9", soft: "#E6EFF9", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5c3.7.3 6.1-1.2 7.2-4.5l2.2 2.5c1.4 1.6 3.1 2.6 5.1 3l1.5.3v2.7H8.2A4.2 4.2 0 0 1 4 15.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.5 11 9 7.5l2.5-2 2 3.5 2-1.2 1.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  cycle: { label: "Cicle menstrual", color: "#C84E72", soft: "#F9E6EC", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 8.5c1.4 1 2.6 1.4 3.5 1.4s2.1-.4 3.5-1.4M12 10v6M9.5 17h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  skin: { label: "Pell", color: "#D66A2C", soft: "#FBEADF", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2c2.8 3.6 5 6.3 5 9.4a5 5 0 0 1-10 0c0-3.1 2.2-5.8 5-9.4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 5.5h4M16 5.5h4M3 9h3M18 9h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  medication: { label: "Medicació", color: "#32679B", soft: "#E5EEF7", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.2 14.8 9.6-9.6a3 3 0 0 1 4.2 4.2L9.4 19a3 3 0 1 1-4.2-4.2Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m9.2 10.8 4 4" stroke="currentColor" stroke-width="1.7"/></svg>` },
};

function stat(label, value, tone = "", scale = null) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="day-stat ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

const SCORE_SCALES = Object.freeze({
  pain: { low: "sense dolor", high: "molt dolor" },
  digestive: { low: "cap molèstia", high: "molt intens" },
  sleep: { low: "descans reparador", high: "molt mal son" },
  energyPhysical: { low: "molta energia", high: "esgotament" },
  energyMental: { low: "ment clara", high: "boira mental intensa" },
  headache: { low: "sense dolor", high: "molt intens" },
  vertigo: { low: "cap sensació", high: "molt intens" },
  fatigue: { low: "cap fatiga", high: "fatiga extrema" },
  exercise: { low: "molt suau", high: "molt intens" },
  skin: { low: "sense molèstia", high: "molt intens" },
});

function scoreGuideRow(label, scale) {
  if (!scale) return "";
  return `<div class="day-score-guide-row">
    ${label ? `<span class="day-score-guide-label">${escapeHtml(label)}</span>` : ""}
    <div class="day-score-guide-scale" aria-label="Escala: 0 ${escapeHtml(scale.low)}, 10 ${escapeHtml(scale.high)}">
      <span><b>0</b> ${escapeHtml(scale.low)}</span>
      <i aria-hidden="true"></i>
      <span><b>10</b> ${escapeHtml(scale.high)}</span>
    </div>
  </div>`;
}

function scoreGuide(scales = []) {
  const clean = (scales || []).filter(item => item?.scale);
  if (!clean.length) return "";
  return `<div class="day-score-guide ${clean.length > 1 ? "is-multiple" : ""}">${clean.map(item => scoreGuideRow(item.label, item.scale)).join("")}</div>`;
}

function chip(text) {
  if (!text) return "";
  return `<span class="day-chip">${escapeHtml(String(text))}</span>`;
}

function detailRow(label, value) {
  if (value === undefined || value === null || value === "" || value === false) return "";
  return `<div class="day-detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function note(text) {
  if (!text) return "";
  return `<p class="day-record-note"><span aria-hidden="true">✎</span>${escapeHtml(text)}</p>`;
}

function listChips(values, extraClass = "") {
  const clean = (values || []).filter(Boolean);
  if (!clean.length) return "";
  const items = extraClass.includes("is-types")
    ? clean.map(value => {
        const color = canonicalPainColor(value);
        return `<span class="day-chip pain-type-chip" style="--pain-chip-color:${color}"><i aria-hidden="true"></i>${escapeHtml(String(value))}</span>`;
      }).join("")
    : clean.map(chip).join("");
  return `<div class="day-chip-list ${extraClass}">${items}</div>`;
}

function sleepDuration(entry) {
  const start = entry.horaAdormir || entry.horaIntent || entry.horaLlit;
  const end = entry.horaLlevar;
  if (!start || !end || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} h${mins ? ` ${mins} min` : ""}`;
}

function moduleCard(type, body, { count = null, wide = false, scales = [] } = {}) {
  const meta = DAY_MODULE_META[type];
  return `<article class="day-module-card ${wide ? "is-wide" : ""}" data-module-type="${type}" style="--module-color:${meta.color};--module-soft:${meta.soft}">
    <header class="day-module-head">
      <span class="day-module-icon">${meta.icon}</span>
      <h4>${escapeHtml(meta.label)}</h4>
      ${count !== null ? `<span class="day-module-count">${count}</span>` : ""}
    </header>
    ${scoreGuide(scales)}
    <div class="day-module-body">${body}</div>
  </article>`;
}

const PRINCIPAL_DAY_MODULES = ["headache", "vertigo", "digestive", "sleep", "exercise", "cycle", "skin", "medication"];

function principalCardsHtml(cards) {
  return PRINCIPAL_DAY_MODULES.map(type => {
    const matching = cards.filter(card => card.type === type);
    if (!matching.length) {
      const symptomModules = new Set(["pain", "headache", "vertigo", "digestive", "skin"]);
      const emptyText = symptomModules.has(type)
        ? "Sense registres: s’interpreta com a tot OK"
        : "Sense dades registrades";
      return moduleCard(type, `<p class="day-ok-state">${emptyText}</p>`);
    }
    const body = matching.map(card => card.body).join("");
    const countValues = matching.map(card => card.options?.count).filter(value => Number.isFinite(Number(value))).map(Number);
    const count = countValues.length ? countValues.reduce((sum, value) => sum + value, 0) : null;
    const scales = matching.flatMap(card => card.options?.scales || []).filter((item, index, array) => {
      const key = `${item.label || ""}|${item.scale?.low || ""}|${item.scale?.high || ""}`;
      return array.findIndex(other => `${other.label || ""}|${other.scale?.low || ""}|${other.scale?.high || ""}` === key) === index;
    });
    return moduleCard(type, body, { count, wide: matching.some(card => card.options?.wide), scales });
  }).join("");
}

/* ---------------- Detall d'un dia concret ---------------- */

export async function dayDetailHtml(date) {
  const cards = [];
  let checkinSleepSummary = null;
  let checkinPhysicalFatigue = null;
  let checkinComment = "";
  let legacyBrainFog = null;
  const pushCard = (type, body, options = {}) => cards.push({ type, body, options });

  const checkin = (await new Repository("daily_checkin").getByIndex("date", date))[0];
  if (checkin) {
    if (checkin.dolorGeneral !== undefined) {
      pushCard("pain", `<div class="day-stat-grid">${stat("Dolor general", `${checkin.dolorGeneral}/10`, "tone-pain", SCORE_SCALES.pain)}</div>`, { scales: [{ scale: SCORE_SCALES.pain }] });
    }
    if (checkin.digestiuGeneral !== undefined || checkin.inflor) {
      pushCard("digestive", `<div class="day-stat-grid">${stat("Malestar digestiu", `${checkin.digestiuGeneral ?? 0}/10`, "tone-digestive", SCORE_SCALES.digestive)}</div>${listChips([checkin.inflor && "Inflor"])} `, { scales: [{ scale: SCORE_SCALES.digestive }] });
    }
    if (checkin.sonQualitat !== undefined) {
      checkinSleepSummary = checkin.sonQualitat;
    }
    if (checkin.malDeCap) pushCard("headache", `${listChips(["Mal de cap indicat al check-in"])}`);
    if (checkin.vertigen) pushCard("vertigo", `${listChips(["Vertigen indicat al check-in"])}`);
    if (Number(checkin.energiaMental) > 0) legacyBrainFog = Number(checkin.energiaMental);

    if (checkin.energiaFisica !== undefined) checkinPhysicalFatigue = checkin.energiaFisica;
    checkinComment = checkin.comentari || "";
  }

  const pains = (await new Repository("pain_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (pains.length) {
    const items = pains.map((p, index) => {
      const zoneLabels = [...new Set((p.entries || []).flatMap(en => en.zonaLabels || []))];
      const types = [...new Set((p.entries || []).flatMap(en => en.tipus || []))];
      return `<div class="day-record-item">
        <div class="day-record-title"><strong>Registre ${index + 1}</strong><span>${escapeHtml(formatDateTime(p.timestamp))}</span><b>${Number(p.intensitat) || 0}/10</b></div>
        ${listChips(zoneLabels)}
        ${listChips(types, "is-types")}
        <div class="day-detail-list">
          ${detailRow("Empitjora", (p.empitjora || []).join(", "))}
          ${detailRow("Naturalesa", (p.naturalesaDolor || []).join(", "))}
          ${detailRow("Impacte en el son", (p.impacteSon || []).join(", "))}
        </div>
        ${note(p.comentari)}
      </div>`;
    }).join("");
    pushCard("pain", items, { count: pains.length, wide: true, scales: [{ scale: SCORE_SCALES.pain }] });
  }

  const movementLimitations = (await new Repository("movement_limitations").getAll()).filter(e => dateOnly(e.timestamp) === date);

  const headaches = (await new Repository("headache_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (headaches.length) {
    const body = headaches.map(h => `<div class="day-record-item compact">
      <div class="day-stat-grid">${stat("Intensitat", `${h.intensitat}/10`, "tone-headache", SCORE_SCALES.headache)}${stat("Durada", h.durada ? `${h.durada} h` : "")}</div>
      ${listChips(h.tipus, "is-types")}
      ${listChips(h.localitzacio)}
      <div class="day-detail-list">${detailRow("Desencadenants", (h.desencadenants || []).join(", "))}${detailRow("Medicació", h.medicacio)}</div>
      ${note(h.comentari)}
    </div>`).join("");
    pushCard("headache", body, { count: headaches.length, scales: [{ scale: SCORE_SCALES.headache }] });
  }

  const vertigos = (await new Repository("vertigo_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (vertigos.length || legacyBrainFog !== null) {
    const sensations = vertigos.map(v => {
      const label = v.tipus || "Sensació registrada";
      const intensity = Number.isFinite(Number(v.intensitat)) ? Number(v.intensitat) : null;
      return `<div class="day-record-item compact vertigo-sensation-item">
        <div class="day-record-title">
          <strong>${escapeHtml(label)}</strong>
          ${intensity !== null ? `<b>${intensity}/10</b>` : ""}
        </div>
        ${v.durada ? `<div class="day-detail-list">${detailRow("Durada", `${v.durada} min`)}</div>` : ""}
        ${listChips(v.situacio)}
        <div class="day-detail-list">${detailRow("Símptomes associats", (v.associats || []).join(", "))}</div>
        ${note(v.comentari)}
      </div>`;
    });

    if (legacyBrainFog !== null) {
      sensations.unshift(`<div class="day-record-item compact vertigo-sensation-item is-legacy">
        <div class="day-record-title">
          <strong>Boira mental</strong>
          <b>${legacyBrainFog}/10</b>
        </div>
        <p class="day-record-note"><span aria-hidden="true">↺</span>Dada recuperada d’un check-in anterior</p>
      </div>`);
    }

    pushCard("vertigo", sensations.join(""), {
      count: vertigos.length + (legacyBrainFog !== null ? 1 : 0),
      scales: [{ label: "Intensitat de la sensació", scale: SCORE_SCALES.vertigo }]
    });
  }

  const digestives = (await new Repository("digestive_events").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (digestives.length) {
    const body = digestives.map(d => {
      const fields = [["Inflor", d.inflor], ["Dolor abdominal", d.dolorAbdominal], ["Retortijons", d.retortijons], ["Gasos", d.gasos], ["Acidesa", d.acidesa], ["Nàusees", d.nausees]];
      const stats = fields.filter(([,v]) => Number(v) > 0).map(([l,v]) => stat(l, `${v}/10`, "tone-digestive", SCORE_SCALES.digestive)).join("");
      const flags = [d.llaguesBoca && "Llagues a la boca"].filter(Boolean);
      return `<div class="day-record-item compact">${stats ? `<div class="day-stat-grid">${stats}</div>` : `<p class="day-ok-state">Sense símptomes destacats</p>`}${listChips(flags)}${note(d.comentari)}</div>`;
    }).join("");
    pushCard("digestive", body, { count: digestives.length, scales: [{ scale: SCORE_SCALES.digestive }] });
  }

  const bowels = (await new Repository("bowel_movements").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (bowels.length) {
    const body = bowels.map(b => `<div class="day-record-item compact">
      <div class="day-stat-grid">${stat("Escala Bristol", b.bristol)}${stat("Color", b.color)}</div>
      ${listChips([b.urgencia && "Urgència", b.buidatgeIncomplet && "Buidatge incomplet", b.moc && "Moc", b.sang && "Sang"])}
      ${note(b.comentari)}
    </div>`).join("");
    pushCard("digestive", body, { count: bowels.length });
  }

  const sleep = (await new Repository("sleep_log").getByIndex("date", date))[0];
  if (sleep) {
    const sleepQuality = sleep.qualitat !== undefined ? sleep.qualitat : checkinSleepSummary;
    const stats = [
      sleepQuality !== null && sleepQuality !== undefined ? stat("Mal descans", `${sleepQuality}/10`, "tone-sleep", SCORE_SCALES.sleep) : "",
      stat("Despertars", sleep.numDespertars ?? 0),
      stat("Hores dormides", sleep.horesDormides || sleepDuration(sleep)),
      stat("Fatiga al matí", sleep.fatigaMati !== undefined ? `${sleep.fatigaMati}/10` : "", "", SCORE_SCALES.fatigue),
      checkinPhysicalFatigue !== null && checkinPhysicalFatigue !== undefined ? stat("Cansament físic", `${checkinPhysicalFatigue}/10`, "", SCORE_SCALES.energyPhysical) : ""
    ].join("");
    const flags = [
      sleep.llumEnces && "Llum encesa", sleep.anatLavabo && "Anar al lavabo", sleep.ronc && "Roncs",
      sleep.bruxisme && "Bruxisme", sleep.suorsNocturns && "Suors nocturns", sleep.camesInquietes && "Cames inquietes",
      sleep.caminarDormida && "Caminar dormida", sleep.encendreLlumsDormida && "Encendre llums dormida", sleep.visions && "Visions", sleep.crits && "Crits",
      ...(sleep.mocsMati || []), ...(sleep.factorsPrevis || [])
    ].filter(Boolean);
    const notes = [sleep.comentari, checkinComment].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
    pushCard("sleep", `<div class="day-stat-grid">${stats}</div><div class="day-detail-list">${detailRow("Horari", [sleep.horaAdormir || sleep.horaIntent, sleep.horaLlevar].filter(Boolean).join(" → "))}${detailRow("Motiu de despertar", sleep.motiuDespertar)}${detailRow("Com t'has llevat", sleep.comLlevat)}</div>${listChips(flags)}${notes.map(note).join("")}`, { scales: [{ label: "Mal descans", scale: SCORE_SCALES.sleep }, { label: "Fatiga al matí", scale: SCORE_SCALES.fatigue }, ...(checkinPhysicalFatigue !== null && checkinPhysicalFatigue !== undefined ? [{ label: "Cansament físic", scale: SCORE_SCALES.energyPhysical }] : [])] });
  } else if (checkinSleepSummary !== null || checkinPhysicalFatigue !== null) {
    const stats = [
      checkinSleepSummary !== null ? stat("Mal descans", `${checkinSleepSummary}/10`, "tone-sleep", SCORE_SCALES.sleep) : "",
      checkinPhysicalFatigue !== null ? stat("Cansament físic", `${checkinPhysicalFatigue}/10`, "", SCORE_SCALES.energyPhysical) : ""
    ].join("");
    const scales = [];
    if (checkinSleepSummary !== null) scales.push({ label: "Mal descans", scale: SCORE_SCALES.sleep });
    if (checkinPhysicalFatigue !== null) scales.push({ label: "Cansament físic", scale: SCORE_SCALES.energyPhysical });
    pushCard("sleep", `<div class="day-stat-grid">${stats}</div>${note(checkinComment)}`, { scales });
  }

  const exercises = (await new Repository("exercise_log").getAll()).filter(e => dateOnly(e.timestamp) === date);
  if (exercises.length) {
    const exerciseLabel = ex => ex.categoria === "caminar" || ex.tipus === "caminar"
      ? "Caminar"
      : ex.categoria === "gimnas_entrenador" || ex.tipus === "gimnas_entrenador"
        ? "Gimnàs / entrenador"
        : ex.categoria === "terapia" || ex.tipus === "terapia"
          ? "Fisioteràpia / teràpies"
          : (ex.tipus || "Activitat");
    const body = exercises.map(ex => `<div class="day-record-item compact"><strong>${escapeHtml(exerciseLabel(ex))}</strong><div class="day-stat-grid">${stat("Passos", ex.passos !== null && ex.passos !== undefined && ex.passos !== "" ? `${Number(ex.passos).toLocaleString("ca-ES")} passos` : "")}${stat("Durada", ex.durada ? `${ex.durada} min` : "")}${stat("Intensitat", ex.intensitat !== undefined ? `${ex.intensitat}/10` : "", "", SCORE_SCALES.exercise)}</div>${note(ex.comentari)}</div>`).join("");
    pushCard("exercise", body, { count: exercises.length, scales: [{ scale: SCORE_SCALES.exercise }] });
  }

  const cycle = (await new Repository("cycle_log").getByIndex("date", date))[0];
  if (cycle && (cycle.sagnat || cycle.simptomes?.length || cycle.ovulacio)) {
    const chips = [cycle.sagnat && `Regla: ${cycle.sagnat}`, cycle.ovulacio && "Ovulació", cycle.anticonceptius && "Anticonceptius", ...(cycle.simptomes || [])].filter(Boolean);
    pushCard("cycle", `${listChips(chips)}${note(cycle.comentari)}`);
  }

  // El resum per apartats és estrictament del dia seleccionat.
  // Per tant, un episodi de pell només hi apareix el dia en què es registra,
  // encara que tingui una data de finalització posterior o continuï actiu.
  const skins = (await new Repository("skin_episodes").getAll()).filter(sk =>
    sk.dataInici && dateOnly(sk.dataInici) === date
  );
  if (skins.length) {
    const body = skins.map(sk => {
      const entries = (sk.entries || []).flatMap(en => (en.tipus || []).map(type => `${en.zonaLabel}: ${type}`));
      return `<div class="day-record-item compact"><div class="day-stat-grid">${stat("Intensitat", sk.intensitat !== undefined ? `${sk.intensitat}/10` : "", "", SCORE_SCALES.skin)}${stat("Període", [sk.dataInici, sk.dataFi].filter(Boolean).join(" → "))}</div>${listChips(entries.length ? entries : ["Brot actiu"])}${note(sk.comentari)}</div>`;
    }).join("");
    pushCard("skin", body, { count: skins.length, scales: [{ scale: SCORE_SCALES.skin }] });
  }

  const meds = (await new Repository("medications").getAll()).filter(m => dateOnly(m.timestamp) === date);
  if (meds.length) {
    const body = meds.map(m => `<div class="day-record-item compact"><div class="day-record-title"><strong>${escapeHtml(m.nom || "Medicació")}</strong><span>${escapeHtml(formatDateTime(m.timestamp))}</span></div>${listChips([m.dosi, m.motiu])}${note(m.comentari)}</div>`).join("");
    pushCard("medication", body, { count: meds.length });
  }

  const painVisuals = pains.length ? `
    <section class="day-pain-section">
      <div class="dashboard-section-heading"><h3 class="day-section-title">Mapa del dolor</h3><span class="badge">${pains.length} ${pains.length === 1 ? "registre" : "registres"}</span></div>
      <div class="day-pain-parts">
        ${painGroupedRecordsHtml(pains, "body", movementLimitations)}
        ${painGroupedRecordsHtml(pains, "head", movementLimitations)}
      </div>
    </section>` : "";

  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="day-detail-heading">
      <div><span class="view-eyebrow">Resum diari</span><h2 class="card-title">${escapeHtml(formatDate(date))}</h2></div>
      <div class="day-detail-nav" aria-label="Canviar de dia">
        <button type="button" class="btn btn-ghost" data-day-nav="-1" aria-label="Dia anterior" title="Dia anterior">←</button>
        <button type="button" class="btn btn-ghost" data-day-nav="1" aria-label="Dia següent" title="Dia següent" ${date >= today ? "disabled" : ""}>→</button>
      </div>
    </div>
    ${painVisuals}
    <section class="day-modules-section">
      <h3 class="day-section-title">Resum per apartats</h3>
      <div class="day-modules-grid">${principalCardsHtml(cards)}</div>
    </section>
  `;
}

