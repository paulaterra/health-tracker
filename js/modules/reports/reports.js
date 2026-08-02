import { Repository } from "../../db/repository.js";
import { buildDailyMatrix, VARIABLE_META } from "../../engine/normalizer.js";
import { computeWellbeingByDay, averageWellbeing, wellbeingColor } from "../../engine/wellbeing.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "../../engine/correlation.js";
import { classifyConclusions } from "../../engine/conclusions.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml, recommendationsHtml } from "../../engine/intelligence-view.js";
import { escapeHtml, formatDate } from "../../utils/dom.js";
import { medicalSummaryData } from "../../engine/personal-insights.js";

const ALL_STORES = [
  "daily_checkin", "pain_events", "headache_events", "vertigo_events", "digestive_events",
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

let html2pdfLoadPromise = null;

/** Carrega la llibreria html2pdf.js sota demanda (només quan cal exportar). */
function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve();
  if (html2pdfLoadPromise) return html2pdfLoadPromise;
  html2pdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No s'ha pogut carregar la llibreria de PDF (comprova la connexió a internet)."));
    document.head.appendChild(script);
  });
  return html2pdfLoadPromise;
}

async function downloadPdf(container, selector = "#report-output", filenamePrefix = "informe-quadern-de-salut", buttonSelector = "#pdf-btn") {
  const btn = container.querySelector(buttonSelector);
  const original = btn.textContent;
  btn.textContent = "Generant PDF…";
  btn.disabled = true;
  try {
    await loadHtml2Pdf();
    const element = container.querySelector(selector);
    const start = container.querySelector("#startDate").value;
    const end = container.querySelector("#endDate").value;
    await window.html2pdf()
      .set({
        margin: 10,
        filename: `${filenamePrefix}-${start}-a-${end}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(element)
      .save();
  } catch (err) {
    alert(`${err.message || "No s'ha pogut generar el PDF."} Pots fer servir el botó "Imprimeix" com a alternativa (des d'allà també pots triar "Desar com a PDF").`);
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

  // Un únic motor compartit alimenta Dashboard, Patrons, Conclusions i Informes.
  // Aquí el limitem al període seleccionat perquè el PDF sigui coherent amb les dates.
  const intel = await generateIntelligence({ start, end });
  const medicalSummary = medicalSummaryData(periodMatrix, intel);
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
    ${recommendationsHtml(intel, "Recomanacions i dades a seguir") }

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
      <h2 class="card-title">Tots els patrons detectats (${correlations.length})</h2>
      <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin: 0 0 var(--sp-3);">Relacions entre variables, de finestres diàries fins a mensuals (-30 a +30 dies), ordenades per força.</p>
      ${correlations.length ? `<div class="event-list">${correlations.slice(0, 40).map(patternLine).join("")}</div>` : `<p class="ledger-empty">Encara no se n'ha trobat cap.</p>`}
      ${correlations.length > 40 ? `<p style="font-size: var(--fs-xs); color: var(--ink-faint); margin-top: var(--sp-2);">... i ${correlations.length - 40} més (mostrant els 40 més forts).</p>` : ""}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Ritmes setmanals (${dowPatterns.length})</h2>
      ${dowPatterns.length ? `<div class="event-list">${dowPatterns.map(dowLine).join("")}</div>` : `<p class="ledger-empty">Encara no se n'ha trobat cap.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title">Tendències generals (${trends.length})</h2>
      ${trends.length ? `<div class="event-list">${trends.map(trendLine).join("")}</div>` : `<p class="ledger-empty">Encara no se n'ha trobat cap.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title" style="color: var(--clay);">Possibles factors desencadenants (${triggers.length})</h2>
      ${triggers.length ? `<div class="event-list">${triggers.map(reportConclusionLine).join("")}</div>` : `<p class="ledger-empty">Cap detectat encara.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5);">
      <h2 class="card-title" style="color: var(--sage);">Possibles factors protectors (${protectors.length})</h2>
      ${protectors.length ? `<div class="event-list">${protectors.map(reportConclusionLine).join("")}</div>` : `<p class="ledger-empty">Cap detectat encara.</p>`}
    </div>

    <div class="card" style="margin-top: var(--sp-5); background: var(--paper-alt);">
      <p style="margin:0; font-size: var(--fs-xs); color: var(--ink-faint);">
        Aquest informe s'ha generat automàticament a partir de l'autoregistre de símptomes. Les relacions mostrades són correlacions observades a les pròpies dades, no diagnòstics ni recomanacions mèdiques. Pensat com a suport per a la conversa amb el professional sanitari.
      </p>
    </div>
    </div>
  `;
}

function medicalSummaryHtml(data, avgPeriod, avgPrev, start, end, dayCount) {
  const p=data.profile;
  const patternItems=data.patterns.map(item=>item.text).filter(Boolean);
  const cycleItems=p.cyclePatterns||[];
  const keyPatterns=[...cycleItems,...patternItems].slice(0,5);
  const predictionItems=data.predictions.items||[];
  return `<section id="medical-summary" class="medical-summary report-page-break">
    <div class="medical-summary-cover">
      <span class="view-eyebrow">Paula Tracker · Resum mèdic visual</span>
      <h1>Resum de salut personal</h1>
      <p>${escapeHtml(formatDate(start))} — ${escapeHtml(formatDate(end))} · ${dayCount} dies amb dades</p>
    </div>
    <div class="medical-metrics">
      <div><span>Benestar</span><strong>${avgPeriod ?? "—"}/100</strong><small>${avgPrev!=null?`període anterior ${avgPrev}/100`:"sense comparació"}</small></div>
      <div><span>Dolor</span><strong>${p.pain.average==null?"—":`${p.pain.average.toFixed(1)}/10`}</strong><small>${p.pain.count} registres</small></div>
      <div><span>Son</span><strong>${p.sleep.quality==null?"—":`${p.sleep.quality.toFixed(1)}/10`}</strong><small>${p.sleep.awakenings==null?"—":`${p.sleep.awakenings.toFixed(1)} despertars`}</small></div>
      <div><span>Zona principal</span><strong>${escapeHtml(p.pain.mainZone||"—")}</strong><small>${escapeHtml(p.pain.mainType||"sense tipus dominant")}</small></div>
    </div>
    <div class="medical-summary-grid">
      <div class="medical-summary-block"><h2>Patrons detectats</h2>${keyPatterns.length?`<ul>${keyPatterns.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:`<p>Encara no s'ha detectat cap patró amb prou evidència.</p>`}</div>
      <div class="medical-summary-block"><h2>Pròxims dies</h2>${predictionItems.length?`<ul>${predictionItems.map(x=>`<li>${escapeHtml(x.label)} · confiança ${escapeHtml(x.confidence)}</li>`).join("")}</ul>`:`<p>${escapeHtml(data.predictions.note)}</p>`}</div>
      <div class="medical-summary-block"><h2>Digestiu i cicle</h2><ul><li>Diarrea en el ${(p.digestion.diarrheaRate*100).toFixed(0)}% dels dies amb dades.</li>${p.digestion.bloating!=null?`<li>Inflor mitjana ${p.digestion.bloating.toFixed(1)}/10.</li>`:""}${cycleItems.slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul></div>
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

function patternLine(p) {
  const cond = p.predictorType === "boolean" ? p.predictorLabel.toLowerCase() : `${p.predictorLabel.toLowerCase()} alt (≥6/10)`;
  return `
    <div class="event-row">
      <div class="event-tags">
        <strong>${escapeHtml(cond)}</strong> (${humanLagLabel(p.lag)}) → ${escapeHtml(p.outcomeLabel)} ${p.direction} · n=${p.nA}/${p.nB} · confiança ${p.confidence.label}
      </div>
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
  return `
    <div class="event-row">
      <div class="event-tags">
        <strong>${escapeHtml(cond)}</strong> → ${escapeHtml(p.outcomeLabel)} ${p.direction} (${humanLagLabel(p.lag)}) · confiança ${p.confidence.label}
      </div>
      <div class="event-comment">💡 ${escapeHtml(p.recommendation)}</div>
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
      rows.push({ label: meta.label, text: `mitjana ${avg.toFixed(1)}/10 · pic ${max}/10 (${vals.length} dies)` });
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

  const skins = (await new Repository("skin_episodes").getAll()).filter(sk => sk.dataInici && sk.dataInici <= end && (sk.dataFi || end) >= start);
  if (skins.length > 0) flags.push(`${skins.length} episodi${skins.length === 1 ? "" : "s"} de pell actiu${skins.length === 1 ? "" : "s"} en aquest període.`);

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
