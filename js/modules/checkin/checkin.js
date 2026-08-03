import { Repository } from "../../db/repository.js";
import { switchField } from "../../utils/dom.js";

const repo = new Repository("daily_checkin");

const FIELDS = [
  { key: "dolorGeneral", label: "Dolor general", low: "sense dolor", high: "dolor extrem" },
  { key: "digestiuGeneral", label: "Malestar digestiu", low: "cap molèstia", high: "molt intens" },
  { key: "sonQualitat", label: "Mal descans (nit passada)", low: "descans reparador", high: "molt mal son" },
  { key: "energiaFisica", label: "Cansament físic", low: "molta energia", high: "esgotament" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function levelFor(key, value) {
  const v = Number(value) || 0;
  if (v <= 3) return "low";
  if (v <= 6) return "mid";
  return "high";
}

export async function renderCheckin(container, dateOverride) {
  const date = dateOverride || todayISO();
  const isToday = date === todayISO();
  const existing = (await repo.getByIndex("date", date))[0] || null;

  const state = existing
    ? { ...existing }
    : {
        date,
        dolorGeneral: 0,
        digestiuGeneral: 0,
        sonQualitat: 0,
        energiaFisica: 0,
        malDeCap: false,
        comentari: "",
      };

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre</span>
      <h1 class="view-title">Check-in ràpid</h1>
      <p class="view-sub">Uns segons cada dia. Aquest és el pols diari que alimenta el motor de patrons: com més constant, més fiables seran les correlacions.</p>
    </div>

    ${dateNavHtml(date, isToday)}

    <div class="grid-2">
      <form class="card" id="checkin-form" novalidate>
        <h2 class="card-title">${isToday ? "Com estàs avui" : `Com vas estar el ${formatDateLabel(date)}`}</h2>
        ${FIELDS.map(f => fieldTemplate(f, state[f.key])).join("")}
        ${switchField("malDeCap", "Aquell dia vaig tenir mal de cap", state.malDeCap)}
        <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin-top: -8px;">Si vols detallar-ho (tipus, durada, desencadenants...), usa el mòdul "Mal de cap".</p>
        <div class="field">
          <label class="field-label" for="comentari">Nota lliure (opcional)</label>
          <textarea id="comentari" name="comentari" placeholder="Qualsevol observació d'aquell dia...">${escapeHtml(state.comentari || "")}</textarea>
        </div>
        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary">Desar check-in</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últims 7 dies</h2>
        <div class="ledger" id="ledger">${renderLedgerSkeleton()}</div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireDateNav(container, date);
  await refreshLedger(container);

  const form = container.querySelector("#checkin-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      id: existing?.id,
      scoreScaleVersion: 2,
      date,
      dolorGeneral: Number(form.querySelector('[name="dolorGeneral"]').value),
      digestiuGeneral: Number(form.querySelector('[name="digestiuGeneral"]').value),
      sonQualitat: Number(form.querySelector('[name="sonQualitat"]').value),
      energiaFisica: Number(form.querySelector('[name="energiaFisica"]').value),
      malDeCap: form.querySelector("#malDeCap").checked,
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    await renderCheckin(container, date);
    flashSaved(container);
  });
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
  container.querySelector("#nav-prev").addEventListener("click", () => renderCheckin(container, shiftDate(date, -1)));
  container.querySelector("#nav-next").addEventListener("click", () => renderCheckin(container, shiftDate(date, 1)));
  container.querySelector("#nav-today")?.addEventListener("click", () => renderCheckin(container, todayISO()));
  container.querySelector("#nav-date").addEventListener("change", (e) => {
    if (e.target.value) renderCheckin(container, e.target.value);
  });
}

function formatDateLabel(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("ca-ES", { day: "2-digit", month: "long" });
}

function fieldTemplate(field, value) {
  return `
    <div class="field">
      <div class="field-label-row">
        <label class="field-label" for="${field.key}">${field.label}</label>
        <span class="field-value" data-out-for="${field.key}">${value}</span>
      </div>
      <input type="range" id="${field.key}" name="${field.key}" min="0" max="10" step="1" value="${value}">
      <div class="scale-ticks"><span>${field.low}</span><span>${field.high}</span></div>
    </div>
  `;
}

function wireSliders(container) {
  container.querySelectorAll('input[type="range"]').forEach((input) => {
    const out = container.querySelector(`[data-out-for="${input.name}"]`);
    input.addEventListener("input", () => { out.textContent = input.value; });
  });
}

function flashSaved(container) {
  const flash = container.querySelector("#save-flash");
  if (!flash) return;
  flash.classList.add("show");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => flash.classList.remove("show"), 1800);
}

function renderLedgerSkeleton() {
  return `<p class="ledger-empty">Carregant…</p>`;
}

async function refreshLedger(container) {
  const recent = await repo.getRecent("date", 7);
  const ledger = container.querySelector("#ledger");
  if (recent.length === 0) {
    ledger.innerHTML = `<p class="ledger-empty">Encara no hi ha cap check-in desat.</p>`;
    return;
  }
  const ordered = [...recent].sort((a, b) => new Date(a.date) - new Date(b.date));
  ledger.innerHTML = ordered.map(rowTemplate).join("");
  ledger.querySelectorAll("[data-edit-date]").forEach(btn => btn.addEventListener("click", () => renderCheckin(container, btn.dataset.editDate)));
  ledger.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => { if(confirm("Segur que vols eliminar aquest check-in?")){ await repo.delete(btn.dataset.delete); await refreshLedger(container); } }));
}

function rowTemplate(entry) {
  const bars = ["dolorGeneral", "digestiuGeneral", "sonQualitat", "energiaFisica", "energiaMental"]
    .map((key) => {
      const value = entry[key] ?? 0;
      const level = levelFor(key, value);
      const height = 4 + value * 1.8;
      return `<div class="ledger-bar" data-level="${level}" style="height:${height}px" title="${key}: ${value}"></div>`;
    })
    .join("");
  const label = new Date(entry.date + "T00:00:00").toLocaleDateString("ca-ES", { day: "2-digit", month: "short" });
  return `
    <div class="ledger-row">
      <span class="ledger-date">${label}</span>
      <div class="ledger-bars">${bars}</div>
      <span class="badge ${entry.malDeCap ? "badge-high" : ""}">${entry.malDeCap ? "mal de cap" : (entry.comentari ? "nota" : "")}</span><span class="row-actions"><button type="button" data-edit-date="${entry.date}">editar</button><button type="button" class="danger" data-delete="${entry.id}">eliminar</button></span>
    </div>
  `;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
