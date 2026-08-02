import { buildDailyMatrix } from "../../engine/normalizer.js";
import { computeCorrelations } from "../../engine/correlation.js";
import { classifyConclusions } from "../../engine/conclusions.js";
import { escapeHtml } from "../../utils/dom.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml, recommendationsHtml } from "../../engine/intelligence-view.js";

export async function renderConclusions(container) {
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Conclusions i recomanacions</h1>
      <p class="view-sub">L'app genera aquestes hipòtesis sola, a partir dels patrons detectats a les teves dades — no cal que n'escriguis cap. Classifica cada relació com a possible factor desencadenant o protector, i hi afegeix una recomanació pràctica.</p>
    </div>
    <div class="card" id="conclusions-wrap"><p class="ledger-empty">Calculant…</p></div>
  `;

  const [matrix, intel] = await Promise.all([buildDailyMatrix(), generateIntelligence()]);
  const numDays = Object.keys(matrix).length;
  const correlations = computeCorrelations(matrix);
  const { triggers, protectors } = classifyConclusions(correlations);

  const wrap = container.querySelector("#conclusions-wrap");

  if (numDays < 14) {
    wrap.innerHTML = emptyState(`Encara tens poques dades (${numDays} dia${numDays === 1 ? "" : "s"}). Amb almenys 14 dies de registre constant, l'app ja podrà proposar les primeres conclusions.`);
    return;
  }

  if (triggers.length === 0 && protectors.length === 0) {
    wrap.innerHTML = emptyState(`Amb ${numDays} dies de dades, encara no hi ha prou relacions consistents com per treure conclusions. Segueix registrant i torna-hi més endavant.`);
    return;
  }

  wrap.outerHTML = `
    ${intelligentSummaryHtml(intel, { title: "Conclusió global" })}
    ${recommendationsHtml(intel)}
    <div style="height:var(--sp-5)"></div>
    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: var(--sp-4);">
      <p style="font-size: var(--fs-sm); color: var(--ink-soft);">${numDays} dies amb dades · ${triggers.length} possibles desencadenants · ${protectors.length} possibles factors protectors.</p>
      <button class="btn btn-ghost" id="recalc-btn">Torna a calcular</button>
    </div>

    ${section("Possibles factors desencadenants", "var(--clay)",
      "Coses que, a les teves dades, semblen coincidir amb un empitjorament.",
      triggers.length ? triggers.slice(0, 12).map(conclusionCard).join("") : `<p class="ledger-empty">Cap detectat encara.</p>`)}

    ${section("Possibles factors protectors", "var(--sage)",
      "Coses que, a les teves dades, semblen coincidir amb una millora.",
      protectors.length ? protectors.slice(0, 12).map(conclusionCard).join("") : `<p class="ledger-empty">Cap detectat encara.</p>`)}
  `;

  container.querySelector("#recalc-btn")?.addEventListener("click", () => renderConclusions(container));
}

function section(title, color, sub, bodyHtml) {
  return `
    <div style="margin-bottom: var(--sp-6);">
      <h2 style="font-family: var(--font-display); font-size: var(--fs-md); margin-bottom: var(--sp-1); color: ${color};">${title}</h2>
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

function conclusionCard(p) {
  const condLower = p.predictorType === "boolean"
    ? p.predictorLabel.toLowerCase()
    : `${p.predictorLabel.toLowerCase()} alt (≥6/10)`;

  const kindColor = p.kind === "trigger" ? "var(--clay)" : "var(--sage)";
  const kindLabel = p.kind === "trigger" ? "Hipòtesi: desencadenant" : "Hipòtesi: protector";

  const timing = p.lag >= 0
    ? `${humanCond(condLower)} <span style="color: var(--ink-faint); font-weight: 400;">(${p.lagLabel})</span>`
    : `<strong>${p.lagLabel}</strong> de tenir <strong>${escapeHtml(condLower)}</strong>`;

  let outcomeSentence;
  if (p.outcomeType === "numeric") {
    const { meanA, meanB } = p.effect;
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} passa de mitjana de ${meanB.toFixed(1)} a ${meanA.toFixed(1)} (escala 0-10).`;
  } else {
    const { rateA, rateB } = p.effect;
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} passa de ${(rateB * 100).toFixed(0)}% a ${(rateA * 100).toFixed(0)}% dels dies.`;
  }

  return `
    <div class="card" style="border-left: 3px solid ${kindColor};">
      <span class="badge" style="background: transparent; color: ${kindColor}; padding-left:0;">${kindLabel}</span>
      <p style="margin: var(--sp-1) 0 0; font-size: var(--fs-md); font-weight: 600;">${timing}</p>
      <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">${outcomeSentence}</p>
      <p style="margin: var(--sp-3) 0 0; font-size: var(--fs-sm); color: ${kindColor};">💡 ${escapeHtml(p.recommendation)}</p>
      <p style="margin: var(--sp-2) 0 0; font-size: var(--fs-xs); color: var(--ink-faint); font-style: italic;">
        Basat en ${p.nA + p.nB} dies (n=${p.nA} vs n=${p.nB}) · confiança ${p.confidence.label}. Correlació, no diagnòstic.
      </p>
    </div>
  `;
}

function humanCond(condLower) {
  return `Quan hi ha <strong>${escapeHtml(condLower)}</strong>`;
}
