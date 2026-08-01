import { Repository } from "../../db/repository.js";
import {
  escapeHtml, nowLocalInput, isoToLocalInput, localInputToISO, formatDateTime,
  sliderField, wireSliders, chipGroup, wireChips, getChipValues, flashSaved, intensityBadge,
} from "../../utils/dom.js";

const repo = new Repository("headache_events");

const TYPES = ["tensional", "migranya", "punxant", "pulsàtil", "altre"].map(v => ({ value: v, label: v }));
const LOCATIONS = ["front", "temple dret", "temple esquerre", "nuca", "tot el cap"].map(v => ({ value: v, label: v }));
const TRIGGERS = ["falta de son", "llum", "pantalles", "estrès", "regla / cicle", "cafeïna", "deshidratació", "fam", "altre"].map(v => ({ value: v, label: v }));

let editingId = null;

export async function renderHeadache(container) {
  editingId = null;
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — mal de cap</span>
      <h1 class="view-title">Mal de cap</h1>
      <p class="view-sub">Registra cada episodi: intensitat, tipus, on el notes i què creus que l'ha pogut desencadenar. Pots canviar la data/hora per registrar un episodi passat.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="headache-form" novalidate>
        <h2 class="card-title" id="form-title">Nou episodi</h2>
        <div id="editing-banner"></div>

        <div class="field">
          <label class="field-label" for="entryDatetime">Data i hora</label>
          <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
        </div>

        ${sliderField("intensitat", "Intensitat", 0, "lleu", "incapacitant")}
        ${chipGroup("tipus", "Tipus", TYPES)}
        ${chipGroup("localitzacio", "Localització", LOCATIONS)}
        ${chipGroup("desencadenants", "Possibles desencadenants", TRIGGERS)}

        <div class="field">
          <label class="field-label" for="durada">Durada aproximada (hores)</label>
          <input type="text" id="durada" placeholder="p. ex. 3">
        </div>
        <div class="field">
          <label class="field-label" for="medicacio">Medicació presa (opcional)</label>
          <input type="text" id="medicacio" placeholder="p. ex. ibuprofèn 400mg">
        </div>
        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari"></textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary" id="submit-btn">Desar episodi</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últims episodis</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireChips(container);
  await refreshList(container);

  container.querySelector("#headache-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      id: editingId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      tipus: getChipValues(container, "tipus"),
      localitzacio: getChipValues(container, "localitzacio"),
      desencadenants: getChipValues(container, "desencadenants"),
      durada: form.querySelector("#durada").value.trim(),
      medicacio: form.querySelector("#medicacio").value.trim(),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    await renderHeadache(container);
  });
}

async function editEntry(container, id) {
  const entry = await repo.get(id);
  if (!entry) return;
  editingId = id;

  container.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  container.querySelector('[name="intensitat"]').value = entry.intensitat || 0;
  container.querySelector('[name="intensitat"]').dispatchEvent(new Event("input"));
  container.querySelector("#durada").value = entry.durada || "";
  container.querySelector("#medicacio").value = entry.medicacio || "";
  container.querySelector("#comentari").value = entry.comentari || "";
  container.querySelectorAll('[data-chip-group="tipus"]').forEach(c => c.classList.toggle("chip-active", (entry.tipus || []).includes(c.dataset.value)));
  container.querySelectorAll('[data-chip-group="localitzacio"]').forEach(c => c.classList.toggle("chip-active", (entry.localitzacio || []).includes(c.dataset.value)));
  container.querySelectorAll('[data-chip-group="desencadenants"]').forEach(c => c.classList.toggle("chip-active", (entry.desencadenants || []).includes(c.dataset.value)));

  container.querySelector("#form-title").textContent = "Editant episodi";
  container.querySelector("#submit-btn").textContent = "Desar canvis";
  container.querySelector("#editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant un episodi existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancel·la</button>
    </div>
  `;
  container.querySelector("#cancel-edit-btn").addEventListener("click", () => renderHeadache(container));
  container.querySelector("#headache-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(container, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await repo.delete(id);
  await renderHeadache(container);
}

async function refreshList(container) {
  const recent = await repo.getRecent("timestamp", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap episodi registrat.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editEntry(container, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteEntry(container, btn.dataset.delete)));
}

function rowTemplate(e) {
  const tags = [...(e.tipus || []), ...(e.localitzacio || [])].join(", ");
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        ${intensityBadge(e.intensitat)}
        <span class="row-actions">
          <button type="button" data-edit="${e.id}">editar</button>
          <button type="button" class="danger" data-delete="${e.id}">eliminar</button>
        </span>
      </div>
      <div class="event-tags">${escapeHtml(tags)}${e.durada ? " · " + escapeHtml(e.durada) + "h" : ""}</div>
      ${e.desencadenants?.length ? `<div class="event-tags">Possibles causes: ${e.desencadenants.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
