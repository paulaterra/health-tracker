import { Repository, makeId } from "../../db/repository.js";
import { escapeHtml, nowISO, nowLocalInput, localInputToISO, formatDateTime, sliderField, wireSliders, chipGroup, wireChips, getChipValues, flashSaved, intensityBadge } from "../../utils/dom.js";
import { renderBodyMapSvg, zoneLabel } from "./zones.js";

const repo = new Repository("pain_events");

const PAIN_TYPES = [
  "dolor", "sord (mal difús)", "muscular", "tensió", "punxant", "polsàtil",
  "cremor", "elèctric / descàrrega", "pressió / opressiu", "rigidesa",
  "espasme", "estrebada", "formigueig", "adormiment", "altres",
].map(v => ({ value: v, label: v }));

const TIME_PATTERN = [
  "sempre present (constant)",
  "en despertar-me, després millora",
  "durant la nit / m'impedeix dormir",
  "durant tot el dia",
  "va i ve durant el dia",
  "només en fer un moviment concret",
].map(v => ({ value: v, label: v }));

const NECK_LIMITATIONS = [
  "no puc girar el cap a l'esquerra",
  "no puc girar el cap a la dreta",
  "no puc girar el cap amunt",
  "no puc girar el cap avall",
].map(v => ({ value: v, label: v }));

let currentView = "front";
let pickingZones = [];   // zones tocades ara mateix, pendents d'assignar com a grup
let entries = [];        // grups ja confirmats: [{ zonaIds:[], zonaLabels:[], tipus:[], tipusAltresText, patroTemporal:[] }]

export async function renderPain(container) {
  currentView = "front";
  pickingZones = [];
  entries = [];

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — dolor corporal</span>
      <h1 class="view-title">Dolor corporal</h1>
      <p class="view-sub">Toca totes les zones que formen un mateix dolor (p. ex. espatlla + braç + avantbraç si el dolor "baixa"), assigna'ls el tipus i el patró temporal junts, i afegeix-los com a grup. Pots repetir-ho amb altres zones per a un dolor diferent.</p>
    </div>

    <div class="grid-2">
      <form class="card" id="pain-form" novalidate>
        <h2 class="card-title">Nou registre</h2>

        <div class="field">
          <label class="field-label" for="entryDatetime">Data i hora</label>
          <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
        </div>

        <div class="bodymap-toggle">
          <button type="button" class="chip chip-active" data-view-toggle="front">Davant</button>
          <button type="button" class="chip" data-view-toggle="back">Darrere</button>
        </div>
        <div class="bodymap-svg-wrap" id="bodymap-wrap">${renderBodyMapSvg(currentView, [], [])}</div>

        <div class="field">
          <label class="field-label">Zones tocades ara (pendents d'assignar)</label>
          <div class="bodymap-selected-list" id="picking-list"><span class="ledger-empty" style="padding:0;">Cap zona tocada</span></div>
          <button type="button" class="btn btn-ghost" id="assign-group-btn" style="margin-top: var(--sp-2);" disabled>Assigna tipus i patró a aquestes zones</button>
        </div>

        <div class="card" id="assign-panel" style="display:none; background: var(--paper-alt); margin-top: var(--sp-3);">
          <h3 class="card-title" id="assign-panel-title" style="font-size: var(--fs-sm);"></h3>
          ${chipGroup("tipusZona", "Tipus de dolor per a aquest grup de zones", PAIN_TYPES)}
          <div class="field">
            <label class="field-label" for="tipusAltresText">Si has marcat "altres", especifica'l</label>
            <input type="text" id="tipusAltresText" placeholder="p. ex. sensació d'inflor, pessic...">
          </div>
          ${chipGroup("patroZona", "Patró temporal per a aquest grup de zones", TIME_PATTERN)}
          <button type="button" class="btn btn-primary" id="add-entry-btn">Afegeix aquest grup a la llista</button>
        </div>

        <div class="field">
          <label class="field-label">Grups registrats en aquest episodi</label>
          <div class="bodymap-selected-list" id="entries-list"><span class="ledger-empty" style="padding:0;">Cap grup afegit encara</span></div>
        </div>

        ${sliderField("intensitat", "Intensitat general", 0, "sense dolor", "dolor extrem")}
        ${chipGroup("limitacions", "Limitacions de moviment (coll)", NECK_LIMITATIONS)}

        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari" placeholder="Circumstàncies, què l'ha alleujat, etc."></textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary">Desar registre</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últims registres</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireChips(container);
  wireBodyMap(container);
  await refreshList(container);

  container.querySelector("#assign-group-btn").addEventListener("click", () => openAssignPanel(container));
  container.querySelector("#add-entry-btn").addEventListener("click", () => addEntry(container));

  container.querySelector("#pain-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (entries.length === 0) {
      alert("Afegeix almenys un grup de zones amb el seu tipus.");
      return;
    }
    const form = e.target;
    const payload = {
      id: makeId(),
      timestamp: localInputToISO(container.querySelector("#entryDatetime").value),
      entries: entries.map(en => ({ ...en })),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      limitacions: getChipValues(container, "limitacions"),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    resetForm(container, form);
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

function committedZoneIds() {
  return entries.flatMap(en => en.zonaIds);
}

function renderMap(container) {
  const wrap = container.querySelector("#bodymap-wrap");
  wrap.innerHTML = renderBodyMapSvg(currentView, committedZoneIds(), pickingZones);
  wrap.querySelectorAll("[data-zone-id]").forEach((shape) => {
    shape.addEventListener("click", () => {
      const id = shape.dataset.zoneId;
      if (committedZoneIds().includes(id)) return; // ja forma part d'un grup confirmat
      pickingZones = pickingZones.includes(id) ? pickingZones.filter(z => z !== id) : [...pickingZones, id];
      renderMap(container);
      renderPickingList(container);
    });
  });
}

function renderPickingList(container) {
  const list = container.querySelector("#picking-list");
  const btn = container.querySelector("#assign-group-btn");
  if (pickingZones.length === 0) {
    list.innerHTML = `<span class="ledger-empty" style="padding:0;">Cap zona tocada</span>`;
    btn.disabled = true;
    return;
  }
  list.innerHTML = pickingZones.map(id => `<span class="badge">${zoneLabel(id)}</span>`).join("");
  btn.disabled = false;
}

function openAssignPanel(container) {
  if (pickingZones.length === 0) return;
  const panel = container.querySelector("#assign-panel");
  panel.style.display = "block";
  container.querySelector("#assign-panel-title").textContent = `Tipus i patró per a: ${pickingZones.map(zoneLabel).join(", ")}`;
  container.querySelectorAll('.chip[data-chip-group="tipusZona"]').forEach(c => c.classList.remove("chip-active"));
  container.querySelectorAll('.chip[data-chip-group="patroZona"]').forEach(c => c.classList.remove("chip-active"));
  container.querySelector("#tipusAltresText").value = "";
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeAssignPanel(container) {
  container.querySelector("#assign-panel").style.display = "none";
}

function addEntry(container) {
  if (pickingZones.length === 0) return;
  const tipus = getChipValues(container, "tipusZona");
  const patroTemporal = getChipValues(container, "patroZona");
  if (tipus.length === 0) {
    alert("Selecciona almenys un tipus de dolor per a aquest grup.");
    return;
  }
  const tipusAltresText = container.querySelector("#tipusAltresText").value.trim();
  entries.push({
    zonaIds: [...pickingZones],
    zonaLabels: pickingZones.map(zoneLabel),
    tipus,
    tipusAltresText,
    patroTemporal,
  });
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
  list.innerHTML = entries.map((en, idx) => {
    const tipusText = en.tipus.join(", ") + (en.tipusAltresText ? ` (${en.tipusAltresText})` : "");
    const patroText = en.patroTemporal.length ? " — " + en.patroTemporal.join(", ") : "";
    return `
      <span class="badge">${escapeHtml(en.zonaLabels.join(" + "))}: ${escapeHtml(tipusText)}${escapeHtml(patroText)}
        <span data-remove-entry="${idx}" style="cursor:pointer; margin-left:4px;">×</span>
      </span>
    `;
  }).join("");
  list.querySelectorAll("[data-remove-entry]").forEach(el => {
    el.addEventListener("click", () => removeEntry(container, Number(el.dataset.removeEntry)));
  });
}

function resetForm(container, form) {
  form.querySelector("#comentari").value = "";
  form.querySelectorAll('input[type="range"]').forEach(i => { i.value = 0; i.dispatchEvent(new Event("input")); });
  container.querySelectorAll('.chip[data-chip-group="limitacions"]').forEach(c => c.classList.remove("chip-active"));
  entries = [];
  pickingZones = [];
  closeAssignPanel(container);
  renderMap(container);
  renderPickingList(container);
  renderEntriesList(container);
}

async function refreshList(container) {
  const recent = await repo.getRecent("timestamp", 10);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre de dolor.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Segur que vols eliminar aquest registre?")) return;
      await repo.delete(btn.dataset.delete);
      await refreshList(container);
    });
  });
}

function rowTemplate(e) {
  const entriesLabel = (e.entries || []).map(en => {
    const tipusText = en.tipus.join(", ") + (en.tipusAltresText ? ` (${en.tipusAltresText})` : "");
    const patroText = en.patroTemporal?.length ? " — " + en.patroTemporal.join(", ") : "";
    return `${en.zonaLabels.join(" + ")}: ${tipusText}${patroText}`;
  }).join(" · ");
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        ${intensityBadge(e.intensitat)}
        <span class="row-actions"><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      <div class="event-tags">${escapeHtml(entriesLabel)}</div>
      ${e.limitacions?.length ? `<div class="event-tags" style="color: var(--clay);">${e.limitacions.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
