import { escapeHtml, formatDate } from "../utils/dom.js";
import { VARIABLE_META } from "./normalizer.js";
import { humanLagLabel } from "./correlation.js";

function zonesHtml(zones, compact) {
  if (!zones?.length) return "";
  const max = Math.max(...zones.map(z=>z.count),1);
  return `
    <h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Mapa de calor per zones</h3>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${zones.slice(0,compact?3:8).map(z=>`
        <div>
          <div style="display:flex;justify-content:space-between;gap:12px;font-size:var(--fs-xs);">
            <strong>${escapeHtml(z.label)}</strong><span>${z.count} episodis · ${z.avg.toFixed(1)}/10</span>
          </div>
          <div style="height:8px;background:var(--paper-alt);border-radius:999px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:${Math.max(8,z.count/max*100)}%;background:var(--clay);border-radius:999px;"></div></div>
          ${!compact&&z.associations?.length?`<div style="font-size:var(--fs-xs);color:var(--ink-soft);margin-top:4px;">${z.associations.slice(0,2).map(a=>`${escapeHtml(a.labelA)}: ${a.meanA.toFixed(1)} vs ${a.meanB.toFixed(1)} (${escapeHtml(a.labelB)})`).join(" · ")}</div>`:""}
        </div>`).join("")}
    </div>`;
}

function flaresHtml(flares, compact) {
  if (!flares?.length) return "";
  return `
    <h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Brots multisimptomàtics detectats</h3>
    <div class="event-list">${flares.slice(0,compact?1:5).map(f=>`
      <div class="event-row">
        <div class="event-tags"><strong>${escapeHtml(formatDate(f.start))}${f.end!==f.start?` — ${escapeHtml(formatDate(f.end))}`:""}</strong> · ${f.days} dies · intensitat ${escapeHtml(f.severity)}</div>
        <div class="event-comment">Dominis: ${f.categories.map(c=>escapeHtml(c.label)).join(", ")}. Senyals principals: ${f.signals.slice(0,4).map(s=>escapeHtml(s.label)).join(", ")}.</div>
      </div>`).join("")}</div>`;
}


function cycleHtml(cycle, compact) {
  if (!cycle) return "";
  const detected = (cycle.hypotheses || []).filter(item => item.status === "detected");
  const visible = compact ? detected.slice(0, 2) : detected;

  // Les hipòtesis personals només es mostren quan el motor detecta
  // una associació amb prou dades i compleix els llindars estadístics.
  if (!visible.length) return "";

  return `
    <h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Patrons segons la fase del cicle</h3>
    <div class="event-row" style="background:var(--paper-alt);margin-bottom:8px;"><div class="event-tags">${escapeHtml(cycle.summary)}</div></div>
    <div class="event-list">${visible.map(item => `
      <div class="event-row">
        <div class="event-row-top"><strong>${escapeHtml(item.title)}</strong><span class="badge">${escapeHtml(item.confidence)}</span></div>
        <div class="event-comment">${escapeHtml(item.text)}</div>
      </div>`).join("")}</div>
  `;
}

function medicationHtml(items, compact) {
  if (!items?.length) return "";
  return `
    <h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Resposta temporal després de medicació</h3>
    <div class="event-list">${items.slice(0,compact?1:5).map(m=>`
      <div class="event-row"><div class="event-tags"><strong>${escapeHtml(m.name)}</strong>: dolor ${m.before.toFixed(1)} abans → ${m.after.toFixed(1)} després (${m.change>0?"+":""}${m.change.toFixed(1)}; ${m.count} preses comparables; confiança ${escapeHtml(m.confidence)}).</div></div>`).join("")}</div>`;
}

export function intelligentSummaryHtml(intel,{compact=false,title="Resum intel·ligent"}={}){
  const confidence=intel.dataQuality.level;
  const patternItems=intel.patterns.slice(0,compact?2:5),conclusionItems=intel.conclusions.slice(0,compact?2:6);
  return `
    <div class="card intelligent-summary" style="border-left:3px solid var(--sage);">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;">
        <div><h2 class="card-title">${escapeHtml(title)}</h2><p style="margin:0;color:var(--ink-soft);font-size:var(--fs-sm);">${intel.period.days} dies analitzats · ${intel.dataQuality.painRecords} registres de dolor</p></div>
        <span class="badge">confiança ${escapeHtml(confidence)}</span>
      </div>
      ${!intel.dataQuality.minimumReached?`<div class="event-row" style="margin-top:var(--sp-3);background:var(--amber-bg);"><div class="event-tags"><strong>Encara aprenent:</strong> no es mostraran hipòtesis estadístiques fins que hi hagi almenys 14 dies amb dades.</div></div>`:""}
      ${intel.pain.summary.length?`<div class="event-list" style="margin-top:var(--sp-3);">${intel.pain.summary.slice(0,compact?3:6).map(x=>`<div class="event-row"><div class="event-tags">${escapeHtml(x)}</div></div>`).join("")}</div>`:`<p class="ledger-empty">Encara no hi ha prou registres de dolor.</p>`}
      ${zonesHtml(intel.pain.zones,compact)}
      ${flaresHtml(intel.flares,compact)}
      ${medicationHtml(intel.medication,compact)}
      ${cycleHtml(intel.cycle,compact)}
      ${patternItems.length?`<h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Relacions destacades</h3><div class="event-list">${patternItems.map(p=>`<div class="event-row"><div class="event-tags">${escapeHtml(p.text)} · confiança ${escapeHtml(p.confidence.label)} · cobertura ${Math.round(p.coverage*100)}%</div></div>`).join("")}</div>`:""}
      ${!compact&&conclusionItems.length?`<h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Hipòtesis principals</h3><div class="event-list">${conclusionItems.map(c=>`<div class="event-row"><div class="event-tags"><strong>${c.kind==="trigger"?"Possible desencadenant":"Possible protector"}:</strong> ${escapeHtml(c.text)}</div></div>`).join("")}</div>`:""}
      <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);font-style:italic;">Associacions observades a les teves dades; no demostren causalitat ni substitueixen una valoració mèdica.</p>
    </div>`;
}

export function recommendationsHtml(intel,title="Recomanacions de seguiment"){
  if(!intel.recommendations.length)return "";
  return `<div class="card" style="margin-top:var(--sp-5);"><h2 class="card-title">${escapeHtml(title)}</h2><div class="event-list">${intel.recommendations.map(r=>`<div class="event-row"><div class="event-tags">${escapeHtml(r)}</div></div>`).join("")}</div></div>`;
}


const SECTIONAL_ANALYSIS = [
  { key:"pain", icon:"◇", title:"Dolor corporal", tone:"clay", category:"Dolor", vars:["dolor_intensitat_max","dolor_esquena_intensitat","dolor_rigidesa"], pain:true },
  { key:"headache", icon:"◉", title:"Mal de cap", tone:"coral", vars:["mal_de_cap_ocorregut","mal_de_cap_intensitat"] },
  { key:"vertigo", icon:"◎", title:"Vertígens", tone:"violet", vars:["vertigen_ocorregut","vertigen_intensitat"] },
  { key:"digestive", icon:"≈", title:"Digestiu", tone:"amber", category:"Digestiu", vars:["digestiu_general","digestiu_inflor","digestiu_dolorAbdominal","digestiu_retortijons","digestiu_gasos","digestiu_urgencia","digestiu_diarrea"] },
  { key:"sleep", icon:"☾", title:"Son", tone:"teal", category:"Son", vars:["son_qualitat","son_despertars","son_fatiga_mati","son_parasomnia","son_llums_dormida"] },
  { key:"energy", icon:"⚡", title:"Cansament i check-in", tone:"sage", category:"Energia", vars:["energia_fisica","energia_mental","energia_esgotament"] },
  { key:"exercise", icon:"↗", title:"Exercici i activitat", tone:"blue", category:"Exercici", vars:["exercici_fet","exercici_gimnas","exercici_fisio","exercici_activacio_neuromuscular","exercici_caminar","exercici_passos"] },
  { key:"cycle", icon:"○", title:"Cicle menstrual", tone:"pink", category:"Cicle", vars:["cicle_regla","cicle_premenstrual","cicle_postmenstrual","cicle_ovulacio_finestra"] },
  { key:"skin", icon:"✦", title:"Pell", tone:"orange", category:"Pell", vars:["pell_brot"] },
  { key:"medication", icon:"＋", title:"Medicació", tone:"navy", category:"Medicació", vars:["medicacio_presa"] },
];

function valuesFor(matrix, key) {
  return Object.values(matrix).map(day => day[key]).filter(value => value !== undefined && value !== null);
}
function meanValue(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum,value)=>sum+value,0)/nums.length : null;
}
function pct(value,total) { return total ? Math.round(value/total*100) : 0; }
function relevantPattern(intel, section) {
  const keys = new Set(section.vars || []);
  return (intel.patterns || []).find(pattern => keys.has(pattern.predictorKey) || keys.has(pattern.outcomeKey) ||
    (section.category && (VARIABLE_META[pattern.predictorKey]?.category === section.category || VARIABLE_META[pattern.outcomeKey]?.category === section.category)));
}
function relevantTrend(intel, section) {
  const keys = new Set(section.vars || []);
  return (intel.trends || []).find(trend => keys.has(trend.key) || (section.category && VARIABLE_META[trend.key]?.category === section.category));
}
function sectionObservations(section, matrix, intel) {
  const days = Object.keys(matrix).length;
  const observations = [];
  let evidence = 0;

  if (section.pain && intel.pain?.profile) {
    const p = intel.pain.profile;
    evidence = p.count;
    observations.push(`Intensitat mitjana ${p.avg.toFixed(1)}/10 en ${p.count} registres; màxim ${p.max}/10.`);
    if (p.topZone) observations.push(`Zona més repetida: ${p.topZone[0]} (${p.topZone[1]} registres).`);
    if (p.topType) observations.push(`Tipus predominant: ${p.topType[0]}.`);
    if (p.sleepAffected) observations.push(`Ha afectat el son en ${p.sleepAffected} registres.`);
  } else if (section.key === "headache") {
    const occurred=valuesFor(matrix,"mal_de_cap_ocorregut").filter(Boolean).length;
    const intensities=valuesFor(matrix,"mal_de_cap_intensitat").map(Number).filter(v=>v>0);
    evidence=occurred;
    if (occurred) observations.push(`${occurred} dies amb mal de cap (${pct(occurred,days)}% dels dies amb dades).`);
    if (intensities.length) observations.push(`Intensitat mitjana ${meanValue(intensities).toFixed(1)}/10; màxim ${Math.max(...intensities)}/10.`);
  } else if (section.key === "vertigo") {
    const occurred=valuesFor(matrix,"vertigen_ocorregut").filter(Boolean).length;
    const intensities=valuesFor(matrix,"vertigen_intensitat").map(Number).filter(v=>v>0);
    evidence=occurred;
    if (occurred) observations.push(`${occurred} dies amb vertigen (${pct(occurred,days)}% dels dies amb dades).`);
    if (intensities.length) observations.push(`Intensitat mitjana ${meanValue(intensities).toFixed(1)}/10.`);
  } else if (section.key === "digestive") {
    const affected=Object.values(matrix).filter(day => Number(day.digestiu_general)>0 || Number(day.digestiu_inflor)>0 || Number(day.digestiu_dolorAbdominal)>0 || day.digestiu_diarrea || day.digestiu_urgencia).length;
    const bloating=valuesFor(matrix,"digestiu_inflor").map(Number).filter(v=>v>0);
    const diarrhea=valuesFor(matrix,"digestiu_diarrea").filter(Boolean).length;
    evidence=affected;
    if (affected) observations.push(`${affected} dies amb símptomes digestius (${pct(affected,days)}%).`);
    if (bloating.length) observations.push(`Inflor mitjana ${meanValue(bloating).toFixed(1)}/10 els dies registrada.`);
    if (diarrhea) observations.push(`${diarrhea} dies amb diarrea registrada.`);
  } else if (section.key === "sleep") {
    const quality=valuesFor(matrix,"son_qualitat").map(Number).filter(Number.isFinite);
    const awakenings=valuesFor(matrix,"son_despertars").map(Number).filter(Number.isFinite);
    const parasomnia=valuesFor(matrix,"son_parasomnia").filter(Boolean).length;
    evidence=quality.length;
    if (quality.length) observations.push(`Mal descans mitjà ${meanValue(quality).toFixed(1)}/10 en ${quality.length} nits.`);
    if (awakenings.length) observations.push(`Mitjana de ${meanValue(awakenings).toFixed(1)} despertars per nit registrada.`);
    if (parasomnia) observations.push(`${parasomnia} nits amb incidències de parasòmnia.`);
  } else if (section.key === "energy") {
    const physical=valuesFor(matrix,"energia_fisica").map(Number).filter(Number.isFinite);
    const mental=valuesFor(matrix,"energia_mental").map(Number).filter(Number.isFinite);
    evidence=Math.max(physical.length,mental.length);
    if (physical.length) observations.push(`Cansament físic mitjà ${meanValue(physical).toFixed(1)}/10.`);
    if (mental.length) observations.push(`Boira mental mitjana ${meanValue(mental).toFixed(1)}/10.`);
  } else if (section.key === "exercise") {
    const active=valuesFor(matrix,"exercici_fet").filter(Boolean).length;
    const walking=valuesFor(matrix,"exercici_caminar").filter(Boolean).length;
    const gym=valuesFor(matrix,"exercici_gimnas").filter(Boolean).length;
    evidence=active;
    if (active) observations.push(`${active} dies amb activitat o exercici (${pct(active,days)}%).`);
    if (walking || gym) observations.push(`Caminar: ${walking} dies · Gimnàs/entrenador: ${gym} dies.`);
  } else if (section.key === "cycle") {
    const period=valuesFor(matrix,"cicle_regla").filter(Boolean).length;
    const pre=valuesFor(matrix,"cicle_premenstrual").filter(Boolean).length;
    evidence=period;
    if (period) observations.push(`${period} dies de menstruació registrats.`);
    const detected=(intel.cycle?.hypotheses||[]).filter(item=>item.status==="detected");
    if (detected.length) observations.push(detected[0].text);
    else if (pre) observations.push(`${pre} dies classificats en fase premenstrual per comparar símptomes.`);
  } else if (section.key === "skin") {
    const outbreaks=valuesFor(matrix,"pell_brot").filter(Boolean).length;
    evidence=outbreaks;
    if (outbreaks) observations.push(`${outbreaks} dies amb brot de pell (${pct(outbreaks,days)}%).`);
  } else if (section.key === "medication") {
    const medDays=valuesFor(matrix,"medicacio_presa").filter(Boolean).length;
    evidence=medDays;
    if (medDays) observations.push(`Medicació registrada en ${medDays} dies.`);
    if (intel.medication?.length) {
      const med=intel.medication[0];
      observations.push(`${med.name}: dolor ${med.before.toFixed(1)} abans → ${med.after.toFixed(1)} després en ${med.count} preses comparables.`);
    }
  }

  const pattern = relevantPattern(intel, section);
  if (pattern && intel.dataQuality.minimumReached) observations.push(`Relació observada: ${pattern.text}`);
  const trend = relevantTrend(intel, section);
  if (trend && intel.dataQuality.minimumReached) observations.push(`Tendència: ${trend.label} ${trend.direction}.`);

  return { observations: observations.slice(0,4), evidence };
}

export function sectionalIntelligenceHtml(matrix, intel, { title="Anàlisi intel·ligent per apartats" }={}) {
  const totalDays=Object.keys(matrix).length;
  return `
    <section class="dashboard-section-analysis" aria-labelledby="section-analysis-title">
      <div class="section-analysis-heading">
        <div><span class="view-eyebrow">Lectura per àmbits</span><h2 class="card-title" id="section-analysis-title">${escapeHtml(title)}</h2></div>
        <span class="badge">${totalDays} dies analitzats</span>
      </div>
      <p class="section-analysis-intro">Cada fitxa resumeix només les dades registrades en aquell àmbit. Les relacions i tendències només apareixen quan el motor disposa de prou informació.</p>
      <div class="section-analysis-grid">
        ${SECTIONAL_ANALYSIS.map(section=>{
          const result=sectionObservations(section,matrix,intel);
          const enough=result.evidence>=3 || (section.key==="cycle" && result.observations.length);
          const body=enough && result.observations.length
            ? `<ul>${result.observations.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : `<p class="section-analysis-empty">Encara no hi ha prou dades d’aquest apartat per generar una anàlisi útil.</p>`;
          return `<article class="section-analysis-card tone-${section.tone}">
            <div class="section-analysis-card-head"><span class="section-analysis-icon" aria-hidden="true">${section.icon}</span><div><h3>${escapeHtml(section.title)}</h3><small>${result.evidence ? `${result.evidence} registres o dies rellevants` : "En fase d’aprenentatge"}</small></div></div>
            ${body}
          </article>`;
        }).join("")}
      </div>
      <p class="section-analysis-note">Aquestes observacions descriuen el teu historial i no són diagnòstics ni demostren causalitat.</p>
    </section>`;
}
