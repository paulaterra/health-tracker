import { Repository } from "../../db/repository.js";
import { buildDailyMatrix, VARIABLE_META } from "../../engine/normalizer.js";
import { computeWellbeingByDay, averageWellbeing, wellbeingColor } from "../../engine/wellbeing.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "../../engine/correlation.js";
import { classifyConclusions } from "../../engine/conclusions.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml, recommendationsHtml } from "../../engine/intelligence-view.js";
import { escapeHtml, formatDate } from "../../utils/dom.js";
import { medicalSummaryData } from "../../engine/personal-insights.js";
import { dayDetailHtml } from "../dashboard/dashboard.js";
import { buildClinicalHypotheses, clinicalHypothesesHtml, loadHypothesisFollowups } from "../../engine/clinical-hypotheses.js?v=1.6.31";
import { bindHypothesisFollowups } from "../conclusions/conclusions.js?v=1.6.31";




const CLINICAL_AREAS = [
  {label:"Dolor corporal", keys:["dolor_intensitat_max","dolor_general","dolor_esquena_intensitat","dolor_darrere_cap_intensitat"]},
  {label:"Mal de cap", keys:["mal_de_cap_intensitat"], bool:"mal_de_cap_ocorregut"},
  {label:"Vertígens / boira mental", keys:["vertigen_intensitat","energia_mental"], bool:"vertigen_ocorregut"},
  {label:"Digestiu", keys:["digestiu_general","digestiu_inflor","digestiu_dolorAbdominal","digestiu_retortijons","digestiu_gasos"], bools:["digestiu_urgencia","digestiu_diarrea","digestiu_estrenyiment"]},
  {label:"Son", keys:["son_qualitat","son_fatiga_mati"]},
  {label:"Energia", keys:["energia_fisica"]},
  {label:"Pell", keys:[], bool:"pell_brot"},
];
function clinicalAreaStats(matrix, area){
  const dates=Object.keys(matrix).sort(); const vals=[]; let active=0;
  dates.forEach(date=>{ const d=matrix[date]||{}; const nums=area.keys.map(k=>Number(d[k])).filter(Number.isFinite); const v=nums.length?Math.max(...nums):null; const b=(area.bool&&d[area.bool])||(area.bools||[]).some(k=>d[k]); if(v!=null) vals.push(v); if((v!=null&&v>0)||b) active++; });
  return {active,total:dates.length,avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,max:vals.length?Math.max(...vals):null,series:dates.map(date=>{const d=matrix[date]||{};const nums=area.keys.map(k=>Number(d[k])).filter(Number.isFinite);return nums.length?Math.max(...nums):null;})};
}
function miniEvolutionSvg(series){
  const vals=series.map((v,i)=>v==null?null:[i,v]); const pts=vals.filter(Boolean); if(pts.length<2) return `<span style="color:var(--ink-faint);font-size:11px;">Encara no hi ha prou punts per mostrar evolució.</span>`;
  const w=250,h=48,p=5,n=Math.max(1,series.length-1); const path=pts.map(([i,v],j)=>`${j?'L':'M'}${(p+i/n*(w-2*p)).toFixed(1)},${(h-p-(Math.max(0,Math.min(10,v))/10)*(h-2*p)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" aria-label="Evolució temporal" style="width:100%;height:48px"><line x1="5" y1="43" x2="245" y2="43" stroke="var(--line)"/><path d="${path}" fill="none" stroke="var(--sage)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function clinicalOverviewHtml(matrix,start,end){
  const rows=CLINICAL_AREAS.map(a=>({a,s:clinicalAreaStats(matrix,a)})).filter(x=>x.s.active||x.s.avg!=null);
  return `<section class="card clinical-overview" style="margin-top:var(--sp-5);"><span class="view-eyebrow">Lectura ràpida per al professional</span><h2 class="card-title" style="font-size:var(--fs-xl);margin-top:6px;">Resum clínic del període</h2><p style="color:var(--ink-soft);font-size:var(--fs-sm);">${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))}. Resum descriptiu dels registres; no interpreta causes ni estableix diagnòstics.</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">${rows.map(({a,s})=>`<div style="border:1px solid var(--line);border-radius:12px;padding:12px;"><strong>${escapeHtml(a.label)}</strong><div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">${s.active} dies amb afectació${s.avg!=null?` · mitjana ${s.avg.toFixed(1)}/10 · màxim ${s.max}/10`:''}</div>${miniEvolutionSvg(s.series)}</div>`).join('')}</div></section>`;
}
function flareReviewHtml(intel,matrix){
  const flares=(intel?.flares||[]).slice(0,8); if(!flares.length) return `<section class="card" style="margin-top:var(--sp-5);"><h2 class="card-title">Períodes d’empitjorament</h2><p class="ledger-empty">No s’ha detectat cap període multisimptomàtic prou clar en aquestes dates.</p></section>`;
  const allDates=Object.keys(matrix).sort();
  const lines=flares.map(f=>{ const sd=new Date(f.start+'T00:00:00'); const prior=[]; for(let i=3;i>=1;i--){const d=new Date(sd);d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10);if(matrix[iso]) prior.push(iso)}; const observations=[]; const checks=[['son_qualitat','mal descans'],['son_fatiga_mati','fatiga matinal'],['energia_fisica','cansament físic'],['digestiu_general','molèsties digestives'],['dolor_intensitat_max','dolor corporal']]; checks.forEach(([k,l])=>{if(prior.some(d=>Number(matrix[d]?.[k])>=6)) observations.push(l)}); return `<div class="event-row"><div class="event-row-top"><strong>${escapeHtml(formatDate(f.start))}${f.end!==f.start?` — ${escapeHtml(formatDate(f.end))}`:''}</strong><span class="badge">${f.days} dies</span></div><div class="event-tags">Fins a ${f.maxDomains} àrees afectades alhora${f.categories?.length?` · ${f.categories.slice(0,5).map(c=>escapeHtml(c.label)).join(', ')}`:''}</div><div class="event-comment"><strong>1–3 dies previs:</strong> ${observations.length?`hi consten ${observations.join(', ')}.`:'no hi ha cap senyal destacable amb les dades registrades.'} <span style="color:var(--ink-faint)">Coincidència temporal; no implica causalitat.</span></div></div>`; });
  return `<section class="card" style="margin-top:var(--sp-5);"><h2 class="card-title">Períodes d’empitjorament i dies previs</h2><p style="font-size:var(--fs-xs);color:var(--ink-faint);">Agrupa dies consecutius amb diverses àrees alterades i resumeix què constava als 1–3 dies anteriors.</p><div class="event-list">${lines.join('')}</div></section>`;
}
async function painZoneSummaryHtml(start,end){
  const pains=(await new Repository("pain_events").getAll()).filter(p=>{const d=(p.timestamp||'').slice(0,10);return d>=start&&d<=end;}); const counts=new Map();
  pains.forEach(p=>(p.entries||[]).forEach(e=>(e.zonaLabels||[e.zoneLabel,e.zone]).filter(Boolean).forEach(z=>counts.set(z,(counts.get(z)||0)+1)))); const zones=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12); if(!zones.length) return '';
  const max=zones[0][1]; return `<section class="card" style="margin-top:var(--sp-5);"><h2 class="card-title">Distribució del dolor corporal</h2><p style="font-size:var(--fs-xs);color:var(--ink-faint);">Zones que apareixen més vegades als registres del període. Serveix com a mapa resum de localització; no representa una diagnosi anatòmica.</p>${zones.map(([z,n])=>`<div style="display:grid;grid-template-columns:minmax(110px,1fr) 2fr 34px;gap:8px;align-items:center;margin:6px 0;font-size:12px;"><span>${escapeHtml(z)}</span><div style="height:9px;background:var(--paper-alt);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${n/max*100}%;background:var(--clay);"></i></div><strong>${n}×</strong></div>`).join('')}</section>`;
}

const REPORT_SCORE_SCALES = [
  ["Dolor corporal", "sense dolor", "molt dolor"],
  ["Mal de cap", "sense dolor", "molt intens"],
  ["Vertígens i boira mental", "cap símptoma", "molt intens"],
  ["Digestiu", "cap molèstia", "molt intens"],
  ["Mal descans", "descans reparador", "mal descans"],
  ["Cansament físic", "molta energia", "esgotament"],
  ["Pell", "sense molèsties", "molt intens"],
];

function scoreReferencesHtml({ compact = false } = {}) {
  return `<div class="card ${compact ? "medical-scale-reference" : ""}" style="margin-top: var(--sp-5);">
    <h2 class="card-title">Referència de les escales 0–10</h2>
    <div class="day-score-guide is-multiple" style="margin:0;">
      ${REPORT_SCORE_SCALES.map(([label, low, high]) => `<div class="day-score-guide-row">
        <span class="day-score-guide-label">${escapeHtml(label)}</span>
        <div class="day-score-guide-scale" aria-label="Escala ${escapeHtml(label)}: 0 ${escapeHtml(low)}, 10 ${escapeHtml(high)}">
          <span><b>0</b> ${escapeHtml(low)}</span><i aria-hidden="true"></i><span><b>10</b> ${escapeHtml(high)}</span>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
}


const QR_PRINT_DATA_URL = "data:image/png;base64,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";

const MEDICAL_REPORT_CATEGORIES = [
  { key: "pain", label: "Dolor corporal" },
  { key: "headache", label: "Mal de cap" },
  { key: "vertigo", label: "Vertígens i boira mental" },
  { key: "digestive", label: "Digestiu" },
  { key: "sleep", label: "Son" },
  { key: "exercise", label: "Activitat física" },
  { key: "cycle", label: "Cicle menstrual" },
  { key: "skin", label: "Pell" },
  { key: "medication", label: "Medicació" },
];

const REPORT_CALENDAR_CATEGORIES = [
  { key: "pain", label: "Dolor", matches: key => key.startsWith("dolor_") },
  { key: "digestive", label: "Digestiu", matches: key => key.startsWith("digestiu_") },
  { key: "headache", label: "Mal de cap", matches: key => key.startsWith("mal_de_cap_") },
  { key: "vertigo", label: "Vertígens / boira mental", matches: key => key.startsWith("vertigen_") || key === "energia_mental" },
  { key: "sleep", label: "Son", matches: key => key.startsWith("son_") },
  { key: "energy", label: "Energia", matches: key => key.startsWith("energia_") && key !== "energia_mental" },
  { key: "skin", label: "Pell", matches: key => key.startsWith("pell_") },
];

function normalizedCalendarValue(key, value) {
  const meta = VARIABLE_META[key];
  if (!meta?.valence) return null;
  if (meta.type === "boolean") return value ? 0 : 100;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const bounded = Math.max(0, Math.min(10, numeric));
  return Math.round((meta.valence === "positive" ? bounded / 10 : 1 - bounded / 10) * 100);
}

function categoryScoreForDay(day, category) {
  const values = Object.entries(day || {})
    .filter(([key]) => category.matches(key))
    .map(([key, value]) => normalizedCalendarValue(key, value))
    .filter(value => value != null);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function reportCalendarColor(score) {
  if (score == null) return "var(--paper-alt)";
  if (score >= 70) return "var(--sage)";
  if (score >= 45) return "var(--amber)";
  return "var(--clay)";
}

function calendarDatesBetween(start, end) {
  const result = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function monthKeysBetween(start, end) {
  const keys = [];
  const seen = new Set();
  const [startYear, startMonth] = start.slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split("-").map(Number);
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

function reportMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ca-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function singleReportCalendarHtml(title, start, end, scoreByDate, calendarId) {
  const monthKeys = monthKeysBetween(start, end);
  const panels = monthKeys.map((monthKey, index) => {
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Sempre dibuixem el mes sencer. Els dies fora del període seleccionat
    // o sense cap registre continuen visibles, però en gris.
    const dates = Array.from({ length: daysInMonth }, (_, i) =>
      `${monthKey}-${String(i + 1).padStart(2, "0")}`
    );
    const first = new Date(year, month - 1, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const cells = [...Array(mondayOffset).fill(null), ...dates];
    while (cells.length % 7) cells.push(null);

    const dataDays = dates.filter(date => date >= start && date <= end && scoreByDate[date] != null).length;
    return `<div class="report-calendar-month-panel${index === monthKeys.length - 1 ? " is-active" : ""}" data-report-month-index="${index}">
      <div class="report-calendar-title report-calendar-month-meta"><strong style="text-transform:capitalize;">${escapeHtml(reportMonthLabel(monthKey))}</strong><span>${dataDays} dies amb dades</span></div>
      <div class="report-calendar-weekdays"><span>Dl</span><span>Dt</span><span>Dc</span><span>Dj</span><span>Dv</span><span>Ds</span><span>Dg</span></div>
      <div class="report-calendar-grid">${cells.map(date => {
        if (!date) return `<span class="report-calendar-cell is-empty"></span>`;
        const inSelectedPeriod = date >= start && date <= end;
        const score = inSelectedPeriod ? scoreByDate[date] : null;
        const day = Number(date.slice(-2));
        return `<span class="report-calendar-cell ${score != null ? "has-score" : ""}" style="--calendar-color:${reportCalendarColor(score)}" title="${escapeHtml(formatDate(date))}${score != null ? ` · ${score}/100` : " · sense dades"}">${day}</span>`;
      }).join("")}</div>
    </div>`;
  }).join("");

  const nav = monthKeys.length > 1 ? `<div class="report-calendar-nav no-print" aria-label="Canviar de mes">
    <button type="button" class="btn btn-ghost" data-report-calendar-nav="-1" aria-label="Mes anterior">←</button>
    <button type="button" class="btn btn-ghost" data-report-calendar-nav="1" aria-label="Mes següent" disabled>→</button>
  </div>` : "";

  return `<div class="report-calendar-card" data-report-calendar="${escapeHtml(calendarId)}" data-report-active-index="${Math.max(0, monthKeys.length - 1)}">
    <div class="report-calendar-title"><strong>${escapeHtml(title)}</strong>${nav}</div>
    ${panels}
  </div>`;
}

function reportCalendarsHtml(matrix, byDay, start, end, { categoryKeys = null } = {}) {
  const dates = calendarDatesBetween(start, end);
  const generalScores = Object.fromEntries(dates.map(date => [date, byDay[date] ?? null]));
  const categories = REPORT_CALENDAR_CATEGORIES.filter(category => !categoryKeys || categoryKeys.includes(category.key));
  const cards = [singleReportCalendarHtml("Benestar general", start, end, generalScores, "general")];
  for (const category of categories) {
    const scores = {};
    for (const date of dates) scores[date] = categoryScoreForDay(matrix[date], category);
    cards.push(singleReportCalendarHtml(category.label, start, end, scores, category.key));
  }
  return `<section class="card report-calendar-section" style="margin-top:var(--sp-5);">
    <h2 class="card-title">Calendaris de benestar</h2>
    <p style="margin:0;color:var(--ink-soft);font-size:var(--fs-sm);">Vista general i per símptoma. Els colors resumeixen la intensitat registrada de cada dia dins de cada àrea.</p>
    <div class="report-calendar-legend"><span class="good"><i></i>Verd · dia millor</span><span class="mid"><i></i>Groc · intermedi</span><span class="bad"><i></i>Vermell · dia pitjor</span><span class="nodata"><i></i>Gris · sense dades</span></div>
    <div class="report-calendars-grid">${cards.join("")}</div>
  </section>`;
}

function expandAllReportCalendarsForPrint(root) {
  if (!root) return;
  root.querySelectorAll("[data-report-calendar]").forEach(card => {
    const panels = [...card.querySelectorAll("[data-report-month-index]")];
    panels.forEach(panel => {
      panel.classList.add("is-active");
      panel.style.setProperty("display", "block", "important");
      panel.style.setProperty("visibility", "visible", "important");
      panel.style.setProperty("height", "auto", "important");
      panel.style.setProperty("max-height", "none", "important");
      panel.style.setProperty("overflow", "visible", "important");
    });
    card.style.setProperty("overflow", "visible", "important");
    card.style.setProperty("height", "auto", "important");
    card.style.setProperty("max-height", "none", "important");
  });
}

function wireReportCalendarNavigation(root) {
  root.querySelectorAll("[data-report-calendar]").forEach(card => {
    const panels = [...card.querySelectorAll("[data-report-month-index]")];
    if (panels.length < 2) return;
    const update = nextIndex => {
      const index = Math.max(0, Math.min(panels.length - 1, nextIndex));
      card.dataset.reportActiveIndex = String(index);
      panels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
      const prev = card.querySelector('[data-report-calendar-nav="-1"]');
      const next = card.querySelector('[data-report-calendar-nav="1"]');
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === panels.length - 1;
    };
    card.querySelectorAll("[data-report-calendar-nav]").forEach(button => {
      button.addEventListener("click", () => update(Number(card.dataset.reportActiveIndex || panels.length - 1) + Number(button.dataset.reportCalendarNav)));
    });
    update(Number(card.dataset.reportActiveIndex || panels.length - 1));
  });
}

function selectedMedicalCategories(container) {
  return [...container.querySelectorAll('input[name="medical-category"]:checked')].map(input => input.value);
}

function filterMedicalDay(day, selected) {
  const allowed = new Set(selected);
  day.querySelectorAll('.day-module-card').forEach(card => {
    if (!allowed.has(card.dataset.moduleType)) card.remove();
  });
  if (!allowed.has('pain')) day.querySelector('.day-pain-section')?.remove();

  const hasPain = allowed.has('pain') && !!day.querySelector('.day-pain-record');
  const hasSelectedModuleData = [...day.querySelectorAll('.day-module-card')].some(card => !card.querySelector('.day-ok-state'));
  const modulesSection = day.querySelector('.day-modules-section');
  if (modulesSection && !modulesSection.querySelector('.day-module-card')) modulesSection.remove();
  return hasPain || hasSelectedModuleData;
}

const ALL_STORES = [
  "daily_checkin", "pain_events", "movement_limitations", "headache_events", "vertigo_events", "digestive_events",
  "bowel_movements", "sleep_log", "exercise_log", "cycle_log", "skin_episodes", "medications",
];

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function todayISO() { return localISODate(new Date()); }
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISODate(d);
}

export async function renderReports(container) {
  const defaultStart = daysAgoISO(30);
  const defaultEnd = todayISO();

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Informes</h1>
      <p class="view-sub">Informe complet del període: benestar, símptomes, tots els patrons detectats (diaris, setmanals i mensuals), ritmes, tendències i conclusions. Es pot imprimir o desar com a PDF.</p>
    </div>

    <div class="card report-medical-export no-print" style="margin-bottom:var(--sp-5);">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-4);align-items:flex-start;flex-wrap:wrap;">
        <div>
          <span class="view-eyebrow">Informe per a visites mèdiques</span>
          <h2 class="card-title" style="font-size:var(--fs-xl);margin-top:var(--sp-1);">Informe mèdic complet</h2>
          <p style="margin:0;color:var(--ink-soft);max-width:760px;">Genera un document A4 amb els registres reals del període. Cada dia comença en una pàgina nova i conserva els mateixos mapes, colors, icones i targetes del Dashboard.</p>
        </div>
        <span class="badge">A4 · multipàgina</span>
      </div>
      <div class="medical-category-picker" style="margin-top:var(--sp-5);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <div><span class="field-label">Què vols incloure?</span><div style="font-size:12px;color:var(--ink-faint);margin-top:3px;">Pots generar l’informe complet o només les categories que necessitis.</div></div>
          <div style="display:flex;gap:8px;"><button class="btn btn-ghost" type="button" id="medical-select-all">Selecciona-ho tot</button><button class="btn btn-ghost" type="button" id="medical-clear-all">Neteja</button></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${MEDICAL_REPORT_CATEGORIES.map(category => `<label class="day-chip" style="cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:8px 11px;"><input type="checkbox" name="medical-category" value="${category.key}" checked> ${escapeHtml(category.label)}</label>`).join("")}
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:var(--sp-4);flex-wrap:wrap;margin-top:var(--sp-5);">
        <div class="field" style="margin:0;">
          <label class="field-label" for="medicalStartDate">Des de</label>
          <input type="date" id="medicalStartDate" value="${defaultStart}">
        </div>
        <div class="field" style="margin:0;">
          <label class="field-label" for="medicalEndDate">Fins a</label>
          <input type="date" id="medicalEndDate" value="${defaultEnd}">
        </div>
        <button class="btn btn-primary" id="medical-report-btn">Genera PDF / Imprimeix</button>
      </div>
      <p style="margin:var(--sp-3) 0 0;color:var(--ink-faint);font-size:var(--fs-xs);">Safari obrirà el diàleg d’impressió a la mateixa pestanya. Tria «PDF → Desar com a PDF». No s’utilitzen finestres emergents ni captures amb html2canvas.</p>
    </div>

    <div class="card no-print" style="display:flex; align-items:flex-end; gap: var(--sp-4); flex-wrap: wrap;">
      <div class="field" style="margin:0;">
        <label class="field-label" for="startDate">Des de</label>
        <input type="date" id="startDate" value="${defaultStart}">
      </div>
      <div class="field" style="margin:0;">
        <label class="field-label" for="endDate">Fins a</label>
        <input type="date" id="endDate" value="${defaultEnd}">
      </div>
      <button class="btn btn-primary" id="generate-btn">Genera l'informe</button>
      <button class="btn btn-ghost" id="summary-pdf-btn" style="display:none;">⬇ PDF resum mèdic</button>
      <button class="btn btn-ghost" id="pdf-btn" style="display:none;">⬇ PDF complet</button>
      <button class="btn btn-ghost" id="print-btn" style="display:none;">🖨 Imprimeix (alternativa)</button>
      <button class="btn btn-ghost" id="export-json-btn">⬇ Exporta totes les dades (JSON)</button>
    </div>

    <div id="report-output" style="margin-top: var(--sp-6);"></div>
  `;

  container.querySelector("#generate-btn").addEventListener("click", async () => {
    const start = container.querySelector("#startDate").value;
    const end = container.querySelector("#endDate").value;
    if (!start || !end || start > end) { alert("Comprova les dates: la data d'inici ha de ser abans que la de final."); return; }
    try {
      await generateReport(container, start, end);
      container.querySelector("#summary-pdf-btn").style.display = "inline-block";
      container.querySelector("#pdf-btn").style.display = "inline-block";
      container.querySelector("#print-btn").style.display = "inline-block";
    } catch (error) {
      console.error("Error generant l'informe", error);
      container.querySelector("#report-output").innerHTML = `<div class="card" style="border-left:3px solid var(--clay);"><h2 class="card-title">No s'ha pogut generar l'informe</h2><p style="margin:0;color:var(--ink-soft);">${escapeHtml(error?.message || "Error desconegut")}</p></div>`;
    }
  });

  container.querySelector("#medical-select-all").addEventListener("click", () => container.querySelectorAll('input[name="medical-category"]').forEach(input => input.checked = true));
  container.querySelector("#medical-clear-all").addEventListener("click", () => container.querySelectorAll('input[name="medical-category"]').forEach(input => input.checked = false));

  container.querySelector("#medical-report-btn").addEventListener("click", async () => {
    const start = container.querySelector("#medicalStartDate").value;
    const end = container.querySelector("#medicalEndDate").value;
    if (!start || !end || start > end) {
      alert("Comprova les dates: la data d’inici ha de ser abans que la de final.");
      return;
    }
    const categories = selectedMedicalCategories(container);
    if (!categories.length) {
      alert("Selecciona com a mínim una categoria per generar l’informe.");
      return;
    }
    await openMedicalPrintView(container, start, end, categories);
  });

  // Manté sincronitzats els dos selectors de dates de la pantalla d’Informes.
  const syncDate = (sourceId, targetId) => {
    const source = container.querySelector(sourceId);
    const target = container.querySelector(targetId);
    source?.addEventListener("change", () => { if (target) target.value = source.value; });
  };
  syncDate("#medicalStartDate", "#startDate");
  syncDate("#medicalEndDate", "#endDate");
  syncDate("#startDate", "#medicalStartDate");
  syncDate("#endDate", "#medicalEndDate");

  container.querySelector("#print-btn").addEventListener("click", () => window.print());
  container.querySelector("#summary-pdf-btn").addEventListener("click", () => downloadPdf(container, "#medical-summary", "resum-medic-paula-tracker", "#summary-pdf-btn"));
  container.querySelector("#pdf-btn").addEventListener("click", () => downloadPdf(container, "#report-output", "informe-complet-paula-tracker", "#pdf-btn"));
  container.querySelector("#export-json-btn").addEventListener("click", exportAllDataAsJson);

  try {
    await generateReport(container, defaultStart, defaultEnd);
    container.querySelector("#summary-pdf-btn").style.display = "inline-block";
    container.querySelector("#pdf-btn").style.display = "inline-block";
    container.querySelector("#print-btn").style.display = "inline-block";
  } catch (error) {
    console.error("Error generant l'informe inicial", error);
    container.querySelector("#report-output").innerHTML = `<div class="card" style="border-left:3px solid var(--clay);"><h2 class="card-title">No s'ha pogut generar l'informe</h2><p style="margin:0;color:var(--ink-soft);">${escapeHtml(error?.message || "Error desconegut")}</p></div>`;
  }
}


function ensureMedicalPrintStyles() {
  if (document.querySelector("#medical-print-styles")) return;
  const style = document.createElement("style");
  style.id = "medical-print-styles";
  style.textContent = `
    .medical-print-shell{position:fixed;inset:0;z-index:99999;background:#eceee8;overflow:auto;padding:24px;}
    .medical-print-toolbar{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:210mm;margin:0 auto 18px;padding:12px 16px;background:#fff;border:1px solid #d6dacd;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.08)}
    .medical-print-pages{width:210mm;margin:0 auto;}
    .medical-print-cover,.medical-print-day-start,.medical-print-analysis{box-sizing:border-box;width:210mm;background:#fff;padding:14mm 12mm;border:1px solid #d9ddd2;}
    .medical-print-cover{min-height:297mm;display:flex;flex-direction:column;justify-content:space-between;}
    .medical-print-cover h1{font-size:34px;line-height:1.05;margin:14px 0;max-width:150mm;}
    .medical-print-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-width:125mm;}
    .medical-print-meta>div{padding:16px;border:1px solid #d9ddd2;border-radius:12px;background:#f6f7f3;}
    .medical-access-card{display:grid;grid-template-columns:1fr 34mm;gap:14px;align-items:center;max-width:150mm;padding:16px;border:1px solid #d9ddd2;border-radius:14px;background:#f6f7f3;}
    .medical-access-card img{display:block;width:32mm;height:32mm;background:#fff;border-radius:8px;}
    .medical-access-url{font-size:13px;line-height:1.35;word-break:break-all;color:#315d42;font-weight:700;}
    .medical-access-copy{margin:8px 0 0;font-size:12px;line-height:1.45;color:#535851;}
    .medical-print-day-start{min-height:297mm;margin-top:0;}
    .medical-print-day-start .day-detail-heading{margin-bottom:16px;}
    .medical-print-day-start .day-pain-records{display:grid;grid-template-columns:1fr;gap:12px;align-items:start;}
    .medical-print-day-start .day-pain-record{box-sizing:border-box;width:100%;height:auto!important;min-height:0!important;}
    .medical-print-day-start .medical-pain-record-layout{display:grid;grid-template-columns:minmax(170px,38%) minmax(0,1fr);gap:12px;align-items:start;}
    .medical-print-day-start .medical-pain-record-visual{min-width:0;display:flex;align-items:flex-start;justify-content:center;}
    .medical-print-day-start .medical-pain-record-details{display:grid;gap:6px;min-width:0;align-content:start;font-size:11px;line-height:1.28;}
    .medical-print-day-start .medical-pain-record-details .pain-detail-label{font-size:10px!important;line-height:1.15!important;}
    .medical-print-day-start .medical-pain-record-details .day-chip{font-size:10px!important;line-height:1.1!important;padding:3px 7px!important;}
    .medical-print-day-start .medical-pain-record-details .pain-detail-group,.medical-print-day-start .medical-pain-record-details .event-row{padding:8px 10px!important;}
    .medical-print-day-start .medical-pain-record-details>.pain-drawing-legend{margin-top:0;}
    .medical-print-day-start .dashboard-bodymap-pair{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
    .medical-print-day-start .dashboard-bodymap svg{max-height:220px;width:100%;}
    .medical-print-day-start .day-modules-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;}
    .medical-print-day-start .day-module-card{box-sizing:border-box;flex:0 0 calc(50% - 6px);width:calc(50% - 6px);height:auto!important;min-height:0!important;align-self:flex-start;}
    .medical-print-day-start .day-module-card.is-wide{flex-basis:100%;width:100%;}
    .medical-print-analysis{min-height:297mm;}
    @media print{
      @page{size:A4 portrait;margin:10mm;}
      html,body{background:#fff!important;margin:0!important;padding:0!important;}
      body>*:not(.medical-print-shell){display:none!important;}
      .medical-print-shell{position:static!important;inset:auto!important;overflow:visible!important;padding:0!important;background:#fff!important;}
      .medical-print-toolbar{display:none!important;}
      .medical-print-pages{width:auto!important;margin:0!important;}
      .medical-print-cover,.medical-print-day-start,.medical-print-analysis{box-sizing:border-box!important;border:0!important;width:auto!important;padding:0!important;margin:0!important;}
      .medical-print-cover{height:277mm!important;min-height:277mm!important;break-after:page;page-break-after:always;}
      .medical-print-day-start{min-height:0!important;break-before:page;page-break-before:always;break-after:auto!important;page-break-after:auto!important;}
      .medical-print-analysis{min-height:0!important;break-before:page;page-break-before:always;break-after:auto;page-break-after:auto;}
      .medical-print-day-start .day-pain-section,.medical-print-day-start .day-modules-section{margin-top:5mm!important;}
      .medical-print-day-start .day-pain-parts{gap:4mm!important;}
      .medical-print-day-start .day-pain-part{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;min-height:0!important;overflow:visible!important;}
      .medical-print-day-start .day-pain-part-heading{margin:0 0 2.5mm!important;padding-top:1mm!important;break-after:avoid-page!important;page-break-after:avoid!important;}
      .medical-print-day-start .day-pain-part.is-single-record{break-inside:avoid-page!important;page-break-inside:avoid!important;}
      .medical-print-day-start .day-pain-records{display:block!important;}
      .medical-print-day-start .day-modules-grid{display:block!important;font-size:0!important;}
      .medical-print-day-start .day-pain-record{display:table!important;table-layout:fixed!important;width:100%!important;height:auto!important;min-height:0!important;margin:0 0 2.5mm!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-column-break-inside:avoid!important;overflow:visible!important;}
      .medical-print-day-start .day-module-card{display:inline-block!important;vertical-align:top!important;box-sizing:border-box!important;width:calc(50% - 2mm)!important;height:auto!important;min-height:0!important;margin:0 4mm 4mm 0!important;font-size:initial!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-column-break-inside:avoid!important;overflow:visible!important;}
      .medical-print-day-start .day-module-card:nth-child(even){margin-right:0!important;}
      .medical-print-day-start .medical-pain-record-layout{display:grid!important;grid-template-columns:55mm minmax(0,1fr)!important;gap:2.5mm!important;align-items:start!important;}
      .medical-print-day-start .medical-pain-record-visual{min-width:0!important;}
      .medical-print-day-start .medical-pain-record-details{display:grid!important;gap:2.5mm!important;min-width:0!important;align-content:start!important;}
      .medical-print-day-start .dashboard-bodymap-pair{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:2mm!important;}
      .medical-print-day-start .dashboard-bodymap svg{max-height:52mm!important;width:100%!important;}
      .medical-print-day-start .day-module-card.is-wide{display:block!important;width:100%!important;margin-right:0!important;}
      .medical-print-day-start .dashboard-bodymap,
      .medical-print-day-start .dashboard-bodymap-pair,
      .medical-print-day-start .movement-limitations-summary,
      .medical-print-day-start .pain-detail-group,
      .medical-print-day-start .event-row,
      .medical-print-analysis .card{break-inside:avoid-page!important;page-break-inside:avoid!important;}
      .medical-print-day-start .dashboard-bodymap .bodymap-detailed{max-height:52mm!important;}
      .medical-print-day-start .day-pain-record{font-size:10.5px!important;line-height:1.25!important;}
      .medical-print-day-start .day-pain-record-head{margin-bottom:2mm!important;}
      .medical-print-day-start .pain-detail-group,.medical-print-day-start .event-row{padding:1.8mm 2.2mm!important;}
      .medical-print-day-start .medical-pain-record-details{gap:1.8mm!important;}
      .medical-print-day-start .day-score-guide{font-size:10px!important;}
      .medical-print-day-start .pain-detail-label{font-size:9.5px!important;line-height:1.1!important;}
      .medical-print-day-start .day-chip{font-size:9.5px!important;line-height:1.05!important;padding:1mm 1.8mm!important;}
      .medical-print-day-start .day-score-guide.is-multiple{grid-template-columns:1fr!important;gap:1.5mm!important;}
      .medical-print-day-start .day-score-guide-row{display:grid!important;grid-template-columns:31mm minmax(0,1fr)!important;gap:2mm!important;align-items:center!important;}
      .medical-print-day-start .day-score-guide-label{margin:0!important;font-size:9.5px!important;}
      .medical-print-day-start .day-score-guide-scale{grid-template-columns:minmax(0,1fr) 24mm minmax(0,1fr)!important;gap:1.5mm!important;font-size:9px!important;line-height:1.08!important;}
      .medical-print-day-start .day-score-guide-scale span{white-space:normal!important;}
      .medical-print-day-start .day-score-guide-scale span:first-child{text-align:left!important;}
      .medical-print-day-start .day-score-guide-scale span:last-child{text-align:right!important;justify-self:stretch!important;}
      .medical-print-day-start .day-score-guide-scale b{font-size:9.5px!important;}
      .medical-print-day-start .day-score-guide-row{break-inside:avoid!important;}
      .medical-print-calendars .report-calendar-month-panel{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;overflow:visible!important;margin-top:5mm!important;}
      .medical-print-calendars .report-calendar-month-panel:first-of-type{margin-top:0!important;}
      .medical-print-calendars .report-calendar-card{height:auto!important;max-height:none!important;overflow:visible!important;}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    }
  `;
  document.head.appendChild(style);
}


function optimizeMedicalPainLayout(day) {
  day.querySelectorAll(".day-pain-part").forEach((part) => {
    const records = part.querySelectorAll(":scope .day-pain-record");
    part.classList.toggle("is-single-record", records.length === 1);
  });

  day.querySelectorAll(".day-pain-record").forEach((record) => {
    if (record.querySelector(":scope > .medical-pain-record-layout")) return;

    const head = record.querySelector(":scope > .day-pain-record-head");
    const map = record.querySelector(":scope > .dashboard-bodymap-pair, :scope > .dashboard-bodymap");
    if (!map) return;

    const layout = document.createElement("div");
    layout.className = "medical-pain-record-layout";

    const visual = document.createElement("div");
    visual.className = "medical-pain-record-visual";
    visual.appendChild(map);

    const details = document.createElement("div");
    details.className = "medical-pain-record-details";
    [...record.children].forEach((child) => {
      if (child !== head && child !== layout) details.appendChild(child);
    });

    layout.append(visual, details);
    record.appendChild(layout);
  });
}


async function openMedicalPrintView(container, start, end, selectedCategories = MEDICAL_REPORT_CATEGORIES.map(category => category.key)) {
  const btn = container.querySelector("#medical-report-btn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparant l’informe…";
  try {
    const matrix = await buildDailyMatrix();
    const dates = Object.keys(matrix).filter(date => date >= start && date <= end).sort();
    if (!dates.length) {
      alert("No hi ha registres dins del període seleccionat.");
      return;
    }

    const intel = await generateIntelligence({ start, end });
    const clinicalHypotheses = buildClinicalHypotheses(Object.fromEntries(dates.map(d => [d, matrix[d]])));
    const hypothesisFollowups = await loadHypothesisFollowups();
    ensureMedicalPrintStyles();
    document.querySelector(".medical-print-shell")?.remove();

    const shell = document.createElement("div");
    shell.className = "medical-print-shell";
    shell.innerHTML = `<div class="medical-print-toolbar no-print">
      <div><strong>Informe mèdic</strong><div style="font-size:12px;color:#6f746c;">${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))} · ${dates.length} dies amb registres</div></div>
      <div style="display:flex;gap:8px;"><button class="btn btn-ghost" data-close-medical-report>Tanca</button><button class="btn btn-primary" data-print-medical-report>Imprimeix / Desa PDF</button></div>
    </div><main class="medical-print-pages"></main>`;
    document.body.appendChild(shell);
    const pages = shell.querySelector(".medical-print-pages");

    const cover = document.createElement("section");
    cover.className = "medical-print-cover";
    cover.innerHTML = `<div><span class="view-eyebrow">Paula Tracker · Informe mèdic</span><h1>Informe de seguiment de salut</h1><p style="font-size:18px;color:var(--ink-soft);">${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))}</p></div>
      <div style="margin:10px 0 18px;"><span style="font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;">Categories incloses</span><div style="margin-top:6px;font-weight:650;">${escapeHtml(MEDICAL_REPORT_CATEGORIES.filter(category => selectedCategories.includes(category.key)).map(category => category.label).join(" · "))}</div></div>
      <div class="medical-print-meta"><div><span>Dies amb registres</span><strong style="display:block;font-size:24px;">${dates.length}</strong></div><div><span>Generat el</span><strong style="display:block;font-size:24px;">${escapeHtml(formatDate(todayISO()))}</strong></div></div>
      <div class="medical-access-card">
        <div>
          <div class="view-eyebrow" style="margin-bottom:6px;">Accés per a professionals</div>
          <div class="medical-access-url">https://paulaterra.github.io/health-tracker/</div>
          <p class="medical-access-copy">Escaneja el codi QR o entra a l’adreça anterior.<br><strong>Contrasenya:</strong> paulatrackview</p>
        </div>
        <img src="${QR_PRINT_DATA_URL}" alt="Codi QR d’accés a Paula Tracker">
      </div>
      <p style="font-size:11px;color:var(--ink-faint);">Document generat a partir dels registres personals de Paula Tracker. No substitueix una valoració mèdica.</p>`;
    pages.appendChild(cover);

    const overviewPage = document.createElement("section");
    overviewPage.className = "medical-print-analysis";
    overviewPage.innerHTML = `<span class="view-eyebrow">Lectura ràpida</span><h2 style="font-size:28px;margin:8px 0 10px;">Resum clínic i evolució</h2>${clinicalOverviewHtml(matrix, start, end)}${flareReviewHtml(intel, matrix)}${await painZoneSummaryHtml(start, end)}`;
    pages.appendChild(overviewPage);

    const calendarPage = document.createElement("section");
    calendarPage.className = "medical-print-analysis medical-print-calendars";
    const byDay = computeWellbeingByDay(matrix);
    const selectedCalendarKeys = selectedCategories.filter(key => ["pain", "headache", "vertigo", "digestive", "sleep", "skin"].includes(key));
    calendarPage.innerHTML = `<span class="view-eyebrow">Vista del període</span><h2 style="font-size:28px;margin:8px 0 10px;">Calendaris de benestar</h2>${reportCalendarsHtml(matrix, byDay, start, end, { categoryKeys: selectedCalendarKeys })}`;
    expandAllReportCalendarsForPrint(calendarPage);
    pages.appendChild(calendarPage);

    let includedDays = 0;
    for (const date of dates) {
      const day = document.createElement("section");
      day.className = "medical-print-day-start";
      day.dataset.reportDate = date;
      day.innerHTML = await dayDetailHtml(date);
      if (!filterMedicalDay(day, selectedCategories)) continue;
      optimizeMedicalPainLayout(day);
      pages.appendChild(day);
      includedDays += 1;
    }
    if (!includedDays) {
      shell.remove();
      alert("No hi ha registres de les categories seleccionades dins del període.");
      return;
    }

    const analysis = document.createElement("section");
    analysis.className = "medical-print-analysis";
    analysis.innerHTML = `<span class="view-eyebrow">Anàlisi del període</span><h2 style="font-size:28px;margin:8px 0 18px;">Patrons i conclusions</h2>${intelligentSummaryHtml(intel, { title: "Patrons detectats" })}${temporalReportHtml(intel)}${recommendationsHtml(intel, "Conclusions i recomanacions")}${clinicalHypotheses.length ? `<div style="margin-top:18px;"><h2 style="font-size:20px;margin-bottom:10px;">Hipòtesis a explorar</h2><p style="font-size:11px;color:var(--ink-faint);">Separades dels patrons estadístics · no són diagnòstics.</p>${clinicalHypothesesHtml(clinicalHypotheses,{compact:true,followups:hypothesisFollowups})}</div>` : ""}`;
    pages.appendChild(analysis);

    shell.querySelector("[data-close-medical-report]").addEventListener("click", () => shell.remove());
    shell.querySelector("[data-print-medical-report]").addEventListener("click", () => window.print());

    // Donem temps a Safari perquè acabi de pintar SVG, fonts i colors abans d'obrir el diàleg.
    await new Promise(resolve => setTimeout(resolve, 350));
    window.print();
  } catch (error) {
    console.error("Error preparant l’informe mèdic", error);
    alert(error?.message || "No s’ha pogut preparar l’informe mèdic.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/**
 * Exportació robusta dels dos informes curts.
 * Fem servir la impressió nativa del navegador, igual que l'informe mèdic complet,
 * perquè Safari pot fallar amb html2canvas/html2pdf en informes llargs o amb SVG.
 */
async function downloadPdf(container, selector = "#report-output", filenamePrefix = "informe-quadern-de-salut", buttonSelector = "#pdf-btn") {
  const btn = container.querySelector(buttonSelector);
  const original = btn.textContent;
  btn.textContent = "Preparant PDF…";
  btn.disabled = true;

  try {
    const element = container.querySelector(selector);
    if (!element) throw new Error("No s'ha trobat el contingut de l'informe.");

    document.querySelector(".simple-pdf-print-shell")?.remove();
    if (!document.querySelector("#simple-pdf-print-styles")) {
      const style = document.createElement("style");
      style.id = "simple-pdf-print-styles";
      style.textContent = `
        .simple-pdf-print-shell{position:fixed;inset:0;z-index:999999;background:#eef0eb;overflow:auto;padding:24px;}
        .simple-pdf-print-toolbar{position:sticky;top:0;z-index:2;max-width:210mm;margin:0 auto 16px;padding:12px 16px;background:#fff;border:1px solid #d6dacd;border-radius:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;}
        .simple-pdf-print-content{box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm;border:1px solid #d9ddd2;}
        .simple-pdf-cover{min-height:250mm;display:flex;flex-direction:column;justify-content:space-between;gap:20px;padding:8mm 4mm 4mm;box-sizing:border-box;break-after:page;page-break-after:always;}
        .simple-pdf-cover h1{font-size:34px;line-height:1.08;margin:10px 0 8px;}
        .simple-pdf-cover-period{font-size:18px;color:var(--ink-soft);margin:0;}
        .simple-pdf-cover-meta{display:grid;grid-template-columns:1fr;gap:10px;}
        .simple-pdf-cover-meta>div{padding:14px 16px;border:1px solid #d8ddd2;border-radius:14px;background:#f7f8f4;}
        .simple-pdf-cover-meta span{display:block;font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
        .simple-pdf-cover-meta strong{display:block;font-size:20px;}
        .simple-pdf-access-card{margin-top:auto;}
        .simple-pdf-cover-note{font-size:11px;color:var(--ink-faint);margin:0;}
        @media print{
          @page{size:A4 portrait;margin:10mm;}
          html,body{background:#fff!important;margin:0!important;padding:0!important;}
          body>*:not(.simple-pdf-print-shell){display:none!important;}
          .simple-pdf-print-shell{position:static!important;inset:auto!important;overflow:visible!important;padding:0!important;background:#fff!important;}
          .simple-pdf-print-toolbar{display:none!important;}
          .simple-pdf-print-content{width:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;}
          .simple-pdf-print-content .card,.simple-pdf-print-content section,.simple-pdf-print-content article{break-inside:avoid-page;page-break-inside:avoid;}
          .simple-pdf-print-content .report-calendar-month-panel{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;overflow:visible!important;margin-top:5mm!important;}
          .simple-pdf-print-content .report-calendar-month-panel:first-of-type{margin-top:0!important;}
          .simple-pdf-print-content .report-calendar-card{height:auto!important;max-height:none!important;overflow:visible!important;}
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
        }
      `;
      document.head.appendChild(style);
    }

    const start = container.querySelector("#startDate")?.value || "";
    const end = container.querySelector("#endDate")?.value || "";
    const title = filenamePrefix.includes("resum") ? "Resum mèdic" : "Informe complet";
    const shell = document.createElement("div");
    shell.className = "simple-pdf-print-shell";
    shell.innerHTML = `<div class="simple-pdf-print-toolbar no-print">
      <div><strong>${escapeHtml(title)}</strong><div style="font-size:12px;color:#6f746c;">${escapeHtml(start)} — ${escapeHtml(end)}</div></div>
      <div style="display:flex;gap:8px;"><button class="btn btn-ghost" data-close-simple-pdf>Tanca</button><button class="btn btn-primary" data-print-simple-pdf>Imprimeix / Desa PDF</button></div>
    </div><main class="simple-pdf-print-content"></main>`;

    const printContent = shell.querySelector(".simple-pdf-print-content");
    const cover = document.createElement("section");
    cover.className = "simple-pdf-cover";
    cover.innerHTML = `<div>
        <span class="view-eyebrow">Paula Tracker · ${escapeHtml(title)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="simple-pdf-cover-period">${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))}</p>
      </div>
      <div class="simple-pdf-cover-meta">
        <div><span>Generat el</span><strong>${escapeHtml(formatDate(todayISO()))}</strong></div>
      </div>
      <div class="medical-access-card simple-pdf-access-card">
        <div>
          <div class="view-eyebrow" style="margin-bottom:6px;">Accés per a professionals</div>
          <div class="medical-access-url">https://paulaterra.github.io/health-tracker/</div>
          <p class="medical-access-copy">Escaneja el codi QR o entra a l’adreça anterior.<br><strong>Contrasenya:</strong> paulatrackview</p>
        </div>
        <img src="${QR_PRINT_DATA_URL}" alt="Codi QR d’accés a Paula Tracker">
      </div>
      <p class="simple-pdf-cover-note">Document generat a partir dels registres personals de Paula Tracker. No substitueix una valoració mèdica.</p>`;
    printContent.appendChild(cover);
    const reportClone = element.cloneNode(true);
    expandAllReportCalendarsForPrint(reportClone);
    printContent.appendChild(reportClone);
    if (selector === "#medical-summary") {
      const calendarSection = container.querySelector("#full-medical-report .report-calendar-section");
      if (calendarSection) {
        const calendarClone = calendarSection.cloneNode(true);
        expandAllReportCalendarsForPrint(calendarClone);
        printContent.appendChild(calendarClone);
      }
    }
    document.body.appendChild(shell);

    shell.querySelector("[data-close-simple-pdf]").addEventListener("click", () => shell.remove());
    shell.querySelector("[data-print-simple-pdf]").addEventListener("click", () => window.print());

    await new Promise(resolve => setTimeout(resolve, 250));
    window.print();
  } catch (err) {
    console.error("Error preparant PDF", err);
    alert(err.message || "No s'ha pogut preparar el PDF.");
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function generateReport(container, start, end) {
  const output = container.querySelector("#report-output");
  const steps = ["Carregant registres", "Calculant benestar", "Cercant patrons", "Preparant conclusions", "Maquetant l’informe"];
  output.innerHTML = `
    <div class="card report-progress">
      <h2 class="card-title">Analitzant les teves dades…</h2>
      <div class="report-progress__bar"><div class="report-progress__fill" id="report-progress-fill"></div></div>
      <div class="report-progress__steps">${steps.map((x,i)=>`<div class="report-progress__step ${i===0?"active":""}" data-report-step="${i}">○ ${escapeHtml(x)}</div>`).join("")}</div>
    </div>`;
  const setProgress = (index) => {
    const fill = output.querySelector("#report-progress-fill");
    if (fill) fill.style.width = `${Math.max(8, ((index + 1) / steps.length) * 100)}%`;
    output.querySelectorAll("[data-report-step]").forEach((el, i) => {
      el.classList.toggle("done", i < index);
      el.classList.toggle("active", i === index);
      el.textContent = `${i < index ? "✓" : i === index ? "●" : "○"} ${steps[i]}`;
    });
  };
  await new Promise(resolve => requestAnimationFrame(resolve));

  const fullMatrix = await buildDailyMatrix();
  setProgress(1);
  const periodMatrix = {};
  for (const date of Object.keys(fullMatrix)) {
    if (date >= start && date <= end) periodMatrix[date] = fullMatrix[date];
  }
  const periodDates = Object.keys(periodMatrix).sort();

  if (periodDates.length === 0) {
    output.innerHTML = `
      <div class="empty-state">
        <div class="emoji-mark">···</div>
        <p>No hi ha cap dada registrada entre ${escapeHtml(formatDate(start))} i ${escapeHtml(formatDate(end))}.</p>
      </div>
    `;
    return;
  }

  const byDayFull = computeWellbeingByDay(fullMatrix);
  setProgress(2);
  const avgPeriod = averageWellbeing(byDayFull, periodDates);

  const spanDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - spanDays + 1);
  const prevDates = Object.keys(fullMatrix).filter(d => d >= prevStart.toISOString().slice(0, 10) && d <= prevEnd.toISOString().slice(0, 10));
  const avgPrev = averageWellbeing(byDayFull, prevDates);

  // El motor treballa amb tot l'historial disponible (necessita prou dades per fiabilitat).
  const correlations = computeCorrelations(fullMatrix);
  const dowPatterns = computeDayOfWeekPatterns(fullMatrix);
  const trends = computeTrends(fullMatrix);
  const { triggers, protectors } = classifyConclusions(correlations);
  const clinicalHypotheses = buildClinicalHypotheses(periodMatrix);
  const hypothesisFollowups = await loadHypothesisFollowups();

  // Un únic motor compartit alimenta Dashboard, Patrons, Conclusions i Informes.
  // Aquí el limitem al període seleccionat perquè el PDF sigui coherent amb les dates.
  const intel = await generateIntelligence({ start, end });
  const medicalSummary = medicalSummaryData(periodMatrix, intel);
  medicalSummary.intel = intel;
  setProgress(3);

  const symptomSummary = buildSymptomSummary(periodMatrix);
  const painZoneSummary = await painZoneSummaryHtml(start, end);
  setProgress(4);
  const flags = await buildFlags(start, end);
  const chart = wellbeingLineChart(byDayFull, periodDates);
  const symptomBars = symptomFrequencyChart(periodMatrix);

  output.innerHTML = `
    ${medicalSummaryHtml(medicalSummary, avgPeriod, avgPrev, start, end, periodDates.length)}

    <div id="full-medical-report">
    <div class="card">
      <h2 class="card-title" style="font-size: var(--fs-lg);">Informe del període</h2>
      <p style="color: var(--ink-soft); margin: 0;">${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))} (${periodDates.length} dies amb dades) · generat el ${escapeHtml(formatDate(todayISO()))}</p>
    </div>

    ${clinicalOverviewHtml(periodMatrix, start, end)}
    ${reportCalendarsHtml(periodMatrix, byDayFull, start, end)}
    ${flareReviewHtml(intel, periodMatrix)}
    ${painZoneSummary}

    ${intelligentSummaryHtml(intel, { title: "Resum intel·ligent del període" })}
    ${temporalReportHtml(intel)}
    ${recommendationsHtml(intel, "Recomanacions i dades a seguir") }
    ${clinicalHypotheses.length ? `<div style="margin-top:var(--sp-5);"><h2 class="card-title">Hipòtesis a explorar</h2><p style="font-size:var(--fs-xs);color:var(--ink-faint);">Aquesta secció interpreta combinacions de símptomes per orientar què comentar amb un professional. No són diagnòstics.</p>${clinicalHypothesesHtml(clinicalHypotheses,{interactive:true,followups:hypothesisFollowups})}</div>` : ""}

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Índex de benestar del període</h2>
      <p style="font-family: var(--font-mono); font-size: var(--fs-xxl); margin:0; color: ${wellbeingColor(avgPeriod)};">${avgPeriod ?? "—"}<span style="font-size: var(--fs-md); color: var(--ink-faint);">/100</span></p>
      ${avgPrev != null ? `<p style="margin: var(--sp-1) 0 0; font-size: var(--fs-sm); color: var(--ink-soft);">Període anterior equivalent: ${avgPrev}/100 ${periodTrend(avgPeriod, avgPrev)}</p>` : ""}
      <div style="margin-top: var(--sp-4);">${chart}</div>
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Resum de símptomes del període</h2>
      ${symptomBars}
      ${symptomSummary}
    </div>

    ${flags.length ? `
      <div class="card" style="margin-top: var(--sp-5); border-left: 3px solid var(--clay);">
        <h2 class="card-title" style="color: var(--clay);">Aspectes a prioritzar amb el metge</h2>
        <div class="event-list">${flags.map(f => `<div class="event-row"><div class="event-tags">${escapeHtml(f)}</div></div>`).join("")}</div>
      </div>
    ` : ""}

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Relacions destacades (${correlations.length})</h2>
      <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin: 0 0 var(--sp-3);">Només es mostren associacions que superen els llindars mínims de repetició i efecte. Les coincidències entre símptomes no es consideren desencadenants. En qualsevol percentatge: 0% = cap dels casos analitzats; 100% = tots els casos analitzats.</p>
      ${correlations.length ? `<div class="event-list">${correlations.slice(0, 12).map(patternLine).join("")}</div>` : `<p class="ledger-empty">Encara no hi ha cap relació prou repetida per destacar.</p>`}
      ${correlations.length > 12 ? `<p style="font-size: var(--fs-xs); color: var(--ink-faint); margin-top: var(--sp-2);">Es mostren les 12 relacions més consistents de ${correlations.length}.</p>` : ""}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Ritmes setmanals (${dowPatterns.length})</h2>
      ${dowPatterns.length ? `<div class="event-list">${dowPatterns.map(dowLine).join("")}</div>` : `<p class="ledger-empty">Encara no s’ha detectat cap ritme setmanal prou consistent; apareixerà automàticament quan un mateix dia de la setmana presenti una diferència repetida respecte de la teva mitjana.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Tendències generals (${trends.length})</h2>
      ${trends.length ? `<div class="event-list">${trends.map(trendLine).join("")}</div>` : `<p class="ledger-empty">Encara no hi ha cap tendència general prou clara; apareixerà automàticament quan l’evolució amb el temps sigui consistent.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title" style="color: var(--clay);">Possibles factors previs (${triggers.length})</h2>
      <p style="font-size:var(--fs-xs);color:var(--ink-faint);margin:0 0 var(--sp-3);">Només antecedents plausibles que passen abans del símptoma; no implica causalitat.</p>
      ${triggers.length ? `<div class="event-list">${triggers.slice(0,6).map(reportConclusionLine).join("")}</div>` : `<p class="ledger-empty">Encara no hi ha cap factor previ prou repetit.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title" style="color: var(--sage);">Possibles factors protectors (${protectors.length})</h2>
      <p style="font-size:var(--fs-xs);color:var(--ink-faint);margin:0 0 var(--sp-3);">Només s'hi admeten factors modificables, com activitat o medicació. Un símptoma mai es presenta com a protector.</p>
      ${protectors.length ? `<div class="event-list">${protectors.slice(0,6).map(reportConclusionLine).join("")}</div>` : `<p class="ledger-empty">Encara no hi ha prou dades per identificar cap factor protector fiable.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5); background: var(--paper-alt);">
      <p style="margin:0; font-size: var(--fs-xs); color: var(--ink-faint);">
        Aquest informe s'ha generat automàticament a partir de l'autoregistre de símptomes. Les relacions mostrades són correlacions observades a les pròpies dades, no diagnòstics ni recomanacions mèdiques. Pensat com a suport per a la conversa amb el professional sanitari.
      </p>
    </div>
    </div>
  `;
  bindHypothesisFollowups(output, hypothesisFollowups);
  wireReportCalendarNavigation(output);
}


function temporalReportHtml(intel) {
  const temporal = intel?.temporal || {};
  const episodes = temporal.recurrentEpisodes || [];
  const rhythms = temporal.rhythms || [];
  const weekly = temporal.weeklySignals || [];
  const coEvolution = temporal.coEvolution || [];
  const longTerm = temporal.longTermTrends || [];
  const flares = intel?.flares || [];
  const cycle = intel?.cycle?.hypotheses || [];

  const episodeLines = [];
  episodes.slice(0,8).forEach(item => {
    const avg = Number.isFinite(item.avgDuration) ? item.avgDuration.toFixed(1) : "—";
    const gap = item.episodeCount >= 2 && Number.isFinite(item.avgGap) ? ` · separació mitjana entre inicis ${Math.round(item.avgGap)} dies` : "";
    episodeLines.push(`<li><strong>${escapeHtml(item.label)}</strong>: ${item.episodeCount} episodi${item.episodeCount===1?"":"s"}, ${item.totalActiveDays} dies afectats, durada habitual ${avg} dies, màxim ${item.maxDuration} dies${gap}.</li>`);
  });
  flares.slice(0,6).forEach(f => episodeLines.push(`<li><strong>Brot multisimptomàtic</strong> · ${escapeHtml(formatDate(f.start))}${f.end!==f.start?` — ${escapeHtml(formatDate(f.end))}`:""}: ${f.days} dies, fins a ${f.maxDomains} àmbits alterats alhora${f.categories?.length?` (${f.categories.slice(0,5).map(c=>escapeHtml(c.label)).join(", ")})`:""}.</li>`));

  const rhythmLines = [
    ...rhythms.slice(0,6).map(r => `<li><strong>${escapeHtml(r.label)}</strong>: ${escapeHtml(r.text)} · confiança ${escapeHtml(r.confidence)}.</li>`),
    ...weekly.slice(0,6).map(w => `<li><strong>Canvi setmanal${w.type==='domain'?` · ${escapeHtml(w.domain)}`:""}</strong>: ${escapeHtml(w.text)}</li>`),
  ];

  const coLines = coEvolution.slice(0,6).map(c => `<li>${escapeHtml(c.text)}</li>`);
  const longLines = longTerm.slice(0,8).map(t => `<li>${escapeHtml(t.text)}</li>`);
  const cycleLines = cycle.slice(0,8).map(c => `<li>${escapeHtml(c.text || c.label || String(c))}</li>`);

  const section = (title, intro, lines, empty) => `
    <div class="card" style="margin-top:var(--sp-5);">
      <h2 class="card-title">${title}</h2>
      <p style="font-size:var(--fs-xs);color:var(--ink-faint);margin:0 0 var(--sp-3);">${intro}</p>
      ${lines.length ? `<ul style="margin:0;padding-left:20px;display:grid;gap:8px;">${lines.join("")}</ul>` : `<p class="ledger-empty">${empty}</p>`}
    </div>`;

  return `
    ${section("Episodis i brots", "Agrupa dies consecutius com un únic episodi i identifica períodes on diversos àmbits empitjoren alhora.", episodeLines, "Encara no hi ha prou continuïtat per identificar episodis o brots rellevants.")}
    ${section("Ritmes temporals · dies, setmanes i mesos", "Busca periodicitat entre episodis i canvis setmanals sense forçar patrons amb poques repeticions.", rhythmLines, "Encara no hi ha prou repeticions per identificar un ritme temporal consistent.")}
    ${section("Patrons del cicle menstrual", "Utilitza menstruacions reals i, quan és possible, situa l’ovulació amb dades manuals; si no n’hi ha, l’estima per calendari i ho indica explícitament.", cycleLines, "Encara no hi ha prou cicles comparables per detectar un patró relacionat amb una fase del cicle.")}
    ${section("Símptomes que evolucionen junts", "Compara l'evolució entre setmanes; no és una simple coincidència d'un dia.", coLines, "Encara no hi ha prou setmanes comparables per detectar àmbits que evolucionin junts.")}
    ${section("Tendències a llarg termini", "Busca canvis sostinguts al llarg de diverses setmanes o mesos.", longLines, "Encara no hi ha prou historial per parlar de tendències a llarg termini.")}
  `;
}

function temporalMedicalSummaryItems(intel) {
  const temporal = intel?.temporal || {};
  const items = [];
  (temporal.rhythms || []).slice(0,2).forEach(r => items.push(r.text));
  (temporal.weeklySignals || []).slice(0,2).forEach(w => items.push(w.text));
  (temporal.longTermTrends || []).slice(0,2).forEach(t => items.push(t.text));
  (temporal.coEvolution || []).slice(0,1).forEach(c => items.push(c.text));
  const eps=(temporal.recurrentEpisodes||[]).slice(0,2);
  eps.forEach(e=>items.push(`${e.label}: ${e.episodeCount} episodis, durada habitual ${Number.isFinite(e.avgDuration)?e.avgDuration.toFixed(1):"—"} dies.`));
  return items;
}

function medicalSummaryHtml(data, avgPeriod, avgPrev, start, end, dayCount) {
  const p=data.profile;
  const patternItems=data.patterns.map(item=>item.text).filter(Boolean);
  const cycleItems=p.cyclePatterns||[];
  const temporalItems=temporalMedicalSummaryItems(data.intel || {});
  const keyPatterns=[...cycleItems,...temporalItems,...patternItems].slice(0,8);
  const predictionItems=data.predictions.items||[];
  return `<section id="medical-summary" class="medical-summary report-page-break">
    <div class="medical-summary-cover">
      <span class="view-eyebrow">Paula Tracker · Resum mèdic visual</span>
      <h1>Resum de salut personal</h1>
      <p>${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))} · ${dayCount} dies amb dades</p>
    </div>
    ${scoreReferencesHtml({ compact: true })}
    <div class="medical-metrics">
      <div><span>Benestar</span><strong>${avgPeriod ?? "—"}/100</strong><small>${avgPrev!=null?`període anterior ${avgPrev}/100`:"sense comparació"}</small></div>
      <div><span>Dolor</span><strong>${p.pain.average==null?"—":`${p.pain.average.toFixed(1)}/10`}</strong><small>${p.pain.count} registres · 0=cap dolor · 10=molt intens</small></div>
      <div><span>Son</span><strong>${p.sleep.quality==null?"—":`${p.sleep.quality.toFixed(1)}/10`}</strong><small>${p.sleep.awakenings==null?"—":`${p.sleep.awakenings.toFixed(1)} despertars`} · 0=descans reparador · 10=molt mal son</small></div>
      <div><span>Zona principal</span><strong>${escapeHtml(p.pain.mainZone||"—")}</strong><small>${escapeHtml(p.pain.mainType||"sense tipus dominant")}</small></div>
    </div>
    <div class="medical-summary-grid">
      <div class="medical-summary-block"><h2>Patrons detectats</h2>${keyPatterns.length?`<ul>${keyPatterns.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:`<p>Encara no s'ha detectat cap patró amb prou evidència.</p>`}</div>
      <div class="medical-summary-block"><h2>Pròxims dies</h2>${predictionItems.length?`<ul>${predictionItems.map(x=>`<li>${escapeHtml(x.label)} · confiança ${escapeHtml(x.confidence)}</li>`).join("")}</ul>`:`<p>${escapeHtml(data.predictions.note)}</p>`}</div>
      <div class="medical-summary-block"><h2>Digestiu i cicle</h2><ul><li>Diarrea: ${(p.digestion.diarrheaRate*100).toFixed(0)}% (${p.digestion.diarrheaCount||0} de ${p.digestion.days||0} dies amb dades; 0%=cap, 100%=tots).</li>${p.digestion.bloating!=null?`<li>Inflor mitjana ${p.digestion.bloating.toFixed(1)}/10 (0=gens d’inflor; 10=inflor màxima/molt intensa).</li>`:""}${cycleItems.slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
      <div class="medical-summary-block"><h2>Nota clínica</h2><p>Aquest resum identifica associacions del registre personal. No demostra causalitat i no substitueix una valoració professional.</p></div>
    </div>
  </section>`;
}

function periodTrend(current, prev) {
  const diff = current - prev;
  if (Math.abs(diff) < 3) return `<span style="color: var(--ink-faint);">(estable)</span>`;
  return diff > 0
    ? `<span style="color: var(--sage);">(↑ +${diff})</span>`
    : `<span style="color: var(--clay);">(↓ ${diff})</span>`;
}

/* ---------------- Gràfics (SVG pur) ---------------- */

function wellbeingLineChart(byDayFull, periodDates) {
  const usable = periodDates.filter(d => byDayFull[d] != null);
  if (usable.length < 2) return `<p class="ledger-empty">Encara no hi ha prou dies amb índex de benestar per dibuixar el gràfic.</p>`;

  const w = 760, h = 180, padding = 20;
  const step = (w - padding * 2) / Math.max(1, usable.length - 1);
  const coords = usable.map((d, i) => {
    const x = padding + i * step;
    const y = padding + (1 - byDayFull[d] / 100) * (h - padding * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h - padding} L${coords[0][0].toFixed(1)},${h - padding} Z`;

  return `
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto;">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${h - padding}" stroke="var(--line)" stroke-width="1" />
      <line x1="${padding}" y1="${h - padding}" x2="${w - padding}" y2="${h - padding}" stroke="var(--line)" stroke-width="1" />
      <path d="${areaPath}" fill="var(--sage-bg)" opacity="0.6" />
      <path d="${path}" fill="none" stroke="var(--sage)" stroke-width="2" />
    </svg>
    <div style="display:flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--ink-faint);">
      <span>${escapeHtml(formatDate(usable[0]))}</span>
      <span>${escapeHtml(formatDate(usable[usable.length - 1]))}</span>
    </div>
  `;
}

function symptomFrequencyChart(periodMatrix) {
  const dates = Object.keys(periodMatrix);
  const counts = [];
  for (const key of Object.keys(VARIABLE_META)) {
    const meta = VARIABLE_META[key];
    if (meta.type !== "boolean") continue;
    const count = dates.filter(d => periodMatrix[d][key]).length;
    if (count > 0) counts.push({ label: meta.label, count });
  }
  if (counts.length === 0) return "";
  counts.sort((a, b) => b.count - a.count);
  const max = counts[0].count;
  const bars = counts.slice(0, 10).map(c => `
    <div style="display:flex; align-items:center; gap: var(--sp-2); margin-bottom: 4px;">
      <span style="width:150px; font-size: var(--fs-xs); color: var(--ink-soft); flex-shrink:0;">${escapeHtml(c.label)}</span>
      <div style="background: var(--clay-bg); border-radius: 3px; flex:1;">
        <div style="background: var(--clay); height: 10px; border-radius: 3px; width: ${(c.count / max) * 100}%;"></div>
      </div>
      <span style="font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--ink-faint); width: 40px; text-align:right;">${c.count}d</span>
    </div>
  `).join("");
  return `<div style="margin-bottom: var(--sp-4);">${bars}</div>`;
}

/* ---------------- Línies de text dels patrons/tendències ---------------- */

function numericScaleLegend(key) {
  const legends = {
    dolor_general: "0=cap dolor; 10=dolor màxim/molt intens", dolor_intensitat_max: "0=cap dolor; 10=dolor màxim/molt intens", dolor_esquena_intensitat: "0=cap dolor; 10=dolor màxim/molt intens", dolor_darrere_cap_intensitat: "0=cap dolor; 10=dolor màxim/molt intens", mal_de_cap_intensitat: "0=cap dolor; 10=mal de cap molt intens", vertigen_intensitat: "0=cap sensació; 10=sensació molt intensa", digestiu_general: "0=cap molèstia; 10=molèstia molt intensa", digestiu_inflor: "0=gens d’inflor; 10=inflor màxima/molt intensa", digestiu_dolorAbdominal: "0=cap dolor; 10=dolor molt intens", digestiu_retortijons: "0=cap molèstia; 10=molèstia molt intensa", digestiu_gasos: "0=cap molèstia; 10=molèstia molt intensa", son_qualitat: "0=descans reparador; 10=molt mal son", son_fatiga_mati: "0=cap fatiga; 10=fatiga extrema", energia_fisica: "0=molta energia; 10=esgotament", energia_mental: "0=cap boira mental; 10=boira mental molt intensa"
  };
  return legends[key] || "0=mínim/absència; 10=màxim/molt intens";
}

function patternLine(p) {
  const cond = p.predictorType === "boolean" ? p.predictorLabel.toLowerCase() : `${p.predictorLabel.toLowerCase()} alt (≥6/10)`;
  const relation = p.lag === 0
    ? `<strong>${escapeHtml(cond)}</strong> coincideix amb ${escapeHtml(p.outcomeLabel.toLowerCase())}`
    : `<strong>${escapeHtml(cond)}</strong> precedeix ${escapeHtml(p.outcomeLabel.toLowerCase())} (${humanLagLabel(p.lag)})`;
  let effectText = "";
  if (p.outcomeType === "numeric") effectText = `mitjana amb factor ${p.effect.meanA.toFixed(1)}/10 (n=${p.nA}) vs sense factor ${p.effect.meanB.toFixed(1)}/10 (n=${p.nB}) · ${numericScaleLegend(p.outcomeKey)}`;
  else {
    const casesA=Math.round(p.effect.rateA*p.nA), casesB=Math.round(p.effect.rateB*p.nB);
    effectText = `amb factor ${(p.effect.rateA*100).toFixed(0)}% (${casesA}/${p.nA}) vs sense factor ${(p.effect.rateB*100).toFixed(0)}% (${casesB}/${p.nB})`;
  }
  return `
    <div class="event-row">
      <div class="event-tags">${relation} · ${effectText} · n=${p.nA}/${p.nB} · confiança ${p.confidence.label}</div>
    </div>
  `;
}

function dowLine(p) {
  return `
    <div class="event-row">
      <div class="event-tags">Els <strong>${p.dowName}</strong>, ${escapeHtml(p.label.toLowerCase())} sol ser ${p.direction} (n=${p.n})</div>
    </div>
  `;
}

function trendLine(t) {
  return `
    <div class="event-row">
      <div class="event-tags">${escapeHtml(t.label)} està <strong>${t.direction}</strong> (primera meitat n=${t.nFirst}, segona n=${t.nSecond})</div>
    </div>
  `;
}

function reportConclusionLine(p) {
  const cond = p.predictorType === "boolean" ? p.predictorLabel.toLowerCase() : `${p.predictorLabel.toLowerCase()} alt`;
  let evidence="";
  if(p.outcomeType==="boolean"){
    const a=Math.round(p.effect.rateA*p.nA), b=Math.round(p.effect.rateB*p.nB);
    evidence=` · amb factor ${(p.effect.rateA*100).toFixed(0)}% (${a}/${p.nA}) vs sense factor ${(p.effect.rateB*100).toFixed(0)}% (${b}/${p.nB})`;
  } else if(p.outcomeType==="numeric"){
    evidence=` · mitjana ${p.effect.meanA.toFixed(1)}/10 amb factor (n=${p.nA}) vs ${p.effect.meanB.toFixed(1)}/10 sense factor (n=${p.nB}) · ${numericScaleLegend(p.outcomeKey)}`;
  }
  return `
    <div class="event-row">
      <div class="event-tags">
        <strong>${escapeHtml(cond)}</strong> → ${escapeHtml(p.outcomeLabel.toLowerCase())} ${p.direction} ${p.lag === 1 ? "l'endemà" : `al cap de ${p.lag} dies`} · confiança ${p.confidence.label}${evidence}
      </div>
      <div class="event-comment">${escapeHtml(p.recommendation)}</div>
    </div>
  `;
}

/* ---------------- Resum de símptomes i alertes ---------------- */

function buildSymptomSummary(periodMatrix) {
  const dates = Object.keys(periodMatrix);
  const rows = [];
  for (const key of Object.keys(VARIABLE_META)) {
    const meta = VARIABLE_META[key];
    const vals = dates.map(d => periodMatrix[d][key]).filter(v => v !== undefined);
    if (vals.length === 0) continue;
    if (meta.type === "boolean") {
      const count = vals.filter(Boolean).length;
      if (count === 0) continue;
      rows.push({ label: meta.label, text: `${count} de ${vals.length} dies registrats` });
    } else {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const max = Math.max(...vals);
      if (avg < 0.5 && max < 3) continue;
      rows.push({ label: meta.label, text: `mitjana ${avg.toFixed(1)}/10 · pic ${max}/10 (${vals.length} dies) · ${numericScaleLegend(key)}` });
    }
  }
  if (rows.length === 0) return `<p class="ledger-empty">Sense símptomes destacables aquest període.</p>`;
  return `
    <div class="event-list">
      ${rows.map(r => `<div class="event-row"><div class="event-row-top"><span style="font-weight:600; font-size: var(--fs-sm);">${escapeHtml(r.label)}</span></div><div class="event-tags">${escapeHtml(r.text)}</div></div>`).join("")}
    </div>
  `;
}

async function buildFlags(start, end) {
  const flags = [];

  const bowels = (await new Repository("bowel_movements").getAll()).filter(b => {
    const d = (b.timestamp || "").slice(0, 10);
    return d >= start && d <= end;
  });
  const bloodDays = new Set(bowels.filter(b => b.sang).map(b => (b.timestamp || "").slice(0, 10)));
  if (bloodDays.size > 0) flags.push(`Sang a la deposició detectada en ${bloodDays.size} dia${bloodDays.size === 1 ? "" : "s"} d'aquest període.`);

  const pains = (await new Repository("pain_events").getAll()).filter(p => {
    const d = (p.timestamp || "").slice(0, 10);
    return d >= start && d <= end && p.intensitat >= 8;
  });
  if (pains.length > 0) flags.push(`${pains.length} episodi${pains.length === 1 ? "" : "s"} de dolor molt intens (≥8/10).`);

  const skins = (await new Repository("skin_episodes").getAll()).filter(sk => sk.dataInici && sk.dataInici >= start && sk.dataInici <= end);
  if (skins.length > 0) flags.push(`${skins.length} registre${skins.length === 1 ? "" : "s"} de pell en aquest període.`);

  return flags;
}

async function exportAllDataAsJson() {
  const data = {};
  for (const store of ALL_STORES) {
    data[store] = await new Repository(store).getAll();
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quadern-de-salut-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
