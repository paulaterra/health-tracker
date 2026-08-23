import { Repository } from "../../db/repository.js";
import { escapeHtml, nowLocalInput, isoToLocalInput, localInputToISO, formatDateTime, flashSaved } from "../../utils/dom.js";

const repo = new Repository("medications");

const PRESETS = ["Paracetamol", "Ibuprofè", "Berocca"];
const OPTIONAL_PRESETS_KEY = "paula-tracker-medication-optional-presets";
const DEFAULT_OPTIONAL_PRESETS = ["Estel-Farma Multicelulosa Caolin"];

function getOptionalPresets() {
  try {
    const stored = localStorage.getItem(OPTIONAL_PRESETS_KEY);
    if (stored === null) return [...DEFAULT_OPTIONAL_PRESETS];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [...DEFAULT_OPTIONAL_PRESETS];
  } catch {
    return [...DEFAULT_OPTIONAL_PRESETS];
  }
}

function saveOptionalPresets(items) {
  localStorage.setItem(OPTIONAL_PRESETS_KEY, JSON.stringify(items));
}

let editingId = null;

export async function renderMedication(container) {
  editingId = null;
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — medicació i suplements</span>
      <h1 class="view-title">Medicació i suplements</h1>
      <p class="view-sub">Toca un botó ràpid o escriu-ne un altre. Pots canviar la data/hora per registrar una presa d'un dia anterior.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="med-form" novalidate>
        <h2 class="card-title" id="form-title">Nova presa</h2>
        <div id="editing-banner"></div>

        <div class="field">
          <label class="field-label" for="entryDatetime">Data i hora</label>
          <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
        </div>

        <div class="field">
          <label class="field-label">Ràpids</label>
          <div class="chip-row" id="med-preset-row">
            ${PRESETS.map(p => `<button type="button" class="chip" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
            ${getOptionalPresets().map(p => `<span class="removable-preset"><button type="button" class="chip" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button><button type="button" class="removable-preset-x" data-remove-preset="${escapeHtml(p)}" aria-label="Eliminar ${escapeHtml(p)}" title="Treure etiqueta">×</button></span>`).join("")}
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="nom">Medicament / suplement</label>
          <input type="text" id="nom" placeholder="p. ex. Paracetamol, o un altre..." required>
        </div>
        <div class="field">
          <label class="field-label" for="dosi">Dosi</label>
          <input type="text" id="dosi" placeholder="p. ex. 650mg, 1 comprimit...">
        </div>
        <div class="field">
          <label class="field-label" for="motiu">Motiu (opcional)</label>
          <input type="text" id="motiu" placeholder="p. ex. mal de cap, dolor lumbar...">
        </div>
        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari"></textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary" id="submit-btn">Desar presa</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últimes preses</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelector("#nom").value = btn.dataset.preset;
      container.querySelector("#nom").focus();
    });
  });
  container.querySelectorAll("[data-remove-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.removePreset;
      saveOptionalPresets(getOptionalPresets().filter(item => item !== name));
      btn.closest(".removable-preset")?.remove();
    });
  });

  await refreshList(container);

  container.querySelector("#med-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const nom = form.querySelector("#nom").value.trim();
    if (!nom) { alert("Escriu el nom del medicament o suplement."); return; }
    const payload = {
      id: editingId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      nom,
      dosi: form.querySelector("#dosi").value.trim(),
      motiu: form.querySelector("#motiu").value.trim(),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    await renderMedication(container);
  });
}

async function editEntry(container, id) {
  const entry = await repo.get(id);
  if (!entry) return;
  editingId = id;

  container.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  container.querySelector("#nom").value = entry.nom || "";
  container.querySelector("#dosi").value = entry.dosi || "";
  container.querySelector("#motiu").value = entry.motiu || "";
  container.querySelector("#comentari").value = entry.comentari || "";

  container.querySelector("#form-title").textContent = "Editant presa";
  container.querySelector("#submit-btn").textContent = "Desar canvis";
  container.querySelector("#editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant una presa existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancel·la</button>
    </div>
  `;
  container.querySelector("#cancel-edit-btn").addEventListener("click", () => renderMedication(container));
  container.querySelector("#med-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(container, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await repo.delete(id);
  await renderMedication(container);
}

async function refreshList(container) {
  const recent = await repo.getRecent("timestamp", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap presa registrada.</p>`;
    return;
  }
  list.innerHTML = recent.map(e => `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        <span class="row-actions">
          <button type="button" data-edit="${e.id}">editar</button>
          <button type="button" class="danger" data-delete="${e.id}">eliminar</button>
        </span>
      </div>
      <div class="event-tags">${escapeHtml(e.nom)}${e.dosi ? " · " + escapeHtml(e.dosi) : ""}${e.motiu ? " · " + escapeHtml(e.motiu) : ""}</div>
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `).join("");
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editEntry(container, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteEntry(container, btn.dataset.delete)));
}
