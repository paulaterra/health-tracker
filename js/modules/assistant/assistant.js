import { buildDailyMatrix } from "../../engine/normalizer.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { answerHealthQuestion } from "../../engine/personal-insights.js";
import { escapeHtml } from "../../utils/dom.js";

const SUGGESTIONS=[
  "Com ha estat el mal d’esquena aquest mes?",
  "El dolor té relació amb el cicle?",
  "Quants episodis de diarrea he tingut els últims 30 dies?",
  "Com ha evolucionat la qualitat del son aquesta setmana?",
  "Quan apareixen més brots de pell?",
  "Quins factors coincideixen amb dies pitjors?",
];
function answerHtml(answer){
  return `<div class="assistant-answer"><span class="view-eyebrow">Resposta basada en les teves dades</span><h2 class="card-title">${escapeHtml(answer.title)}</h2><p>${escapeHtml(answer.text)}</p>${answer.evidence?.length?`<div class="event-list">${answer.evidence.map(x=>`<div class="event-row"><div class="event-tags">${escapeHtml(x)}</div></div>`).join("")}</div>`:""}<p class="analysis-disclaimer">No utilitza internet ni substitueix una valoració mèdica.</p></div>`;
}
export async function renderAssistant(container){
  container.innerHTML=`<div class="view-header"><span class="view-eyebrow">IA local</span><h1 class="view-title">Pregunta a Paula Tracker</h1><p class="view-sub">Respostes calculades exclusivament a partir del teu historial. Pots concretar símptoma, zona i període per obtenir més precisió.</p></div><div class="card"><p class="ledger-empty">Preparant les dades…</p></div>`;
  const [matrix,intel]=await Promise.all([buildDailyMatrix(),generateIntelligence()]);
  container.innerHTML=`
    <div class="view-header"><span class="view-eyebrow">IA local</span><h1 class="view-title">Pregunta a Paula Tracker</h1><p class="view-sub">Respostes calculades exclusivament a partir del teu historial. Pots concretar símptoma, zona i període per obtenir més precisió.</p></div>
    <section class="card assistant-query-card">
      <label class="field-label" for="health-question">Què vols saber?</label>
      <div class="assistant-query-row"><input id="health-question" type="text" placeholder="Ex.: com ha estat el mal d’esquena aquest mes?"><button id="ask-health" class="btn btn-primary" type="button">Analitza</button></div>
      <div class="assistant-suggestions">${SUGGESTIONS.map(q=>`<button type="button" data-question="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("")}</div>
    </section>
    <section id="assistant-result" class="card" aria-live="polite">${answerHtml(answerHealthQuestion("",matrix,intel))}</section>`;
  const input=container.querySelector("#health-question");
  const result=container.querySelector("#assistant-result");
  const run=()=>{ result.innerHTML=answerHtml(answerHealthQuestion(input.value,matrix,intel)); };
  container.querySelector("#ask-health").addEventListener("click",run);
  input.addEventListener("keydown",e=>{ if(e.key==="Enter")run(); });
  container.querySelectorAll("[data-question]").forEach(btn=>btn.addEventListener("click",()=>{input.value=btn.dataset.question;run();}));
}
