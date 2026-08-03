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
    const dateObj = new Date(d + "T00:00:00");
    const prevDay = new Date(dateObj);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevKey = prevDay.toISOString().slice(0, 10);
    if (!bleedingDates.has(prevKey)) starts.push(d);
  }
  return starts;
}

/** Durada de cada cicle: dies entre un inici de regla i el següent. */
function computeCycleLengths(starts) {
  const lengths = [];
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1] + "T00:00:00");
    const b = new Date(starts[i] + "T00:00:00");
    lengths.push({ from: starts[i - 1], to: starts[i], length: Math.round((b - a) / 86400000) });
  }
  return lengths;
}

function regularityInfo(lengths) {
  if (lengths.length < 2) return null;
  const vals = lengths.map(l => l.length);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length;
  const stdev = Math.sqrt(variance);
  let label, color;
  if (stdev <= 2) { label = "regular"; color = "var(--sage)"; }
  else if (stdev <= 5) { label = "una mica irregular"; color = "var(--amber)"; }
  else { label = "irregular"; color = "var(--clay)"; }
  return { avg: Math.round(avg * 10) / 10, stdev: Math.round(stdev * 10) / 10, label, color };
}

function cycleLengthCard(lengths) {
  const reg = regularityInfo(lengths);
  if (lengths.length === 0) {
    return `
      <div class="card">
        <h2 class="card-title">Regularitat del cicle</h2>
        <p class="ledger-empty">Encara no s'ha detectat cap cicle complet (calen almenys dos inicis de regla).</p>
      </div>
    `;
  }
  const recent = lengths.slice(-6).reverse();
  return `
    <div class="card">
      <h2 class="card-title">Regularitat del cicle</h2>
      ${reg ? `
        <p style="margin:0;">
          Durada mitjana: <strong style="font-family: var(--font-mono);">${reg.avg} dies</strong>
          · <span style="color:${reg.color}; font-weight:600;">${reg.label}</span>
          <span style="color: var(--ink-faint); font-size: var(--fs-xs);"> (variació ±${reg.stdev} dies)</span>
        </p>
      ` : `<p class="ledger-empty">Amb un sol cicle registrat encara no es pot valorar la regularitat.</p>`}
      <div class="event-list" style="margin-top: var(--sp-3);">
        ${recent.map(l => `
          <div class="event-row">
            <div class="event-row-top">
              <span class="event-when">${escapeHtml(formatDate(l.from))} → ${escapeHtml(formatDate(l.to))}</span>
              <span class="badge">${l.length} dies</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
        ${cycleLengthCard(cycleLengths)}
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
  const target = new Date(targetDate + "T00:00:00");

  let lastStart = null;
  const sortedBleedingDates = [...bleedingDates].sort();
  for (const d of sortedBleedingDates) {
    const dateObj = new Date(d + "T00:00:00");
    if (dateObj > target) break;
    const prevDay = new Date(dateObj);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevKey = prevDay.toISOString().slice(0, 10);
    const isStart = !bleedingDates.has(prevKey);
    if (isStart) lastStart = dateObj;
  }
  // Si avui mateix té sagnat i és un inici, ja queda cobert pel bucle anterior.
  if (!lastStart) return null;
  const diffDays = Math.round((target - lastStart) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
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
