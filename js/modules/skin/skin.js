import { Repository, makeId } from "../../db/repository.js";
import { escapeHtml, nowISO, formatDate, sliderField, wireSliders, flashSaved, chipGroup, getChipValues } from "../../utils/dom.js";
import { renderSkinBodyMapSvg, skinZoneLabel } from "./zones-skin.js";

const repo = new Repository("skin_episodes");

const TYPES = ["èczema", "picor", "acne", "urticària", "vermellor", "crostes", "altres"].map(v => ({ value: v, label: v }));
const WHOLE_BODY_ID = "tot_el_cos";
const WHOLE_BODY_LABEL = "Tot el cos";

let currentView = "front";
let pickingZones = []; // zones tocades ara mateix, pendents d'assignar com a grup
let entries = []; // grups confirmats: [{ zonaIds, zonaLabels, tipus: [] }]
let editingId = null;

export async function renderSkin(container) {
  currentView = "front";
  pickingZones = [];
  entries = [];
  editingId = null;

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — pell</span>
      <h1 class="view-title">Pell</h1>
      <p class="view-sub">Toca totes les zones on tens el mateix tipus de lesió, assigna'ls el tipus juntes i afegeix-les com a grup. Pots repetir-ho amb altres zones si tenen un tipus diferent. Cada registre correspon a un sol dia.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="skin-form" novalidate>
        <h2 class="card-title" id="form-title">Nou registre</h2><div id="editing-banner"></div>

        <div class="bodymap-toggle">
          <button type="button" class="chip chip-active" data-view-toggle="front">Davant</button>
          <button type="button" class="chip" data-view-toggle="back">Darrere</button>
          <button type="button" class="chip" id="whole-body-btn">Tot el cos</button>
        </div>
        <div class="bodymap-svg-wrap" id="bodymap-wrap">${renderSkinBodyMapSvg(currentView, [], [])}</div>

        <div class="field">
          <label class="field-label">Zones tocades ara (pendents d'assignar)</label>
          <div class="bodymap-selected-list" id="picking-list"><span class="ledger-empty" style="padding:0;">Cap zona tocada</span></div>
          <button type="button" class="btn btn-ghost" id="assign-group-btn" style="margin-top: var(--sp-2);" disabled>Selecciona el tipus</button>
        </div>

        <div class="card" id="assign-panel" style="display:none; background: var(--paper-alt); margin-top: var(--sp-3);">
          <h3 class="card-title" id="assign-panel-title" style="font-size: var(--fs-sm);"></h3>
          ${chipGroup("tipusZona", "Tipus per a aquest grup de zones", TYPES)}
          <button type="button" class="btn btn-primary" id="add-entry-btn">Confirma la zona i el tipus</button>
        </div>

        <div class="field">
          <label class="field-label">Grups registrats avui</label>
          <div class="bodymap-selected-list" id="entries-list"><span class="ledger-empty" style="padding:0;">Cap grup afegit encara</span></div>
          <p class="save-status" id="skin-group-status" role="status" aria-live="polite"></p>
        </div>

        ${sliderField("intensitat", "Intensitat / picor (general)", 0, "lleu", "molt intens")}

        <div class="field">
          <label class="field-label" for="dataInici">Data</label>
          <input type="date" id="dataInici" value="${nowISO().slice(0, 10)}">
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
          <button type="submit" class="btn btn-primary" id="save-skin-btn">Desar registre</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
        <p class="save-status" id="skin-save-status" role="status" aria-live="polite"></p>
      </form>

      <div class="card">
        <h2 class="card-title">Últims registres</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireTypeChips(container);
  wireBodyMap(container);

  container.querySelector("#whole-body-btn").addEventListener("click", () => {
    if (committedZoneIds().length > 0) return;
    pickingZones = pickingZones.includes(WHOLE_BODY_ID) ? [] : [WHOLE_BODY_ID];
    renderMap(container);
    renderPickingList(container);
  });
  container.querySelector("#assign-group-btn").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAssignPanel(container, false);
  });
  container.querySelector("#add-entry-btn").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    addEntry(container);
  });

  container.querySelector("#skin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (entries.length === 0) {
      alert("Afegeix almenys una zona amb el seu tipus.");
      return;
    }
    const form = e.currentTarget;
    const saveButton = form.querySelector("#save-skin-btn");
    const saveStatus = form.querySelector("#skin-save-status");
    const originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Desant…";
    saveStatus.textContent = "";

    try {
      const fotoInput = form.querySelector("#foto");
      const fotoBlob = fotoInput.files[0] || null;
      const payload = {
        id: editingId || makeId(),
        entries: entries.map(en => ({ ...en, zonaIds: [...en.zonaIds], zonaLabels: [...en.zonaLabels], tipus: [...en.tipus] })),
        intensitat: Number(form.querySelector('[name="intensitat"]').value),
        dataInici: form.querySelector("#dataInici").value,
        dataFi: null,
        comentari: form.querySelector("#comentari").value.trim(),
        foto: fotoBlob,
      };
      await repo.put(payload);
      flashSaved(container);
      saveStatus.textContent = "Registre de pell desat correctament.";
      editingId = null;
      container.querySelector("#form-title").textContent = "Nou registre";
      container.querySelector("#editing-banner").innerHTML = "";
      entries = [];
      pickingZones = [];
      container.querySelector("#skin-group-status").textContent = "";
      renderEntriesList(container);
      closeAssignPanel(container);
      renderMap(container);
      renderPickingList(container);
      form.querySelectorAll('input[type="range"]').forEach(i => { i.value = 0; i.dispatchEvent(new Event("input")); });
      form.querySelector("#comentari").value = "";
      form.querySelector("#foto").value = "";
      form.querySelector("#dataInici").value = nowISO().slice(0, 10);
      await refreshList(container);
    } catch (error) {
      console.error("No s'ha pogut desar el registre de pell", error);
      saveStatus.textContent = error?.message || "No s'ha pogut desar el registre. Torna-ho a provar.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalLabel;
    }
  });

  // La càrrega de l'historial no pot impedir que el formulari quedi connectat.
  // Tots els controls i el submit ja tenen els seus listeners abans d'aquest await.
  await refreshList(container);
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

function committedZoneIds() {
  return entries.flatMap(en => Array.isArray(en.zonaIds) ? en.zonaIds : (en.zonaId ? [en.zonaId] : []));
}

function labelsForEntry(en) {
  if (Array.isArray(en.zonaLabels) && en.zonaLabels.length) return en.zonaLabels;
  if (en.zonaLabel) return [en.zonaLabel];
  if (Array.isArray(en.zonaIds)) return en.zonaIds.map(id => id === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(id));
  if (en.zonaId) return [en.zonaId === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(en.zonaId)];
  return [];
}

function renderMap(container) {
  const wrap = container.querySelector("#bodymap-wrap");
  const committed = committedZoneIds();
  wrap.innerHTML = renderSkinBodyMapSvg(currentView, committed, pickingZones);
  const wholeBodyBtn = container.querySelector("#whole-body-btn");
  wholeBodyBtn?.classList.toggle("chip-active", committed.includes(WHOLE_BODY_ID) || pickingZones.includes(WHOLE_BODY_ID));
  wrap.querySelectorAll("[data-zone-id]").forEach((shape) => {
    shape.addEventListener("click", () => {
      const id = shape.dataset.zoneId;
      if (committed.includes(id) || committed.includes(WHOLE_BODY_ID)) return;
      if (pickingZones.includes(WHOLE_BODY_ID)) pickingZones = [];
      pickingZones = pickingZones.includes(id) ? pickingZones.filter(z => z !== id) : [...pickingZones, id];
      renderMap(container);
      renderPickingList(container);
    });
  });
}

function renderPickingList(container) {
  const list = container.querySelector("#picking-list");
  const btn = container.querySelector("#assign-group-btn");
  if (!list || !btn) return;
  if (pickingZones.length === 0) {
    list.innerHTML = `<span class="ledger-empty" style="padding:0;">Cap zona tocada</span>`;
    btn.disabled = true;
    closeAssignPanel(container);
    return;
  }
  list.innerHTML = pickingZones.map(id => `<span class="badge">${escapeHtml(id === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(id))}</span>`).join("");
  btn.disabled = false;
  const status = container.querySelector("#skin-group-status");
  if (status) status.textContent = "";
  openAssignPanel(container, false);
}

function wireTypeChips(container) {
  container.querySelectorAll('.chip[data-chip-group="tipusZona"]').forEach((chip) => {
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      const active = chip.classList.toggle("chip-active");
      chip.setAttribute("aria-pressed", String(active));
    });
  });
}

function openAssignPanel(container, resetTypes = true) {
  if (pickingZones.length === 0) return;
  const panel = container.querySelector("#assign-panel");
  panel.style.display = "block";
  const labels = pickingZones.map(id => id === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(id));
  container.querySelector("#assign-panel-title").textContent = `Tipus per a: ${labels.join(", ")}`;
  if (resetTypes) {
    container.querySelectorAll('.chip[data-chip-group="tipusZona"]').forEach((chip) => {
      chip.classList.remove("chip-active");
      chip.setAttribute("aria-pressed", "false");
    });
  }
  if (resetTypes) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeAssignPanel(container) {
  const panel = container.querySelector("#assign-panel");
  if (!panel) return;
  panel.style.display = "none";
  panel.querySelectorAll('.chip[data-chip-group="tipusZona"]').forEach((chip) => {
    chip.classList.remove("chip-active");
    chip.setAttribute("aria-pressed", "false");
  });
}

function addEntry(container) {
  if (pickingZones.length === 0) return;
  const tipus = getChipValues(container, "tipusZona");
  if (tipus.length === 0) {
    alert("Selecciona almenys un tipus per a aquest grup de zones.");
    return;
  }
  const zonaIds = [...pickingZones];
  const zonaLabels = zonaIds.map(id => id === WHOLE_BODY_ID ? WHOLE_BODY_LABEL : skinZoneLabel(id));
  entries.push({
    zonaIds,
    zonaLabels,
    // Camps legacy per mantenir compatibilitat amb resums antics.
    zonaId: zonaIds.length === 1 ? zonaIds[0] : null,
    zonaLabel: zonaLabels.join(" + "),
    tipus,
  });
  const status = container.querySelector("#skin-group-status");
  if (status) status.textContent = `${zonaLabels.join(" + ")}: ${tipus.join(", ")} afegit. Ara pots desar el registre.`;
  pickingZones = [];
  closeAssignPanel(container);
  renderMap(container);
  renderPickingList(container);
  renderEntriesList(container);
}

function removeEntry(container, index) {
  entries.splice(index, 1);
  renderMap(container);
  renderEntriesList(container);
}

function renderEntriesList(container) {
  const list = container.querySelector("#entries-list");
  if (entries.length === 0) {
    list.innerHTML = `<span class="ledger-empty" style="padding:0;">Cap grup afegit encara</span>`;
    return;
  }
  list.innerHTML = entries.map((en, idx) => `
    <span class="badge">${escapeHtml(labelsForEntry(en).join(" + "))}: ${(en.tipus || []).map(escapeHtml).join(", ")}
      <span data-remove-entry="${idx}" style="cursor:pointer; margin-left:4px;">×</span>
    </span>
  `).join("");
  list.querySelectorAll("[data-remove-entry]").forEach(el => {
    el.addEventListener("click", () => removeEntry(container, Number(el.dataset.removeEntry)));
  });
}

async function editSkinEntry(container,id){
  const e=await repo.get(id);if(!e)return;
  editingId=id;
  entries=(e.entries||[]).map(x=>{
    const zonaIds=Array.isArray(x.zonaIds)?[...x.zonaIds]:(x.zonaId?[x.zonaId]:[]);
    const zonaLabels=Array.isArray(x.zonaLabels)?[...x.zonaLabels]:(x.zonaLabel?[x.zonaLabel]:zonaIds.map(id=>id===WHOLE_BODY_ID?WHOLE_BODY_LABEL:skinZoneLabel(id)));
    return {...x,zonaIds,zonaLabels,zonaLabel:x.zonaLabel||zonaLabels.join(" + "),tipus:[...(x.tipus||[])]};
  });
  pickingZones=[];
  container.querySelector('[name="intensitat"]').value=e.intensitat||0;
  container.querySelector('[name="intensitat"]').dispatchEvent(new Event('input'));
  container.querySelector('#dataInici').value=e.dataInici||'';
  container.querySelector('#comentari').value=e.comentari||'';
  renderEntriesList(container);renderPickingList(container);renderMap(container);
  container.querySelector('#form-title').textContent='Editant registre';
  container.querySelector('#editing-banner').innerHTML='<div class="editing-banner"><span>Estàs editant un registre.</span><button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancel·la</button></div>';
  container.querySelector('#cancel-edit-btn').onclick=()=>renderSkin(container);
  container.querySelector('#skin-form').scrollIntoView({behavior:'smooth'});
}
async function refreshList(container) {
  const list = container.querySelector("#event-list");
  if (!list) return;
  let recent;
  try {
    recent = (await repo.getRecent("dataInici", 10)).filter((entry) => typeof entry?.dataInici === "string" && entry.dataInici);
  } catch (error) {
    console.error("No s'han pogut carregar els registres de pell", error);
    list.innerHTML = `<p class="ledger-empty">No s'han pogut carregar els últims registres. Pots continuar desant-ne de nous.</p>`;
    return;
  }
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre de pell.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  recent.forEach((e) => {
    if (!e.foto) return;
    const img = list.querySelector(`[data-photo-for="${e.id}"]`);
    if (img) img.src = URL.createObjectURL(e.foto);
  });
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editSkinEntry(container, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Segur que vols eliminar aquest registre?")) return;
      await repo.delete(btn.dataset.delete);
      await refreshList(container);
    });
  });
}

function rowTemplate(e) {
  const safeEntries = Array.isArray(e.entries) ? e.entries : [];
  const entriesLabel = safeEntries.map((en) => {
    const tipus = Array.isArray(en.tipus) ? en.tipus : (en.tipus ? [en.tipus] : []);
    return `${labelsForEntry(en).join(" + ")}: ${tipus.join(", ")}`;
  }).join(" · ");
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDate(e.dataInici)}</span>
        <span class="badge">${e.intensitat}/10</span>
        <span class="row-actions"><button type="button" data-edit="${e.id}">editar</button><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      <div class="event-tags">${escapeHtml(entriesLabel)}</div>
      ${e.foto ? `<img data-photo-for="${e.id}" style="max-width:120px;border-radius:8px;margin-top:4px;" alt="foto episodi pell">` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
