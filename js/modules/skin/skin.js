import { Repository, makeId } from "../../db/repository.js";
import { escapeHtml, nowISO, formatDate, sliderField, wireSliders, flashSaved, chipGroup, wireChips, getChipValues } from "../../utils/dom.js";
import { renderSkinBodyMapSvg, skinZoneLabel } from "./zones-skin.js";

const repo = new Repository("skin_episodes");

const TYPES = ["èczema", "picor", "acne", "urticària", "vermellor", "altres"].map(v => ({ value: v, label: v }));
const WHOLE_BODY_ID = "tot_el_cos";
const WHOLE_BODY_LABEL = "Tot el cos";

let currentView = "front";
let pickedZoneId = null; // zona seleccionada ara mateix, pendent d'assignar-li tipus
let entries = []; // [{ zonaId, zonaLabel, tipus: [] }]

export async function renderSkin(container) {
  currentView = "front";
  pickedZoneId = null;
  entries = [];

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — pell</span>
      <h1 class="view-title">Pell</h1>
      <p class="view-sub">Toca una zona (o "Tot el cos"), assigna-li el tipus de lesió, i afegeix-la a la llista. Pots combinar diverses zones amb tipus diferents en un mateix registre — p. ex. "mà: èczema" i "cap: picor".</p>
    </div>

    <div class="grid-2">
      <form class="card" id="skin-form" novalidate>
        <h2 class="card-title">Nou episodi</h2>

        <div class="bodymap-toggle">
          <button type="button" class="chip chip-active" data-view-toggle="front">Davant</button>
          <button type="button" class="chip" data-view-toggle="back">Darrere</button>
          <button type="button" class="chip" id="whole-body-btn">Tot el cos</button>
        </div>
        <div class="bodymap-svg-wrap" id="bodymap-wrap">${renderSkinBodyMapSvg(currentView, [])}</div>

        <div class="card" id="assign-panel" style="display:none; background: var(--paper-alt); margin-top: var(--sp-3);">
          <h3 class="card-title" id="assign-panel-title" style="font-size: var(--fs-sm);"></h3>
          ${chipGroup("tipusZona", "Tipus per a aquesta zona", TYPES)}
          <button type="button" class="btn btn-ghost" id="add-entry-btn">Afegeix a la llista</button>
        </div>

        <div class="field">
          <label class="field-label">Zones registrades en aquest episodi</label>
          <div class="bodymap-selected-list" id="entries-list"><span class="ledger-empty" style="padding:0;">Cap zona afegida encara</span></div>
        </div>

        ${sliderField("intensitat", "Intensitat / picor (general)", 0, "lleu", "molt intens")}

        <div class="field">
          <label class="field-label" for="dataInici">Data d'inici</label>
          <input type="date" id="dataInici" value="${nowISO().slice(0, 10)}">
        </div>
        <div class="field">
          <label class="field-label" for="dataFi">Data de final (deixa-ho buit si continua)</label>
          <input type="date" id="dataFi">
        </div>
        <div class="field">
          <label class="field-label" for="foto">Fotografia (opcional)</label>
          <input type="file" id="foto" accept="image/*">
        </div>
        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari"></textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary">Desar episodi</button>
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
  wireBodyMap(container);
  await refreshList(container);

  container.querySelector("#whole-body-btn").addEventListener("click", () => openAssignPanel(container, WHOLE_BODY_ID, WHOLE_BODY_LABEL));
  container.querySelector("#add-entry-btn").addEventListener("click", () => addEntry(container));

  container.querySelector("#skin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (entries.length === 0) {
      alert("Afegeix almenys una zona amb el seu tipus.");
      return;
    }
    const form = e.target;
    const fotoInput = form.querySelector("#foto");
    const fotoBlob = fotoInput.files[0] || null;

    const payload = {
      id: makeId(),
      entries: entries.map(en => ({ ...en })),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      dataInici: form.querySelector("#dataInici").value,
      dataFi: form.querySelector("#dataFi").value || null,
      comentari: form.querySelector("#comentari").value.trim(),
      foto: fotoBlob,
    };
    await repo.put(payload);
    flashSaved(container);
    entries = [];
    pickedZoneId = null;
    renderEntriesList(container);
    closeAssignPanel(container);
    renderMap(container);
    form.querySelectorAll('input[type="range"]').forEach(i => { i.value = 0; i.dispatchEvent(new Event("input")); });
    form.querySelector("#comentari").value = "";
    form.querySelector("#foto").value = "";
    form.querySelector("#dataInici").value = nowISO().slice(0, 10);
    form.querySelector("#dataFi").value = "";
    await refreshList(container);
  });
}

function wireBodyMap(container) {
  container.querySelectorAll("[data-view-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentView = btn.dataset.viewToggle;
      container.querySelectorAll("[data-view-toggle]").forEach(b => b.classList.toggle("chip-active", b === btn));
      renderMap(container);
    });
  });
  renderMap(container);
}

function renderMap(container) {
  const wrap = container.querySelector("#bodymap-wrap");
  wrap.innerHTML = renderSkinBodyMapSvg(currentView, entries.map(en => en.zonaId));
  wrap.querySelectorAll("[data-zone-id]").forEach((shape) => {
    shape.addEventListener("click", () => {
      const id = shape.dataset.zoneId;
      openAssignPanel(container, id, skinZoneLabel(id));
    });
  });
}

function openAssignPanel(container, zonaId, zonaLabel) {
  pickedZoneId = zonaId;
  const panel = container.querySelector("#assign-panel");
  panel.style.display = "block";
  container.querySelector("#assign-panel-title").textContent = `Tipus per a: ${zonaLabel}`;
  container.querySelectorAll('.chip[data-chip-group="tipusZona"]').forEach(c => c.classList.remove("chip-active"));
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeAssignPanel(container) {
  pickedZoneId = null;
  container.querySelector("#assign-panel").style.display = "none";
}

function addEntry(container) {
  if (!pickedZoneId) return;
  const tipus = getChipValues(container, "tipusZona");
  if (tipus.length === 0) {
    alert("Selecciona almenys un tipus per a aquesta zona.");
    return;
  }
  const zonaLabel = pickedZoneId === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(pickedZoneId);
  entries = entries.filter(en => en.zonaId !== pickedZoneId);
  entries.push({ zonaId: pickedZoneId, zonaLabel, tipus });
  closeAssignPanel(container);
  renderMap(container);
  renderEntriesList(container);
}

function removeEntry(container, zonaId) {
  entries = entries.filter(en => en.zonaId !== zonaId);
  renderMap(container);
  renderEntriesList(container);
}

function renderEntriesList(container) {
  const list = container.querySelector("#entries-list");
  if (entries.length === 0) {
    list.innerHTML = `<span class="ledger-empty" style="padding:0;">Cap zona afegida encara</span>`;
    return;
  }
  list.innerHTML = entries.map(en => `
    <span class="badge">${escapeHtml(en.zonaLabel)}: ${en.tipus.map(escapeHtml).join(", ")}
      <span data-remove-entry="${en.zonaId}" style="cursor:pointer; margin-left:4px;">×</span>
    </span>
  `).join("");
  list.querySelectorAll("[data-remove-entry]").forEach(el => {
    el.addEventListener("click", () => removeEntry(container, el.dataset.removeEntry));
  });
}

async function refreshList(container) {
  const recent = await repo.getRecent("dataInici", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap episodi registrat.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  recent.forEach((e) => {
    if (!e.foto) return;
    const img = list.querySelector(`[data-photo-for="${e.id}"]`);
    if (img) img.src = URL.createObjectURL(e.foto);
  });
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Segur que vols eliminar aquest episodi?")) return;
      await repo.delete(btn.dataset.delete);
      await refreshList(container);
    });
  });
}

function rowTemplate(e) {
  const entriesLabel = (e.entries || []).map(en => `${en.zonaLabel}: ${en.tipus.join(", ")}`).join(" · ");
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDate(e.dataInici)}${e.dataFi ? " – " + formatDate(e.dataFi) : " (obert)"}</span>
        <span class="badge">${e.intensitat}/10</span>
        <span class="row-actions"><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      <div class="event-tags">${escapeHtml(entriesLabel)}</div>
      ${e.foto ? `<img data-photo-for="${e.id}" style="max-width:120px;border-radius:8px;margin-top:4px;" alt="foto episodi pell">` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
