import { Repository } from "../../db/repository.js";
import {
  escapeHtml, nowLocalInput, isoToLocalInput, localInputToISO, formatDateTime,
  sliderField, wireSliders, flashSaved, radioChipGroup, wireRadioChips, getRadioValue,
} from "../../utils/dom.js";

const repo = new Repository("exercise_log");

const TYPES = [
  { value: "gimnas_entrenador", label: "Gimnàs / entrenador personal" },
  { value: "fisio", label: "Fisioteràpia" },
  { value: "activacio_neuromuscular", label: "Activació neuromuscular" },
  { value: "caminar", label: "Caminar" },
];

let editingId = null;

export async function renderExercise(container) {
  editingId = null;
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — exercici</span>
      <h1 class="view-title">Exercici</h1>
      <p class="view-sub">Registra cada sessió: tipus, durada i com t'ha sentat. Pots canviar la data/hora per registrar una sessió d'un dia anterior.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="exercise-form" novalidate>
        <h2 class="card-title" id="form-title">Nova sessió</h2>
        <div id="editing-banner"></div>

        <div class="field">
          <label class="field-label" for="entryDatetime">Data i hora</label>
          <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
        </div>

        ${radioChipGroup("tipus", "Tipus", TYPES, null)}
        <div class="field">
          <label class="field-label" for="durada">Durada (minuts)</label>
          <input type="text" id="durada" placeholder="p. ex. 45">
        </div>
        ${sliderField("intensitat", "Intensitat percebuda", 0, "molt suau", "molt intens")}
        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari" placeholder="Com t'ha sentat, dolor durant/després..."></textarea>
        </div>
        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary" id="submit-btn">Desar sessió</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últimes sessions</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireRadioChips(container);
  await refreshList(container);

  container.querySelector("#exercise-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipus = getRadioValue(container, "tipus");
    if (!tipus) { alert("Selecciona un tipus d'exercici."); return; }
    const form = e.target;
    const payload = {
      id: editingId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      tipus,
      durada: form.querySelector("#durada").value.trim(),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    await renderExercise(container);
  });
}

async function editEntry(container, id) {
  const entry = await repo.get(id);
  if (!entry) return;
  editingId = id;

  container.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  container.querySelectorAll('[data-radio-group="tipus"]').forEach(b => b.classList.toggle("chip-active", b.dataset.value === entry.tipus));
  container.querySelector("#durada").value = entry.durada || "";
  container.querySelector('[name="intensitat"]').value = entry.intensitat || 0;
  container.querySelector('[name="intensitat"]').dispatchEvent(new Event("input"));
  container.querySelector("#comentari").value = entry.comentari || "";

  container.querySelector("#form-title").textContent = "Editant sessió";
  container.querySelector("#submit-btn").textContent = "Desar canvis";
  container.querySelector("#editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant una sessió existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancel·la</button>
    </div>
  `;
  container.querySelector("#cancel-edit-btn").addEventListener("click", () => renderExercise(container));
  container.querySelector("#exercise-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(container, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await repo.delete(id);
  await renderExercise(container);
}

async function refreshList(container) {
  const recent = await repo.getRecent("timestamp", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap sessió registrada.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editEntry(container, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteEntry(container, btn.dataset.delete)));
}

function rowTemplate(e) {
  const label = TYPES.find(t => t.value === e.tipus)?.label || e.tipus;
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        ${e.intensitat != null ? `<span class="badge">intensitat ${e.intensitat}/10</span>` : ""}
        <span class="row-actions">
          <button type="button" data-edit="${e.id}">editar</button>
          <button type="button" class="danger" data-delete="${e.id}">eliminar</button>
        </span>
      </div>
      <div class="event-tags">${escapeHtml(label)}${e.durada ? " · " + escapeHtml(e.durada) + " min" : ""}</div>
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
