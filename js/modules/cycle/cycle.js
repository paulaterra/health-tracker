import { Repository } from "../../db/repository.js";
import { escapeHtml, todayISO, formatDate, flashSaved, chipGroup, wireChips, getChipValues, switchField } from "../../utils/dom.js";

const repo = new Repository("cycle_log");

const BLEEDING_LEVELS = [
  { value: "lleuger", label: "Lleuger" },
  { value: "moderat", label: "Moderat" },
  { value: "fort", label: "Fort" },
  { value: "intens", label: "Intens" },
];

const SYMPTOMS = [
  "dolor", "còlics", "ovulació", "sensibilitat als pits", "mal de cap", "lumbars", "cama", "articulacions",
].map(v => ({ value: v, label: v }));

const CYCLE_PHASES = [
  { value: "follicular", label: "Fase fol·licular" },
  { value: "ovulacio", label: "Ovulació" },
  { value: "lutea", label: "Fase lútia" },
];

const PHASE_LABELS = Object.fromEntries(CYCLE_PHASES.map(x => [x.value, x.label]));

/**
 * Retorna totes les dates d'inici de regla (no continuació d'un dia
 * anterior amb sagnat), ordenades cronològicament.
 */
function findPeriodStarts(records) {
  const bleedingDates = new Set(records.filter(r => r.sagnat).map(r => r.date));
  const sorted = [...bleedingDates].sort();
  const starts = [];
  for (const d of sorted) {
    const prevKey = shiftDate(d, -1);
    if (!bleedingDates.has(prevKey)) starts.push(d);
  }
  return starts;
}

/** Durada de cada cicle: dies entre un inici de regla i el següent. */
function computeCycleLengths(starts) {
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const a = isoDayNumber(starts[i - 1]);
    const b = isoDayNumber(starts[i]);
    lengths.push({ from: starts[i - 1], to: starts[i], length: b - a });
  }
  return lengths;
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function regularityInfo(lengths) {
  if (!lengths.length) return null;
  const vals = lengths.map(l => l.length);
  const avg = mean(vals);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min;
  const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length;
  const stdev = Math.sqrt(variance);
  let label = null;
  if (lengths.length >= 2) {
    if (range <= 4) label = "bastant estable";
    else if (range <= 8) label = "variació moderada";
    else label = "variació alta";
  }
  return {
    avg: Math.round(avg * 10) / 10,
    min, max, range,
    stdev: Math.round(stdev * 10) / 10,
    label,
  };
}


function latestManualCycleData(records, targetDate) {
  return records
    .filter(r => r.date <= targetDate && (r.ovulacioEstimada || r.faseManual === "ovulacio"))
    .sort((a,b) => b.date.localeCompare(a.date))[0] || null;
}

function estimateCurrentCycle(records, starts, lengths, targetDate) {
  const currentStart=[...starts].reverse().find(d=>d<=targetDate);
  if(!currentStart) return null;
  const manual=latestManualCycleData(records,targetDate);
  if(manual && manual.date>=currentStart) {
    const ovulation = manual.ovulacioEstimada || (manual.faseManual === "ovulacio" ? manual.date : null);
    return {
      start:currentStart,
      ovulation,
      source:manual.fontOvulacio || "manual",
      sourceLabel: manual.fontOvulacio === "clue" ? "Introduït des de Clue" : manual.fontOvulacio === "lh" ? "Test LH" : manual.fontOvulacio === "temperatura" ? "Temperatura basal" : "Introduït manualment",
      estimated:false,
    };
  }
  if(!lengths.length) return {start:currentStart,ovulation:null,source:"insufficient",sourceLabel:"Encara no hi ha prou cicles per estimar l’ovulació",estimated:true};
  const avg=Math.round(mean(lengths.map(x=>x.length)));
  const nextPeriod=shiftDate(currentStart,avg);
  const ovulation=shiftDate(nextPeriod,-14);
  return {start:currentStart,nextPeriod,ovulation,source:"health-track",sourceLabel:"Estimació de Health Track",estimated:true};
}


function cyclePhaseForDate(records, prediction, date) {
  const record = records.find(r => r.date === date);
  if (record?.faseManual) {
    return {
      label: PHASE_LABELS[record.faseManual] || "Fase registrada",
      detail: "Fase marcada manualment per a aquest dia. Té prioritat sobre l’estimació automàtica."
    };
  }
  if (!prediction?.start) return { label: "—", detail: "Es podrà situar quan hi hagi un inici de menstruació registrat o quan marquis la fase manualment." };
  const bleeding = records.some(r => r.date === date && !!r.sagnat);
  if (!prediction.ovulation) {
    return bleeding
      ? { label: "Menstruació · fase fol·licular", detail: "La menstruació forma part de l’inici de la fase fol·licular. Encara no hi ha prou dades per situar l’ovulació." }
      : { label: "Fase fol·licular (orientativa)", detail: "Des de l’inici de la menstruació fins a l’ovulació. La pots corregir manualment." };
  }
  if (date === prediction.ovulation) {
    return { label: "Ovulació", detail: prediction.estimated ? "Ovulació estimada per calendari. La pots marcar manualment si tens una dada millor." : "Ovulació situada amb una dada registrada." };
  }
  if (date < prediction.ovulation) {
    return {
      label: bleeding ? "Menstruació · fase fol·licular" : "Fase fol·licular",
      detail: "Des de l’inici de la menstruació fins a l’ovulació. La pots corregir manualment."
    };
  }
  return { label: "Fase lútia", detail: "Després de l’ovulació fins a l’inici de la menstruació següent. La pots corregir manualment." };
}


function cyclePhasesCard(prediction) {
  if (!prediction?.start) return '';
  return `<div class="card" style="background:var(--paper-alt);">
    <h2 class="card-title">Fases del cicle</h2>
    <div style="display:grid;gap:var(--sp-2);font-size:var(--fs-sm);">
      <div><strong>Fase fol·licular</strong><div style="color:var(--ink-soft);margin-top:2px;">Des del primer dia de menstruació fins a l’ovulació${prediction.ovulation ? ` · aprox. fins al ${escapeHtml(formatDate(shiftDate(prediction.ovulation,-1)))}` : ''}.</div></div>
      <div><strong>Ovulació / fase periovulatòria</strong><div style="color:var(--ink-soft);margin-top:2px;">${prediction.ovulation ? `${prediction.estimated?'Estimació':'Data situada'}: ${escapeHtml(formatDate(prediction.ovulation))}` : 'Encara no es pot situar.'}</div></div>
      <div><strong>Fase lútia</strong><div style="color:var(--ink-soft);margin-top:2px;">Després de l’ovulació fins a la menstruació següent${prediction.nextPeriod ? ` · prevista cap al ${escapeHtml(formatDate(prediction.nextPeriod))}` : ''}.</div></div>
    </div>
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">Quan l’ovulació és estimada, també ho són els límits entre fases. Les fases serveixen per buscar patrons temporals, no per confirmar l’ovulació ni diagnosticar alteracions hormonals.</p>
  </div>`;
}

function cyclePredictionCard(prediction) {
  if(!prediction) return '';
  if(!prediction.ovulation) return `<div class="card" style="background:var(--paper-alt);"><h2 class="card-title">Ovulació</h2><p style="margin:0;color:var(--ink-soft);">${escapeHtml(prediction.sourceLabel)}</p><p style="margin:var(--sp-2) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">Pots marcar manualment l’ovulació en el dia corresponent. Si no ho fas, Health Track la pot estimar quan tingui prou cicles.</p></div>`;
  return `<div class="card" style="background:var(--paper-alt);">
    <div style="display:flex;justify-content:space-between;gap:var(--sp-3);align-items:flex-start;">
      <div><h2 class="card-title" style="margin-bottom:var(--sp-1);">Ovulació ${prediction.estimated?'estimada':'registrada'}</h2><p style="margin:0;color:var(--ink-soft);">${escapeHtml(formatDate(prediction.ovulation))}</p></div>
      <span class="badge">${escapeHtml(prediction.sourceLabel)}</span>
    </div>
    ${prediction.nextPeriod?`<p style="margin:var(--sp-3) 0 0;color:var(--ink-soft);">Pròxima menstruació estimada: ${escapeHtml(formatDate(prediction.nextPeriod))}</p>`:''}
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-xs);color:var(--ink-faint);">${prediction.estimated?'És una estimació de calendari. Si marques manualment l’ovulació o les fases, les dades manuals tindran prioritat en l’anàlisi.':'Aquesta dada manual té prioritat sobre l’estimació automàtica.'}</p>
  </div>`;
}
/** Agrupa els dies consecutius amb sagnat en menstruacions. */
function computePeriodEpisodes(records) {
  const bleedingDates = [...new Set(records.filter(r => r.sagnat).map(r => r.date))].sort();
  if (!bleedingDates.length) return [];
  const episodes = [];
  let current = [bleedingDates[0]];
  for (let i = 1; i < bleedingDates.length; i++) {
    if (bleedingDates[i] === shiftDate(bleedingDates[i - 1], 1)) current.push(bleedingDates[i]);
    else { episodes.push(current); current = [bleedingDates[i]]; }
  }
  episodes.push(current);
  return episodes.map(days => ({ start: days[0], end: days[days.length - 1], length: days.length }));
}

function menstrualStats(records, lengths) {
  const reg = regularityInfo(lengths);
  const episodes = computePeriodEpisodes(records);
  const today = todayISO();
  // No comptem com a menstruació completa un episodi que encara arriba fins avui.
  const completed = episodes.filter(e => e.end < today);
  const periodVals = completed.map(e => e.length);
  return {
    cycle: reg,
    periodAvg: periodVals.length ? Math.round(mean(periodVals) * 10) / 10 : null,
    periodCount: periodVals.length,
    episodes,
  };
}

function statBox(label, value, detail = "") {
  return `<div style="background:var(--paper-alt); border-radius:var(--radius-md); padding:var(--sp-4); min-width:0;">
    <div style="font-size:var(--fs-xs); color:var(--ink-faint); margin-bottom:var(--sp-1);">${label}</div>
    <div style="font-family:var(--font-mono); font-size:var(--fs-lg); font-weight:600;">${value}</div>
    ${detail ? `<div style="font-size:var(--fs-xs); color:var(--ink-faint); margin-top:var(--sp-1);">${detail}</div>` : ""}
  </div>`;
}

function cycleStatsCard(records, lengths) {
  const stats = menstrualStats(records, lengths);
  const reg = stats.cycle;
  const cycleAvg = reg ? `${reg.avg} dies` : "—";
  const variation = lengths.length >= 2 ? `${reg.range} dies` : "—";
  const variationDetail = lengths.length >= 2 ? `${reg.min}–${reg.max} dies${reg.label ? ` · ${reg.label}` : ""}` : "calen almenys 2 cicles complets";
  const periodAvg = stats.periodAvg != null ? `${stats.periodAvg} dies` : "—";
  const periodDetail = stats.periodCount ? `mitjana de ${stats.periodCount} menstruació${stats.periodCount === 1 ? "" : "ns"} completa${stats.periodCount === 1 ? "" : "s"}` : "cal almenys una menstruació finalitzada";
  const recent = lengths.slice(-6).reverse();

  return `
    <div class="card">
      <h2 class="card-title">Resum del cicle</h2>
      <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--sp-3);">
        ${statBox("Durada mitjana del cicle", cycleAvg, lengths.length ? `calculada amb ${lengths.length} cicle${lengths.length === 1 ? "" : "s"} complet${lengths.length === 1 ? "" : "s"}` : "calen dos inicis de regla")}
        ${statBox("Variació del cicle", variation, variationDetail)}
        ${statBox("Durada mitjana de la menstruació", periodAvg, periodDetail)}
      </div>
      ${stats.episodes.length ? `<div class="event-list" style="margin-top:var(--sp-4);">
        ${stats.episodes.slice(-6).reverse().map(e => `<div class="event-row"><div class="event-row-top"><span class="event-when">Menstruació · ${escapeHtml(formatDate(e.start))}${e.end !== e.start ? ` → ${escapeHtml(formatDate(e.end))}` : ""}</span><span class="badge">${e.length} ${e.length === 1 ? "dia" : "dies"}</span></div></div>`).join("")}
      </div>` : `<p class="ledger-empty" style="margin-top:var(--sp-4);">Encara no hi ha cap menstruació registrada. Les estadístiques s'aniran calculant automàticament quan hi hagi prou dades.</p>`}
    </div>`;
}

function isoDayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Aritmètica de dates en UTC: evita que el fus horari converteixi, per exemple,
// el 29/07 a les 00:00 en el 28/07 UTC i trenqui l'agrupació de dies consecutius.
function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dateNavHtml(date, isToday) {
  return `
    <div class="card" style="display:flex; align-items:center; gap: var(--sp-3); margin-bottom: var(--sp-5); padding: var(--sp-3) var(--sp-4);">
      <button type="button" class="btn btn-ghost" id="nav-prev">‹ Dia anterior</button>
      <input type="date" id="nav-date" value="${date}" style="width:auto;">
      ${!isToday ? `<button type="button" class="btn btn-ghost" id="nav-today">Avui</button>` : ""}
      <button type="button" class="btn btn-ghost" id="nav-next" ${isToday ? "disabled" : ""}>Dia següent ›</button>
    </div>
  `;
}

function wireDateNav(container, date) {
  container.querySelector("#nav-prev").addEventListener("click", () => renderCycle(container, shiftDate(date, -1)));
  container.querySelector("#nav-next").addEventListener("click", () => renderCycle(container, shiftDate(date, 1)));
  container.querySelector("#nav-today")?.addEventListener("click", () => renderCycle(container, todayISO()));
  container.querySelector("#nav-date").addEventListener("change", (e) => {
    if (e.target.value) renderCycle(container, e.target.value);
  });
}

export async function renderCycle(container, dateOverride) {
  const date = dateOverride || todayISO();
  const isToday = date === todayISO();
  const existing = (await repo.getByIndex("date", date))[0] || null;
  const s = existing || {};
  const allRecords = await repo.getAll();
  const cycleDay = computeCycleDay(allRecords, date);
  const periodStarts = findPeriodStarts(allRecords);
  const cycleLengths = computeCycleLengths(periodStarts);
  const prediction = estimateCurrentCycle(allRecords, periodStarts, cycleLengths, date);
  const cyclePhase = cyclePhaseForDate(allRecords, prediction, date);

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre</span>
      <h1 class="view-title">Cicle menstrual</h1>
      <p class="view-sub">Registra la menstruació i marca, quan ho sàpigues, si aquell dia correspon a fase fol·licular, ovulació o fase lútia. Les fases manuals tenen prioritat sobre les estimacions de Health Track.</p>
    </div>

    ${dateNavHtml(date, isToday)}

    <div class="grid-2">
      <form class="card" id="cycle-form" novalidate>
        <h2 class="card-title">${isToday ? "Avui" : formatDate(date)}</h2>

        <div class="card" style="background: var(--paper-alt); margin-bottom: var(--sp-4);">
          <span class="field-label">Dia del cicle (calculat)</span>
          <p style="font-family: var(--font-mono); font-size: var(--fs-lg); margin: var(--sp-1) 0 0;">
            ${cycleDay != null ? `Dia ${cycleDay}` : "—"}
          </p>
          ${cycleDay == null ? `<p style="font-size: var(--fs-xs); color: var(--ink-faint); margin-top: var(--sp-1);">Es calcularà automàticament quan marquis el primer dia de regla.</p>` : ""}
          <div style="border-top:1px solid var(--line);margin-top:var(--sp-3);padding-top:var(--sp-3);">
            <span class="field-label">Fase actual</span>
            <p style="margin:var(--sp-1) 0 0;font-weight:600;">${escapeHtml(cyclePhase.label)}</p>
            <p style="font-size:var(--fs-xs);color:var(--ink-faint);margin:var(--sp-1) 0 0;">${escapeHtml(cyclePhase.detail)}</p>
          </div>
        </div>

        <div class="field">
          ${switchField("teRegla", "Tinc la regla", !!s.sagnat)}
        </div>
        <div class="field" id="bleeding-wrap" style="display:${s.sagnat ? "block" : "none"};">
          <label class="field-label">Intensitat del sagnat</label>
          <div class="chip-row" id="bleeding-row">
            ${BLEEDING_LEVELS.map(b => `<button type="button" class="chip ${s.sagnat === b.value ? "chip-active" : ""}" data-bleeding="${b.value}">${b.label}</button>`).join("")}
          </div>
        </div>

        ${chipGroup("simptomes", "Símptomes d'aquell dia", SYMPTOMS, s.simptomes || [])}
        ${switchField("anticonceptius", "Prenc anticonceptius", s.anticonceptius)}

        <div class="card" style="background:var(--paper-alt);margin:var(--sp-4) 0;">
          <h3 style="margin:0 0 var(--sp-2);font-size:var(--fs-sm);">Fase del cicle (opcional)</h3>
          <p style="margin:0 0 var(--sp-3);font-size:var(--fs-xs);color:var(--ink-faint);">Marca la fase que correspon a aquest dia si la coneixes. Si no marques res, Health Track la calcularà de manera orientativa a partir de la menstruació i l’ovulació disponibles.</p>
          <div class="chip-row" id="phase-row">
            ${CYCLE_PHASES.map(p => `<button type="button" class="chip ${s.faseManual === p.value ? 'chip-active' : ''}" data-cycle-phase="${p.value}">${p.label}</button>`).join("")}
          </div>
          <input type="hidden" id="faseManual" value="${escapeHtml(s.faseManual || '')}">
          <div class="field" id="ovulation-source-wrap" style="display:${s.faseManual === 'ovulacio' || s.ovulacioEstimada ? 'block' : 'none'};margin-top:var(--sp-3);">
            <label class="field-label" for="fontOvulacio">Font de la dada d’ovulació</label>
            <select id="fontOvulacio"><option value="manual" ${!s.fontOvulacio||s.fontOvulacio==='manual'?'selected':''}>Introduïda manualment</option><option value="clue" ${s.fontOvulacio==='clue'?'selected':''}>Clue</option><option value="lh" ${s.fontOvulacio==='lh'?'selected':''}>Test LH</option><option value="temperatura" ${s.fontOvulacio==='temperatura'?'selected':''}>Temperatura basal</option><option value="altres" ${s.fontOvulacio==='altres'?'selected':''}>Altres</option></select>
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari">${escapeHtml(s.comentari || "")}</textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary">Desar registre</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div style="display:flex; flex-direction:column; gap: var(--sp-6);">
        <div class="card">
          <h2 class="card-title">Últims dies</h2>
          <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
        </div>
        ${cyclePredictionCard(prediction)}
        ${cyclePhasesCard(prediction)}
        ${cycleStatsCard(allRecords, cycleLengths)}
      </div>
    </div>
  `;

  wireChips(container);
  wireDateNav(container, date);

  let sagnat = s.sagnat || null;
  const teReglaCheckbox = container.querySelector("#teRegla");
  const bleedingWrap = container.querySelector("#bleeding-wrap");

  teReglaCheckbox.addEventListener("change", () => {
    if (teReglaCheckbox.checked) {
      bleedingWrap.style.display = "block";
      if (!sagnat) {
        sagnat = "moderat";
        container.querySelectorAll("[data-bleeding]").forEach(b => b.classList.toggle("chip-active", b.dataset.bleeding === sagnat));
      }
    } else {
      bleedingWrap.style.display = "none";
      sagnat = null;
      container.querySelectorAll("[data-bleeding]").forEach(b => b.classList.remove("chip-active"));
    }
  });

  container.querySelectorAll("[data-bleeding]").forEach(btn => {
    btn.addEventListener("click", () => {
      sagnat = btn.dataset.bleeding;
      container.querySelectorAll("[data-bleeding]").forEach(b => b.classList.toggle("chip-active", b === btn));
    });
  });

  const faseInput = container.querySelector("#faseManual");
  const ovulationSourceWrap = container.querySelector("#ovulation-source-wrap");
  container.querySelectorAll("[data-cycle-phase]").forEach(btn => {
    btn.addEventListener("click", () => {
      const same = faseInput.value === btn.dataset.cyclePhase;
      faseInput.value = same ? "" : btn.dataset.cyclePhase;
      container.querySelectorAll("[data-cycle-phase]").forEach(b => b.classList.toggle("chip-active", !same && b === btn));
      ovulationSourceWrap.style.display = faseInput.value === "ovulacio" ? "block" : "none";
    });
  });

  await refreshList(container);

  container.querySelector("#cycle-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      id: existing?.id,
      date,
      sagnat: teReglaCheckbox.checked ? (sagnat || "moderat") : null,
      simptomes: getChipValues(container, "simptomes"),
      anticonceptius: form.querySelector("#anticonceptius").checked,
      faseManual: form.querySelector("#faseManual").value || null,
      ovulacioEstimada: form.querySelector("#faseManual").value === "ovulacio" ? date : null,
      fontOvulacio: form.querySelector("#fontOvulacio").value || "manual",
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    await renderCycle(container, date);
    flashSaved(container);
  });
}

/**
 * Calcula el dia del cicle per a `targetDate` a partir de l'historial:
 * cerca l'inici de regla (dia amb sagnat que no és continuació d'un dia
 * anterior amb sagnat) més recent anterior o igual a targetDate.
 */
function computeCycleDay(records, targetDate) {
  const bleedingDates = new Set(records.filter(r => r.sagnat).map(r => r.date));
  const targetDay = isoDayNumber(targetDate);

  let lastStart = null;
  const sortedBleedingDates = [...bleedingDates].sort();
  for (const d of sortedBleedingDates) {
    if (isoDayNumber(d) > targetDay) break;
    const prevKey = shiftDate(d, -1);
    const isStart = !bleedingDates.has(prevKey);
    if (isStart) lastStart = d;
  }
  if (!lastStart) return null;
  return targetDay - isoDayNumber(lastStart) + 1;
}

async function refreshList(container) {
  const recent = await repo.getRecent("date", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  list.querySelectorAll("[data-edit-date]").forEach(btn => btn.addEventListener("click", () => renderCycle(container, btn.dataset.editDate)));
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Segur que vols eliminar aquest registre?")) return;
      await repo.delete(btn.dataset.delete);
      await refreshList(container);
    });
  });
}

function rowTemplate(e) {
  const bleedingLabel = BLEEDING_LEVELS.find(b => b.value === e.sagnat)?.label;
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDate(e.date)}</span>
        ${bleedingLabel ? `<span class="badge badge-high">regla · ${escapeHtml(bleedingLabel)}</span>` : ""}
        ${e.faseManual ? `<span class="badge">${escapeHtml(PHASE_LABELS[e.faseManual] || e.faseManual)}</span>` : (e.ovulacioEstimada ? `<span class="badge">ovulació · ${escapeHtml(formatDate(e.ovulacioEstimada))}</span>` : "")}
        <span class="row-actions"><button type="button" data-edit-date="${e.date}">editar</button><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      ${e.simptomes?.length ? `<div class="event-tags">${e.simptomes.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.anticonceptius ? `<div class="event-tags">anticonceptius</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
