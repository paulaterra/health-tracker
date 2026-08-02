import { buildDailyMatrix } from "../../engine/normalizer.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "../../engine/correlation.js";
import { escapeHtml } from "../../utils/dom.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml } from "../../engine/intelligence-view.js";

export async function renderPatterns(container) {
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Patrons detectats</h1>
      <p class="view-sub">El motor busca relacions entre variables (diàries, setmanals fins a mensuals — de -30 a +30 dies), ritmes segons el dia de la setmana, i tendències generals al llarg del temps.</p>
    </div>
    <div class="card" id="patterns-wrap">
      <p class="ledger-empty">Calculant…</p>
    </div>
  `;

  const [matrix, intel] = await Promise.all([buildDailyMatrix(), generateIntelligence()]);
  const numDays = Object.keys(matrix).length;
  const correlations = computeCorrelations(matrix);
  const dowPatterns = computeDayOfWeekPatterns(matrix);
  const trends = computeTrends(matrix);

  const wrap = container.querySelector("#patterns-wrap");

  if (numDays < 14) {
    wrap.innerHTML = emptyState(`Encara tens poques dades (${numDays} dia${numDays === 1 ? "" : "s"} amb algun registre). Amb almenys 14 dies de registre constant, el motor podrà començar a trobar relacions fiables.`);
    return;
  }

  const totalFound = correlations.length + dowPatterns.length + trends.length;
  if (totalFound === 0) {
    wrap.innerHTML = emptyState(`Amb ${numDays} dies de dades, encara no s'ha trobat cap relació prou consistent com per mostrar-la. Això és normal a l'inici — segueix registrant i torna-hi més endavant.`);
    return;
  }

  wrap.outerHTML = `
    ${intelligentSummaryHtml(intel, { title: "Visió conjunta del dolor i la resta de variables" })}
    <div style="height:var(--sp-5)"></div>
    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: var(--sp-4);">
      <p style="font-size: var(--fs-sm); color: var(--ink-soft);">${numDays} dies amb dades · ${totalFound} patrons trobats en total.</p>
      <button class="btn btn-ghost" id="recalc-btn">Torna a calcular</button>
    </div>

    ${section("Relacions entre variables (diàries a mensuals)",
      "Compara dies amb i sense una variable, mirant des de 30 dies abans fins a 30 dies després.",
      correlations.length
        ? correlations.slice(0, 20).map(correlationCard).join("")
        : `<p class="ledger-empty">Encara no n'hi ha prou per aquesta categoria.</p>`)}

    ${section("Ritmes setmanals",
      "Dies de la setmana en què una variable sol ser sistemàticament més alta o més baixa que la mitjana.",
      dowPatterns.length
        ? dowPatterns.slice(0, 12).map(dowCard).join("")
        : `<p class="ledger-empty">Encara no n'hi ha prou per aquesta categoria.</p>`)}

    ${section("Tendències generals",
      "Compara la primera meitat del període registrat amb la segona, per veure si alguna cosa millora o empitjora amb el temps.",
      trends.length
        ? trends.slice(0, 12).map(trendCard).join("")
        : `<p class="ledger-empty">Encara no n'hi ha prou per aquesta categoria.</p>`)}
  `;

  container.querySelector("#recalc-btn")?.addEventListener("click", () => renderPatterns(container));
}

function section(title, sub, bodyHtml) {
  return `
    <div style="margin-bottom: var(--sp-6);">
      <h2 style="font-family: var(--font-display); font-size: var(--fs-md); margin-bottom: var(--sp-1);">${title}</h2>
      <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin: 0 0 var(--sp-3);">${sub}</p>
      <div style="display:flex; flex-direction:column; gap: var(--sp-3);">${bodyHtml}</div>
    </div>
  `;
}

function emptyState(message) {
  return `
    <div class="empty-state">
      <div class="emoji-mark">···</div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function confidenceBadge(label) {
  const cls = label === "alta" ? "badge-high" : label === "moderada" ? "badge-mid" : "";
  return `<span class="badge ${cls}">confiança ${label}</span>`;
}

function disclaimer() {
  return `<p style="margin: var(--sp-2) 0 0; font-size: var(--fs-xs); color: var(--ink-faint); font-style: italic;">Correlació observada a les teves dades, no un diagnòstic. Útil per comentar-ho amb el metge.</p>`;
}

function correlationCard(p) {
  const condLower = p.predictorType === "boolean"
    ? p.predictorLabel.toLowerCase()
    : `${p.predictorLabel.toLowerCase()} alt (≥6/10)`;

  const headline = p.lag >= 0
    ? `Quan hi ha <strong>${escapeHtml(condLower)}</strong> <span style="color: var(--ink-faint); font-weight: 400;">(${humanLagLabel(p.lag)})</span>`
    : `<strong>${humanLagLabel(p.lag)}</strong> de tenir <strong>${escapeHtml(condLower)}</strong>`;

  let outcomeSentence, barA, barB;
  if (p.outcomeType === "numeric") {
    const { meanA, meanB } = p.effect;
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} ${p.direction} de mitjana: de ${meanB.toFixed(1)} a ${meanA.toFixed(1)} (escala 0-10).`;
    barA = Math.min(100, (meanA / 10) * 100);
    barB = Math.min(100, (meanB / 10) * 100);
  } else {
    const { rateA, rateB } = p.effect;
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} ${p.direction}: passa de ${(rateB * 100).toFixed(0)}% a ${(rateA * 100).toFixed(0)}% dels dies.`;
    barA = rateA * 100;
    barB = rateB * 100;
  }

  return `
    <div class="card">
      <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: var(--sp-3);">
        <div>
          <p style="margin:0; font-size: var(--fs-md); font-weight: 600;">${headline}</p>
          <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">${outcomeSentence}</p>
        </div>
        ${confidenceBadge(p.confidence.label)}
      </div>
      <div style="margin-top: var(--sp-4); display:flex; flex-direction:column; gap: var(--sp-2);">
        <div>
          <div style="font-size: var(--fs-xs); color: var(--ink-faint);">Grup A (n=${p.nA})</div>
          <div style="background: var(--paper-alt); border-radius: 4px; height: 10px; overflow: hidden;">
            <div style="background: var(--clay); height: 100%; width: ${barA}%;"></div>
          </div>
        </div>
        <div>
          <div style="font-size: var(--fs-xs); color: var(--ink-faint);">Grup B (n=${p.nB})</div>
          <div style="background: var(--paper-alt); border-radius: 4px; height: 10px; overflow: hidden;">
            <div style="background: var(--sage); height: 100%; width: ${barB}%;"></div>
          </div>
        </div>
      </div>
      ${disclaimer()}
    </div>
  `;
}

function dowCard(p) {
  const valueText = p.type === "boolean"
    ? `${(p.groupMean * 100).toFixed(0)}% dels dies (mitjana general: ${(p.overallMean * 100).toFixed(0)}%)`
    : `${p.groupMean.toFixed(1)}/10 (mitjana general: ${p.overallMean.toFixed(1)}/10)`;
  return `
    <div class="card">
      <p style="margin:0; font-size: var(--fs-md); font-weight: 600;">
        Els <strong>${p.dowName}</strong>, ${escapeHtml(p.label.toLowerCase())} sol ser ${p.direction}
        <span style="color: var(--ink-faint); font-weight: 400;">(n=${p.n})</span>
      </p>
      <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">${valueText}</p>
      ${disclaimer()}
    </div>
  `;
}

function trendCard(t) {
  const valueText = t.type === "boolean"
    ? `de ${(t.firstMean * 100).toFixed(0)}% a ${(t.secondMean * 100).toFixed(0)}% dels dies`
    : `de ${t.firstMean.toFixed(1)} a ${t.secondMean.toFixed(1)} (escala 0-10)`;
  return `
    <div class="card">
      <p style="margin:0; font-size: var(--fs-md); font-weight: 600;">
        ${escapeHtml(t.label)} està <strong>${t.direction}</strong>
        <span style="color: var(--ink-faint); font-weight: 400;">(primera meitat n=${t.nFirst}, segona n=${t.nSecond})</span>
      </p>
      <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">Ha passat ${valueText} entre la primera i la segona meitat del període registrat.</p>
      ${disclaimer()}
    </div>
  `;
}
