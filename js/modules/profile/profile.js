import { buildDailyMatrix } from "../../engine/normalizer.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { buildPersonalProfile, buildPredictions } from "../../engine/personal-insights.js";
import { escapeHtml } from "../../utils/dom.js";


const PROFILE_SCORE_SCALES = [
  ["Dolor corporal", "sense dolor", "molt dolor"],
  ["Mal de cap", "sense dolor", "molt intens"],
  ["Vertígens i boira mental", "cap símptoma", "molt intens"],
  ["Digestiu", "cap molèstia", "molt intens"],
  ["Mal descans", "descans reparador", "mal descans"],
  ["Cansament físic", "molta energia", "esgotament"],
  ["Pell", "sense molèsties", "molt intens"],
];

function profileScoreReferencesHtml(){
  return `<section class="card profile-scale-reference">
    <h2 class="card-title">Com interpretar les puntuacions</h2>
    <p style="margin:0 0 var(--sp-3); color:var(--ink-soft); font-size:var(--fs-sm);">A totes les escales de símptomes, 0 representa el millor estat i 10 el pitjor.</p>
    <div class="day-score-guide is-multiple" style="margin:0;">
      ${PROFILE_SCORE_SCALES.map(([label, low, high]) => `<div class="day-score-guide-row">
        <span class="day-score-guide-label">${escapeHtml(label)}</span>
        <div class="day-score-guide-scale" aria-label="Escala ${escapeHtml(label)}: 0 ${escapeHtml(low)}, 10 ${escapeHtml(high)}">
          <span><b>0</b> ${escapeHtml(low)}</span><i aria-hidden="true"></i><span><b>10</b> ${escapeHtml(high)}</span>
        </div>
      </div>`).join("")}
    </div>
  </section>`;
}

function valueCard(label,value,help=""){
  return `<div class="profile-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${help?`<small>${escapeHtml(help)}</small>`:""}</div>`;
}
function patternList(items,empty){
  return items.length?`<div class="event-list">${items.map(x=>`<div class="event-row"><div class="event-tags">${escapeHtml(x)}</div></div>`).join("")}</div>`:`<p class="ledger-empty">${escapeHtml(empty)}</p>`;
}
export async function renderProfile(container){
  container.innerHTML=`<div class="view-header"><span class="view-eyebrow">Perfil personal</span><h1 class="view-title">El meu cos</h1><p class="view-sub">Un resum viu que es va refinant a mesura que registres dades.</p></div><div class="card"><p class="ledger-empty">Calculant el teu perfil…</p></div>`;
  const [matrix,intel]=await Promise.all([buildDailyMatrix(),generateIntelligence()]);
  const p=buildPersonalProfile(matrix,intel);
  const pred=buildPredictions(matrix,intel);
  container.innerHTML=`
    <div class="view-header"><span class="view-eyebrow">Perfil personal</span><h1 class="view-title">El meu cos</h1><p class="view-sub">Un resum viu que es va refinant a mesura que registres dades.</p></div>
    <div class="profile-hero card">
      <div><span class="view-eyebrow">${p.days} dies analitzats</span><h2 class="card-title">El teu perfil actual</h2><p>Confiança global: <strong>${escapeHtml(p.confidence)}</strong></p></div>
      <div class="profile-stat-grid">
        ${valueCard("Dolor habitual",p.pain.average==null?"—":`${p.pain.average.toFixed(1)}/10`,`${p.pain.count} registres`)}
        ${valueCard("Zona principal",p.pain.mainZone||"Encara no detectada")}
        ${valueCard("Mal descans",p.sleep.quality==null?"—":`${p.sleep.quality.toFixed(1)}/10`)}
        ${valueCard("Energia",p.energy==null?"—":`${p.energy.toFixed(1)}/10`)}
      </div>
    </div>
    ${profileScoreReferencesHtml()}
    <div class="grid-2 profile-grid">
      <section class="card"><h2 class="card-title">Dolor</h2>${patternList([
        p.pain.mainZone?`Zona més repetida: ${p.pain.mainZone}.`:null,
        p.pain.mainType?`Tipus més habitual: ${p.pain.mainType}.`:null,
        p.pain.sleepAffected?`Ha interferit amb el son en ${p.pain.sleepAffected} registres.`:null,
        p.mainTrigger?`Possible desencadenant: ${p.mainTrigger}`:null,
      ].filter(Boolean),"Encara no hi ha prou registres de dolor.")}</section>
      <section class="card"><h2 class="card-title">Son i energia</h2>${patternList([
        p.sleep.quality!=null?`Qualitat mitjana: ${p.sleep.quality.toFixed(1)}/10.`:null,
        p.sleep.awakenings!=null?`Mitjana de despertars: ${p.sleep.awakenings.toFixed(1)}.`:null,
        p.energy!=null?`Cansament físic mitjà: ${p.energy.toFixed(1)}/10.`:null,
      ].filter(Boolean),"Encara falten registres de son i energia.")}</section>
      <section class="card"><h2 class="card-title">Digestiu i cicle</h2>${patternList([
        `Diarrea en el ${(p.digestion.diarrheaRate*100).toFixed(0)}% dels dies amb dades.`,
        p.digestion.bloating!=null?`Inflor mitjana: ${p.digestion.bloating.toFixed(1)}/10.`:null,
        ...p.cyclePatterns,
      ].filter(Boolean),"Encara no hi ha prou dades digestives o del cicle.")}</section>
      <section class="card"><h2 class="card-title">Factors protectors</h2>${patternList(p.mainProtector?[p.mainProtector]:[],"Encara no s'ha detectat cap factor protector consistent.")}</section>
    </div>
    <section class="card prediction-panel"><h2 class="card-title">Mirada als pròxims dies</h2><p>${escapeHtml(pred.note)}</p>${pred.phases.length?`<p><strong>Fase prevista:</strong> ${pred.phases.map(escapeHtml).join(", ")}</p>`:""}${patternList(pred.items.map(x=>`${x.label} · confiança ${x.confidence}`),"No hi ha cap predicció prou sòlida ara mateix.")}</section>
    <p class="analysis-disclaimer">Aquest perfil descriu associacions del teu historial. No és un diagnòstic ni una predicció mèdica.</p>`;
}
