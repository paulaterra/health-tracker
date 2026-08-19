import { buildDailyMatrix } from "../../engine/normalizer.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "../../engine/correlation.js";
import { escapeHtml, formatDate } from "../../utils/dom.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml } from "../../engine/intelligence-view.js";

export async function renderPatterns(container) {
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Patrons detectats</h1>
      <p class="view-sub">El motor actual només mostra relacions que es repeteixen i que es poden justificar amb les dades. Separa coincidències entre símptomes, possibles factors previs, brots multisimptomàtics i patrons del cicle. Si no hi ha prou evidència, no mostra cap patró.</p>
    </div>
    <div class="card" id="patterns-wrap">
      <p class="ledger-empty">Calculant…</p>
    </div>
  `;

  const [matrix, intel] = await Promise.all([buildDailyMatrix(), generateIntelligence()]);
  const numDays = Object.keys(matrix).length;
  const correlations = computeCorrelations(matrix);
  const coincidences = correlations.filter(p => p.relationType === "coincidencia");
  const sequences = correlations.filter(p => p.relationType === "sequencia");
  const dowPatterns = computeDayOfWeekPatterns(matrix);
  const trends = computeTrends(matrix);

  const wrap = container.querySelector("#patterns-wrap");

  if (numDays < 14) {
    wrap.innerHTML = emptyState(`Encara tens poques dades (${numDays} dia${numDays === 1 ? "" : "s"} amb algun registre). Amb almenys 14 dies de registre constant, el motor podrà començar a trobar relacions fiables.`);
    return;
  }

  const temporal = intel.temporal || {};
  const totalFound = correlations.length + dowPatterns.length + trends.length + (intel.flares?.length || 0) + (intel.cycle?.hypotheses?.length || 0)
    + (temporal.recurrentEpisodes?.length || 0) + (temporal.rhythms?.length || 0) + (temporal.weeklySignals?.length || 0)
    + (temporal.coEvolution?.length || 0) + (temporal.longTermTrends?.length || 0);
  if (totalFound === 0) {
    wrap.innerHTML = emptyState(`Amb ${numDays} dies de dades, encara no s'ha trobat cap relació prou consistent com per mostrar-la. Això és normal a l'inici — segueix registrant i torna-hi més endavant.`);
    return;
  }

  wrap.outerHTML = `
    ${intelligentSummaryHtml(intel, { title: "Visió conjunta del dolor i la resta de variables" })}
    <div style="height:var(--sp-5)"></div>
    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: var(--sp-4);">
      <p style="font-size: var(--fs-sm); color: var(--ink-soft);">${numDays} dies amb dades · ${totalFound} senyals o patrons trobats en total.</p>
      <button class="btn btn-ghost" id="recalc-btn">Torna a calcular</button>
    </div>

    ${section("Episodis i brots",
      "Agrupa dies consecutius amb el mateix símptoma per entendre si formen un únic episodi. També mostra brots multisimptomàtics quan diversos àmbits empitjoren alhora.",
      temporalEpisodesHtml(temporal.recurrentEpisodes || [], intel.flares || []))}

    ${section("Ritmes temporals · dies, setmanes i mesos",
      "Busca separacions recurrents entre episodis i setmanes amb una càrrega simptomàtica diferent de l'habitual. No força cap periodicitat si encara no hi ha prou repeticions.",
      temporalRhythmsHtml(temporal.rhythms || [], temporal.weeklySignals || []))}

    ${section("Patrons del cicle menstrual",
      "Analitza el moment dels símptomes respecte a menstruacions reals registrades. Només compara cicles complets; un cicle obert no compta com a repetició.",
      cyclePatternsHtml(intel.cycle))}

    ${section("Símptomes que evolucionen junts",
      "Compara l'evolució entre setmanes. És diferent d'una coincidència puntual: busca si dos àmbits tendeixen a pujar i baixar junts al llarg del temps.",
      (temporal.coEvolution || []).length
        ? temporal.coEvolution.map(coEvolutionCard).join("")
        : `<p class="ledger-empty">Encara no hi ha prou setmanes comparables per detectar àmbits que evolucionin junts. Normalment calen almenys 4 setmanes amb variació real.</p>`)}

    ${section("Tendències a llarg termini",
      "Busca canvis sostinguts al llarg de setmanes o mesos, no només diferències entre uns quants dies.",
      (temporal.longTermTrends || []).length
        ? temporal.longTermTrends.map(longTermCard).join("")
        : `<p class="ledger-empty">Encara no hi ha prou historial per parlar de tendències a llarg termini. Aquest apartat guanyarà valor quan hi hagi diverses setmanes o mesos de dades.</p>`)}

    ${section("Símptomes que tendeixen a aparèixer junts",
      "Coincidències del mateix dia entre àmbits diferents. No són causes ni desencadenants.",
      coincidences.length
        ? coincidences.slice(0, 8).map(correlationCard).join("")
        : `<p class="ledger-empty">Encara no hi ha coincidències prou repetides per mostrar.</p>`)}

    ${section("Seqüències temporals",
      "Canvis que apareixen 1–3 dies després d'una altra variable. Només es mostren quan la diferència és clara i repetida.",
      sequences.length
        ? sequences.slice(0, 8).map(correlationCard).join("")
        : `<p class="ledger-empty">Encara no hi ha seqüències prou consistents per mostrar.</p>`)}

    ${section("Ritmes setmanals",
      "Dies de la setmana en què una variable sol ser sistemàticament més alta o més baixa que la mitjana.",
      dowPatterns.length
        ? dowPatterns.slice(0, 12).map(dowCard).join("")
        : `<p class="ledger-empty">Encara no s’ha detectat cap ritme setmanal prou consistent. S’omplirà automàticament quan un mateix dia de la setmana presenti una diferència repetida respecte de la teva mitjana.</p>`)}

    ${section("Tendències generals",
      "Compara la primera meitat del període registrat amb la segona, per veure si alguna cosa millora o empitjora amb el temps.",
      trends.length
        ? trends.slice(0, 12).map(trendCard).join("")
        : `<p class="ledger-empty">Encara no hi ha cap tendència temporal prou clara. S’omplirà quan la segona part de l’historial mostri una millora o empitjorament consistent respecte de la primera.</p>`)}
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

function temporalEpisodesHtml(episodes, flares) {
  const items = [];
  episodes.slice(0,6).forEach(item => {
    const latest = item.episodes?.at(-1);
    const duration = item.avgDuration != null ? item.avgDuration.toFixed(1) : "—";
    const separation = item.episodeCount >= 2 && item.avgGap != null
      ? ` · separació mitjana entre inicis ${Math.round(item.avgGap)} dies`
      : "";
    items.push(`
      <div class="card">
        <p style="margin:0;font-size:var(--fs-md);font-weight:600;">${escapeHtml(item.label)} · ${item.episodeCount} episodi${item.episodeCount===1?"":"s"}</p>
        <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${item.totalActiveDays} dies afectats · durada habitual ${duration} dies · episodi més llarg ${item.maxDuration} dies${separation}.</p>
        ${latest ? `<p style="margin:var(--sp-1) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">Últim episodi: ${escapeHtml(formatDate(latest.start))}${latest.end!==latest.start?` — ${escapeHtml(formatDate(latest.end))}`:""} · ${latest.days} dies.</p>` : ""}
      </div>`);
  });
  flares.slice(0,4).forEach(f => {
    items.push(`
      <div class="card" style="border-left:3px solid var(--clay);">
        <p style="margin:0;font-size:var(--fs-md);font-weight:600;">Brot multisimptomàtic · ${escapeHtml(formatDate(f.start))}${f.end!==f.start?` — ${escapeHtml(formatDate(f.end))}`:""}</p>
        <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${f.days} dies · fins a ${f.maxDomains} àmbits alterats alhora · intensitat ${escapeHtml(f.severity)}.</p>
        <p style="margin:var(--sp-1) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">Àmbits: ${f.categories.slice(0,5).map(c=>escapeHtml(c.label)).join(", ")}.</p>
      </div>`);
  });
  return items.length ? items.join("") : `<p class="ledger-empty">Encara no hi ha prou dies consecutius per identificar episodis o brots amb continuïtat.</p>`;
}

function temporalRhythmsHtml(rhythms, weeklySignals) {
  const parts=[];
  rhythms.slice(0,5).forEach(r=>parts.push(`
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;">
        <div><p style="margin:0;font-size:var(--fs-md);font-weight:600;">${escapeHtml(r.label)} · possible ritme recurrent</p>
        <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${escapeHtml(r.text)}</p></div>
        <span class="badge">${escapeHtml(r.confidence)}</span>
      </div>
      <p style="margin:var(--sp-2) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);font-style:italic;">És una regularitat temporal observada; no implica que l'episodi hagi de repetir-se amb aquesta periodicitat.</p>
    </div>`));
  weeklySignals.slice(0,5).forEach(w=>parts.push(`
    <div class="card">
      <p style="margin:0;font-size:var(--fs-md);font-weight:600;">Canvi setmanal · ${w.type==="global"?"càrrega global":escapeHtml(w.domain)}</p>
      <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${escapeHtml(w.text)}</p>
    </div>`));
  return parts.length ? parts.join("") : `<p class="ledger-empty">Encara no s'ha detectat cap ritme temporal prou repetit. Les periodicitats necessiten almenys 3 episodis; les comparacions setmanals necessiten diverses setmanes amb dades.</p>`;
}

function cyclePatternsHtml(cycle) {
  if (!cycle) return `<p class="ledger-empty">Encara no hi ha dades del cicle disponibles.</p>`;
  const hypotheses=cycle.hypotheses || [];
  if (!cycle.analysisAvailable || !hypotheses.length) return `<div class="card"><p style="margin:0;color:var(--ink-soft);">${escapeHtml(cycle.summary)}</p></div>`;
  const top=hypotheses[0];
  return `<div class="card"><p style="margin:0;color:var(--ink-soft);">${escapeHtml(cycle.summary)}</p></div>${cycleTimelineHtml(top)}` + hypotheses.slice(0,6).map(item=>`
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;">
        <div><p style="margin:0;font-size:var(--fs-md);font-weight:600;">${escapeHtml(item.title)}</p><p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${escapeHtml(item.text)}</p><p style="margin:var(--sp-2) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">${escapeHtml(item.sourceNote||'')} · confiança ${escapeHtml(item.confidence||'preliminar')}</p></div>
        <span class="badge">${item.status==="recurrent"?"patró recurrent":item.status==="emerging"?"patró emergent":"senyal inicial"}</span>
      </div>
    </div>`).join("");
}

function cycleTimelineHtml(item){
  if(!item) return '';
  const isPeriod=item.window==='perimenstrual'||item.window==='menstrual';
  const min=isPeriod?-7:-7, max=isPeriod?5:14;
  const windowMap={periovulatory:[-2,3],early_luteal:[4,8],mid_luteal:[9,12],perimenstrual:[-5,2],menstrual:[0,4]};
  const [a,b]=windowMap[item.window]||[0,0];
  const cells=[];
  for(let d=min;d<=max;d++){
    const active=d>=a&&d<=b;
    cells.push(`<div title="${d===0?(isPeriod?'Inici de regla':'Ovulació estimada'):`${d>0?'+':''}${d} dies`}" style="height:34px;border-radius:8px;background:${active?'var(--sage-bg)':'var(--paper-alt)'};border:${d===0?'2px solid var(--sage)':'1px solid var(--line)'};display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--ink-faint);">${d===0?'0':d}</div>`);
  }
  return `<div class="card"><p style="margin:0 0 var(--sp-2);font-size:var(--fs-sm);font-weight:600;">On es concentra el senyal principal</p><div style="display:grid;grid-template-columns:repeat(${max-min+1},minmax(16px,1fr));gap:3px;overflow:auto;">${cells.join('')}</div><p style="margin:var(--sp-2) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">La banda marcada correspon a ${escapeHtml(item.windowLabel)}. ${isPeriod?'Dia 0 = inici de menstruació.':'Dia 0 = ovulació situada o estimada.'} No és una predicció de risc clínic; resumeix on s’ha concentrat el patró registrat.</p></div>`;
}

function coEvolutionCard(item) {
  return `
    <div class="card">
      <p style="margin:0;font-size:var(--fs-md);font-weight:600;">${escapeHtml(item.a)} + ${escapeHtml(item.b)}</p>
      <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${escapeHtml(item.text)}</p>
      <p style="margin:var(--sp-2) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);font-style:italic;">Evolució conjunta entre setmanes; no demostra que un àmbit causi l'altre.</p>
    </div>`;
}

function longTermCard(item) {
  return `
    <div class="card">
      <p style="margin:0;font-size:var(--fs-md);font-weight:600;">${escapeHtml(item.label)} · ${escapeHtml(item.direction)}</p>
      <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${escapeHtml(item.text)}</p>
    </div>`;
}

function confidenceBadge(label) {
  const cls = label === "alta" ? "badge-high" : label === "moderada" ? "badge-mid" : "";
  return `<span class="badge ${cls}">confiança ${label}</span>`;
}

function disclaimer() {
  return `<p style="margin: var(--sp-2) 0 0; font-size: var(--fs-xs); color: var(--ink-faint); font-style: italic;">Correlació observada a les teves dades, no un diagnòstic. Útil per comentar-ho amb el metge.</p>`;
}

function correlationCard(p) {
  const thresholdText = p.predictorType === "boolean"
    ? ""
    : p.thresholds?.labelHigh
      ? ` (${p.thresholds.labelHigh})`
      : " alt";
  const condLower = p.predictorType === "boolean"
    ? p.predictorLabel.toLowerCase()
    : `${p.predictorLabel.toLowerCase()}${thresholdText}`;

  const headline = p.relationType === "coincidencia"
    ? `<strong>${escapeHtml(p.predictorLabel)}</strong> i <strong>${escapeHtml(p.outcomeLabel)}</strong> apareixen junts sovint`
    : `Després de <strong>${escapeHtml(condLower)}</strong> <span style="color: var(--ink-faint); font-weight: 400;">(${humanLagLabel(p.lag)})</span>`;

  const rateA = Math.round((p.effect.rateA || 0) * 100);
  const rateB = Math.round((p.effect.rateB || 0) * 100);
  let outcomeSentence;
  if (p.outcomeType === "numeric") {
    const { meanA, meanB } = p.effect;
    const casesA = Math.round((p.effect.rateA || 0) * p.nA);
    const casesB = Math.round((p.effect.rateB || 0) * p.nB);
    outcomeSentence = `${escapeHtml(p.outcomeLabel)}: mitjana ${meanA.toFixed(1)} vs ${meanB.toFixed(1)}; episodis alts ${rateA}% (${casesA}/${p.nA}) vs ${rateB}% (${casesB}/${p.nB}).`;
  } else {
    const casesA = Math.round((p.effect.rateA || 0) * p.nA);
    const casesB = Math.round((p.effect.rateB || 0) * p.nB);
    outcomeSentence = `${escapeHtml(p.outcomeLabel)}: present en ${rateA}% (${casesA} de ${p.nA} dies) amb el factor vs ${rateB}% (${casesB} de ${p.nB} dies) sense el factor.`;
  }

  return `
    <div class="card">
      <div style="display:flex; justify-content: space-between; align-items:flex-start; gap: var(--sp-3);">
        <div>
          <p style="margin:0; font-size: var(--fs-md); font-weight: 600;">${headline}</p>
          <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">${outcomeSentence}</p>
          <p style="margin: var(--sp-1) 0 0; font-size:var(--fs-xs); color:var(--ink-faint);">Comparació basada en ${p.nA} dies del grup A i ${p.nB} dies del grup B · cobertura ${Math.round(p.coverage*100)}%.</p>
        </div>
        ${confidenceBadge(p.confidence.label)}
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
