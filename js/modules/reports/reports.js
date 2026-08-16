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
import { buildClinicalHypotheses, clinicalHypothesesHtml } from "../../engine/clinical-hypotheses.js";


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

const ALL_STORES = [
  "daily_checkin", "pain_events", "movement_limitations", "headache_events", "vertigo_events", "digestive_events",
  "bowel_movements", "sleep_log", "exercise_log", "cycle_log", "skin_episodes", "medications",
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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

  container.querySelector("#medical-report-btn").addEventListener("click", async () => {
    const start = container.querySelector("#medicalStartDate").value;
    const end = container.querySelector("#medicalEndDate").value;
    if (!start || !end || start > end) {
      alert("Comprova les dates: la data d’inici ha de ser abans que la de final.");
      return;
    }
    await openMedicalPrintView(container, start, end);
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


async function openMedicalPrintView(container, start, end) {
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
      <div class="medical-print-meta"><div><span>Dies amb registres</span><strong style="display:block;font-size:24px;">${dates.length}</strong></div><div><span>Generat el</span><strong style="display:block;font-size:24px;">${escapeHtml(formatDate(todayISO()))}</strong></div></div>
      <div class="medical-access-card">
        <div>
          <div class="view-eyebrow" style="margin-bottom:6px;">Accés per a professionals</div>
          <div class="medical-access-url">https://paulaterra.github.io/health-tracker/</div>
          <p class="medical-access-copy">Escaneja el codi QR o entra a l’adreça anterior.<br><strong>Contrasenya:</strong> paulatrackview</p>
        </div>
        <img src="./assets/health-tracker-access-qr.svg" alt="Codi QR d’accés a Paula Tracker">
      </div>
      <p style="font-size:11px;color:var(--ink-faint);">Document generat a partir dels registres personals de Paula Tracker. No substitueix una valoració mèdica.</p>`;
    pages.appendChild(cover);

    for (const date of dates) {
      const day = document.createElement("section");
      day.className = "medical-print-day-start";
      day.dataset.reportDate = date;
      day.innerHTML = await dayDetailHtml(date);
      optimizeMedicalPainLayout(day);
      pages.appendChild(day);
    }

    const analysis = document.createElement("section");
    analysis.className = "medical-print-analysis";
    analysis.innerHTML = `<span class="view-eyebrow">Anàlisi del període</span><h2 style="font-size:28px;margin:8px 0 18px;">Patrons i conclusions</h2>${intelligentSummaryHtml(intel, { title: "Patrons detectats" })}${temporalReportHtml(intel)}${recommendationsHtml(intel, "Conclusions i recomanacions")}${clinicalHypotheses.length ? `<div style="margin-top:18px;"><h2 style="font-size:20px;margin-bottom:10px;">Hipòtesis a explorar</h2><p style="font-size:11px;color:var(--ink-faint);">Separades dels patrons estadístics · no són diagnòstics.</p>${clinicalHypothesesHtml(clinicalHypotheses,{compact:true})}</div>` : ""}`;
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
        <img src="./assets/health-tracker-access-qr.svg" alt="Codi QR d’accés a Paula Tracker">
      </div>
      <p class="simple-pdf-cover-note">Document generat a partir dels registres personals de Paula Tracker. No substitueix una valoració mèdica.</p>`;
    printContent.appendChild(cover);
    printContent.appendChild(element.cloneNode(true));
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

  // Un únic motor compartit alimenta Dashboard, Patrons, Conclusions i Informes.
  // Aquí el limitem al període seleccionat perquè el PDF sigui coherent amb les dates.
  const intel = await generateIntelligence({ start, end });
  const medicalSummary = medicalSummaryData(periodMatrix, intel);
  medicalSummary.intel = intel;
  setProgress(3);

  const symptomSummary = buildSymptomSummary(periodMatrix);
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

    ${intelligentSummaryHtml(intel, { title: "Resum intel·ligent del període" })}
    ${temporalReportHtml(intel)}
    ${recommendationsHtml(intel, "Recomanacions i dades a seguir") }
    ${clinicalHypotheses.length ? `<div style="margin-top:var(--sp-5);"><h2 class="card-title">Hipòtesis a explorar</h2><p style="font-size:var(--fs-xs);color:var(--ink-faint);">Aquesta secció interpreta combinacions de símptomes per orientar què comentar amb un professional. No són diagnòstics.</p>${clinicalHypothesesHtml(clinicalHypotheses)}</div>` : ""}

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
