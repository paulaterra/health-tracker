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

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre</span>
      <h1 class="view-title">Cicle menstrual</h1>
      <p class="view-sub">Marca l'interruptor "Tinc la regla" (i tria la intensitat) — si et confons i el vols desmarcar, torna a clicar-lo. El dia del cicle es calcula sol a partir del primer dia de sagnat.</p>
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
        <span class="row-actions"><button type="button" data-edit-date="${e.date}">editar</button><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      ${e.simptomes?.length ? `<div class="event-tags">${e.simptomes.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.anticonceptius ? `<div class="event-tags">anticonceptius</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
