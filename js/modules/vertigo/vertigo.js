import { Repository } from "../../db/repository.js";
import {
  escapeHtml, nowISO, nowLocalInput, isoToLocalInput, localInputToISO, formatDateTime,
  sliderField, wireSliders, chipGroup, wireChips, getChipValues, radioChipGroup, wireRadioChips, getRadioValue,
  flashSaved, intensityBadge,
} from "../../utils/dom.js";

const repo = new Repository("vertigo_events");

const TYPES = [
  { value: "vertigen rotatori (tot roda)", label: "Vertigen rotatori (tot roda)" },
  { value: "boira mental", label: "Boira mental" },
  { value: "se me'n va el cap", label: "Se me'n va el cap" },
  { value: "sensació estranya", label: "Sensació estranya" },
  { value: "presíncope (com si m'anés a desmaiar)", label: "Presíncope (com si m'anés a desmaiar)" },
  { value: "desequilibri en caminar", label: "Desequilibri en caminar" },
  { value: "cap flotant / estrany (no ben bé mareig)", label: "Cap flotant / estrany (no ben bé mareig)" },
];
const SITUATIONS = ["en llevar-me", "en girar el cap", "caminant", "asseguda", "dret molta estona", "en aixecar-me ràpid", "després de menjar", "amb mal de cap", "sense motiu clar", "altre"].map(v => ({ value: v, label: v }));
const ASSOCIATED = ["nàusees", "sudoració", "visió borrosa", "pèrdua d'equilibri", "zumzeig a les orelles", "palpitacions", "cap buit / mareig"].map(v => ({ value: v, label: v }));

let editingId = null;

export async function renderVertigo(container) {
  editingId = null;
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — vertígens i boira mental</span>
      <h1 class="view-title">Vertígens i boira mental</h1>
      <p class="view-sub">Registra el tipus de sensació —inclosa la boira mental—, la intensitat i si has notat altres símptomes alhora. Pots canviar la data/hora si vols registrar un episodi d'un dia anterior.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="vertigo-form" novalidate>
        <h2 class="card-title" id="form-title">Nou episodi</h2>
        <div id="editing-banner"></div>

        <div class="field">
          <label class="field-label" for="entryDatetime">Data i hora</label>
          <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
        </div>

        ${radioChipGroup("tipus", "Tipus de sensació", TYPES, null)}
        ${sliderField("intensitat", "Intensitat", 0, "lleuger", "molt intens")}
        <div class="field">
          <label class="field-label" for="durada">Durada aproximada (minuts)</label>
          <input type="text" id="durada" placeholder="p. ex. 5">
        </div>
        ${chipGroup("situacio", "En quina situació ha aparegut", SITUATIONS)}
        ${chipGroup("associats", "Símptomes associats", ASSOCIATED)}
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
  wireRadioChips(container);
  await refreshList(container);

  container.querySelector("#vertigo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      id: editingId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      tipus: getRadioValue(container, "tipus"),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      durada: form.querySelector("#durada").value.trim(),
      situacio: getChipValues(container, "situacio"),
      associats: getChipValues(container, "associats"),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    await renderVertigo(container);
  });
}

async function editEntry(container, id) {
  const entry = await repo.get(id);
  if (!entry) return;
  editingId = id;

  container.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  container.querySelectorAll('[data-radio-group="tipus"]').forEach(b => b.classList.toggle("chip-active", b.dataset.value === entry.tipus));
  container.querySelector('[name="intensitat"]').value = entry.intensitat || 0;
  container.querySelector('[name="intensitat"]').dispatchEvent(new Event("input"));
  container.querySelector("#durada").value = entry.durada || "";
  container.querySelector("#comentari").value = entry.comentari || "";
  container.querySelectorAll('[data-chip-group="situacio"]').forEach(c => c.classList.toggle("chip-active", (entry.situacio || []).includes(c.dataset.value)));
  container.querySelectorAll('[data-chip-group="associats"]').forEach(c => c.classList.toggle("chip-active", (entry.associats || []).includes(c.dataset.value)));

  container.querySelector("#form-title").textContent = "Editant episodi";
  container.querySelector("#submit-btn").textContent = "Desar canvis";
  container.querySelector("#editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant un episodi existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancel·la</button>
    </div>
  `;
  container.querySelector("#cancel-edit-btn").addEventListener("click", () => renderVertigo(container));
  container.querySelector("#vertigo-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(container, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await repo.delete(id);
  await renderVertigo(container);
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
      ${e.tipus ? `<div class="event-tags"><strong>${escapeHtml(e.tipus)}</strong></div>` : ""}
      <div class="event-tags">${(e.situacio || []).map(escapeHtml).join(", ")}${e.durada ? " · " + escapeHtml(e.durada) + " min" : ""}</div>
      ${e.associats?.length ? `<div class="event-tags">Amb: ${e.associats.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
