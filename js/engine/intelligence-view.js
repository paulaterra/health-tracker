import { escapeHtml, formatDate } from "../utils/dom.js";

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
  const items = cycle.hypotheses || [];
  const visible = compact ? items.filter(item => item.status === "detected").slice(0, 2) : items;
  return `
    <h3 style="margin:var(--sp-4) 0 var(--sp-2);font-size:var(--fs-sm);">Patrons segons la fase del cicle</h3>
    <div class="event-row" style="background:var(--paper-alt);margin-bottom:8px;"><div class="event-tags">${escapeHtml(cycle.summary)}</div></div>
    ${visible.length ? `<div class="event-list">${visible.map(item => `
      <div class="event-row">
        <div class="event-row-top"><strong>${escapeHtml(item.title)}</strong><span class="badge">${escapeHtml(item.confidence)}</span></div>
        <div class="event-comment">${escapeHtml(item.text)}</div>
      </div>`).join("")}</div>` : compact ? "" : `<p class="ledger-empty">Continua registrant el cicle, el son, el dolor i el digestiu per veure aquestes hipòtesis.</p>`}
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
