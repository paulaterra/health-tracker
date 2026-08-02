import { escapeHtml } from "../utils/dom.js";

export function intelligentSummaryHtml(intel, { compact = false, title = "Resum intel·ligent" } = {}) {
  const confidence = intel.dataQuality.level;
  const patternItems = intel.patterns.slice(0, compact ? 2 : 5);
  const conclusionItems = intel.conclusions.slice(0, compact ? 2 : 6);
  return `
    <div class="card intelligent-summary" style="border-left:3px solid var(--sage);">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;">
        <div><h2 class="card-title">${escapeHtml(title)}</h2><p style="margin:0;color:var(--ink-soft);font-size:var(--fs-sm);">${intel.period.days} dies analitzats · ${intel.dataQuality.painRecords} registres de dolor</p></div>
        <span class="badge">confiança ${escapeHtml(confidence)}</span>
      </div>
      ${intel.pain.summary.length ? `<div class="event-list" style="margin-top:var(--sp-3);">${intel.pain.summary.slice(0, compact ? 3 : 6).map(x=>`<div class="event-row"><div class="event-tags">${escapeHtml(x)}</div></div>`).join("")}</div>` : `<p class="ledger-empty">Encara no hi ha prou registres de dolor.</p>`}
      ${patternItems.length ? `<h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Relacions destacades</h3><div class="event-list">${patternItems.map(p=>`<div class="event-row"><div class="event-tags">${escapeHtml(p.text)} · confiança ${escapeHtml(p.confidence.label)}</div></div>`).join("")}</div>` : ""}
      ${!compact && conclusionItems.length ? `<h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Hipòtesis principals</h3><div class="event-list">${conclusionItems.map(c=>`<div class="event-row"><div class="event-tags"><strong>${c.kind === "trigger" ? "Possible desencadenant" : "Possible protector"}:</strong> ${escapeHtml(c.text)}</div></div>`).join("")}</div>` : ""}
      <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);font-style:italic;">Associacions observades a les teves dades; no demostren causalitat ni substitueixen una valoració mèdica.</p>
    </div>`;
}

export function recommendationsHtml(intel, title = "Recomanacions de seguiment") {
  if (!intel.recommendations.length) return "";
  return `<div class="card" style="margin-top:var(--sp-5);"><h2 class="card-title">${escapeHtml(title)}</h2><div class="event-list">${intel.recommendations.map(r=>`<div class="event-row"><div class="event-tags">${escapeHtml(r)}</div></div>`).join("")}</div></div>`;
}
