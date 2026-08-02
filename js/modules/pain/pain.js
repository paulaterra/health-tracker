import { Repository, makeId } from "../../db/repository.js";
import { escapeHtml, nowISO, nowLocalInput, localInputToISO, formatDateTime, sliderField, wireSliders, chipGroup, wireChips, getChipValues, flashSaved, intensityBadge } from "../../utils/dom.js";
import { renderBodyMapSvg, zoneLabel } from "./zones.js";

const repo = new Repository("pain_events");

const DRAWING_TYPES = [
  { value: "punxant", label: "Punxant / ganivet", color: "#d84a42" },
  { value: "cremor", label: "Cremor", color: "#ef7b45" },
  { value: "pressio", label: "Pressió / opressiu", color: "#7d6ccf" },
  { value: "contractura", label: "Contractura", color: "#c94f72" },
  { value: "rigidesa", label: "Rigidesa", color: "#6f8fae" },
  { value: "descarrega", label: "Descàrrega / elèctric", color: "#d9a21b" },
  { value: "difus", label: "Dolor difús", color: "#df6f6f" },
];

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

const PAIN_CONTEXT = [
  "al despertar",
  "després d’estar estirada",
  "durant la nit",
  "amb un moviment",
  "amb una postura concreta",
  "després d’exercici",
].map(v => ({ value: v, label: v }));

const PAIN_NATURE = [
  "dolor habitual de contractura",
  "dolor diferent o nou",
  "no ho sé",
].map(v => ({ value: v, label: v }));

const SLEEP_IMPACT = [
  "no afecta",
  "em costa trobar postura",
  "em desperta",
  "no em deixa dormir",
].map(v => ({ value: v, label: v }));

const NECK_LIMITATIONS = [
  "no puc girar el cap a l'esquerra",
  "no puc girar el cap a la dreta",
  "no puc girar el cap amunt",
  "no puc girar el cap avall",
].map(v => ({ value: v, label: v }));

let currentView = "front";
let pickingZones = [];   // zones tocades ara mateix, pendents d'assignar com a grup
let entries = [];        // grups ja confirmats
let drawingStrokes = []; // traços pintats sobre la figura
let interactionMode = "zones";
let activeBrushType = DRAWING_TYPES[0].value;
let activeBrushSize = 12;
let drawingPointer = null;

export async function renderPain(container) {
  currentView = "front";
  pickingZones = [];
  entries = [];
  drawingStrokes = [];
  interactionMode = "zones";
  activeBrushType = DRAWING_TYPES[0].value;
  activeBrushSize = 12;

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

        <div class="bodymap-modebar">
          <div class="bodymap-toggle">
            <button type="button" class="chip chip-active" data-view-toggle="front">Davant</button>
            <button type="button" class="chip" data-view-toggle="back">Darrere</button>
          </div>
          <div class="bodymap-toggle">
            <button type="button" class="chip chip-active" data-interaction-mode="zones">Seleccionar zones</button>
            <button type="button" class="chip" data-interaction-mode="paint">Pintar dolor</button>
          </div>
        </div>

        <div class="pain-paint-tools" id="paint-tools" hidden>
          <div class="field" style="margin:0;">
            <label class="field-label">Tipus de dolor del pinzell</label>
            <div class="paint-type-grid">
              ${DRAWING_TYPES.map((type, index) => `<button type="button" class="paint-type ${index === 0 ? "active" : ""}" data-brush-type="${type.value}" style="--paint-color:${type.color}"><span></span>${type.label}</button>`).join("")}
            </div>
          </div>
          <div class="paint-size-row">
            <span class="field-label" style="margin:0;">Mida</span>
            <button type="button" class="chip" data-brush-size="7">Punt</button>
            <button type="button" class="chip chip-active" data-brush-size="12">Mitjana</button>
            <button type="button" class="chip" data-brush-size="20">Zona gran</button>
            <button type="button" class="btn btn-ghost" id="undo-stroke-btn">Desfer últim</button>
            <button type="button" class="btn btn-ghost" id="clear-strokes-btn">Esborrar dibuix</button>
          </div>
          <p class="paint-help">Arrossega el dit o el ratolí sobre la figura. Pots canviar de color per diferenciar els tipus de dolor.</p>
        </div>
        <div class="bodymap-svg-wrap" id="bodymap-wrap">${renderBodyMapSvg(currentView, [], [], [])}</div>

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
        ${chipGroup("empitjora", "Quan empitjora?", PAIN_CONTEXT)}
        ${chipGroup("naturalesaDolor", "És el mateix dolor de sempre?", PAIN_NATURE, [])}
        ${chipGroup("impacteSon", "Com afecta el son?", SLEEP_IMPACT, [])}
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

      <div style="display:flex; flex-direction:column; gap:var(--sp-4);">
        <div class="card">
          <h2 class="card-title">Anàlisi intel·ligent del dolor</h2>
          <p class="view-sub" style="margin-bottom:var(--sp-3);">Analitza localment els teus registres. No envia dades a cap servei extern i no substitueix una valoració mèdica.</p>
          <div id="pain-ai-insights"><p class="ledger-empty">Calculant…</p></div>
        </div>
        <div class="card">
          <h2 class="card-title">Últims registres</h2>
          <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
        </div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireChips(container);
  wireBodyMap(container);
  wirePaintControls(container);
  await refreshList(container);
  await refreshPainInsights(container);

  container.querySelector("#assign-group-btn").addEventListener("click", () => openAssignPanel(container));
  container.querySelector("#add-entry-btn").addEventListener("click", () => addEntry(container));

  container.querySelector("#pain-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (entries.length === 0 && drawingStrokes.length === 0) {
      alert("Selecciona almenys una zona o pinta el dolor sobre la figura.");
      return;
    }
    const form = e.target;
    const payload = {
      id: makeId(),
      timestamp: localInputToISO(container.querySelector("#entryDatetime").value),
      entries: entries.map(en => ({ ...en })),
      painDrawing: drawingStrokes.map(stroke => ({ ...stroke, points: stroke.points.map(p => ({...p})) })),
      intensitat: Number(form.querySelector('[name="intensitat"]').value),
      empitjora: getChipValues(container, "empitjora"),
      naturalesaDolor: getChipValues(container, "naturalesaDolor"),
      impacteSon: getChipValues(container, "impacteSon"),
      limitacions: getChipValues(container, "limitacions"),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    flashSaved(container);
    resetForm(container, form);
    await refreshList(container);
    await refreshPainInsights(container);
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
  container.querySelectorAll("[data-interaction-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      interactionMode = btn.dataset.interactionMode;
      container.querySelectorAll("[data-interaction-mode]").forEach(b => b.classList.toggle("chip-active", b === btn));
      container.querySelector("#paint-tools").hidden = interactionMode !== "paint";
      renderMap(container);
    });
  });
  renderMap(container);
}

function wirePaintControls(container) {
  container.querySelectorAll("[data-brush-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeBrushType = btn.dataset.brushType;
      container.querySelectorAll("[data-brush-type]").forEach(b => b.classList.toggle("active", b === btn));
    });
  });
  container.querySelectorAll("[data-brush-size]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeBrushSize = Number(btn.dataset.brushSize);
      container.querySelectorAll("[data-brush-size]").forEach(b => b.classList.toggle("chip-active", b === btn));
    });
  });
  container.querySelector("#undo-stroke-btn").addEventListener("click", () => {
    for (let i = drawingStrokes.length - 1; i >= 0; i--) {
      if (drawingStrokes[i].view === currentView) {
        drawingStrokes.splice(i, 1);
        break;
      }
    }
    renderMap(container);
  });
  container.querySelector("#clear-strokes-btn").addEventListener("click", () => {
    drawingStrokes = drawingStrokes.filter(stroke => stroke.view !== currentView);
    renderMap(container);
  });
}

function committedZoneIds() {
  return entries.flatMap(en => en.zonaIds);
}

function renderMap(container) {
  const wrap = container.querySelector("#bodymap-wrap");
  wrap.classList.toggle("paint-mode", interactionMode === "paint");
  wrap.innerHTML = renderBodyMapSvg(currentView, committedZoneIds(), pickingZones, drawingStrokes);
  const svg = wrap.querySelector("svg");

  wrap.querySelectorAll("[data-zone-id]").forEach((shape) => {
    shape.addEventListener("click", () => {
      if (interactionMode !== "zones") return;
      const id = shape.dataset.zoneId;
      if (committedZoneIds().includes(id)) return;
      pickingZones = pickingZones.includes(id) ? pickingZones.filter(z => z !== id) : [...pickingZones, id];
      renderMap(container);
      renderPickingList(container);
    });
  });

  if (interactionMode === "paint") wireDrawingSurface(container, svg);
}

function svgPoint(svg, event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(240, ((event.clientX - rect.left) / rect.width) * 240)),
    y: Math.max(0, Math.min(480, ((event.clientY - rect.top) / rect.height) * 480)),
  };
}

function activeBrush() {
  return DRAWING_TYPES.find(type => type.value === activeBrushType) || DRAWING_TYPES[0];
}

function wireDrawingSurface(container, svg) {
  svg.style.touchAction = "none";
  svg.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    svg.setPointerCapture?.(event.pointerId);
    const brush = activeBrush();
    drawingPointer = {
      id: makeId(),
      view: currentView,
      type: brush.value,
      label: brush.label,
      color: brush.color,
      size: activeBrushSize,
      points: [svgPoint(svg, event)],
    };
    drawingStrokes.push(drawingPointer);
    appendLiveStroke(svg, drawingPointer);
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drawingPointer) return;
    event.preventDefault();
    const point = svgPoint(svg, event);
    const last = drawingPointer.points[drawingPointer.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 1.5) return;
    drawingPointer.points.push(point);
    updateLiveStroke(svg, drawingPointer);
  });
  const finish = () => { drawingPointer = null; };
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
  svg.addEventListener("pointerleave", (event) => { if (event.buttons === 0) finish(); });
}

function appendLiveStroke(svg, stroke) {
  const ns = "http://www.w3.org/2000/svg";
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute("class", "pain-stroke");
  line.dataset.strokeId = stroke.id;
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", stroke.color);
  line.setAttribute("stroke-width", stroke.size);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("opacity", "0.72");
  svg.querySelector(".pain-drawing-layer").appendChild(line);
  updateLiveStroke(svg, stroke);
}

function updateLiveStroke(svg, stroke) {
  const line = svg.querySelector(`[data-stroke-id="${stroke.id}"]`);
  if (line) line.setAttribute("points", stroke.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
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
  container.querySelectorAll('.chip[data-chip-group="limitacions"], .chip[data-chip-group="empitjora"], .chip[data-chip-group="naturalesaDolor"], .chip[data-chip-group="impacteSon"]').forEach(c => c.classList.remove("chip-active"));
  entries = [];
  pickingZones = [];
  drawingStrokes = [];
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
      await refreshPainInsights(container);
    });
  });
}

function rowTemplate(e) {
  const entriesLabel = (e.entries || []).map(en => {
    const tipusText = en.tipus.join(", ") + (en.tipusAltresText ? ` (${en.tipusAltresText})` : "");
    const patroText = en.patroTemporal?.length ? " — " + en.patroTemporal.join(", ") : "";
    return `${en.zonaLabels.join(" + ")}: ${tipusText}${patroText}`;
  }).join(" · ");
  const drawingTypes = [...new Set((e.painDrawing || []).map(stroke => stroke.label || stroke.type))];
  const drawingLabel = drawingTypes.length ? `Mapa pintat: ${drawingTypes.join(", ")}` : "";
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        ${intensityBadge(e.intensitat)}
        <span class="row-actions"><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      ${entriesLabel ? `<div class="event-tags">${escapeHtml(entriesLabel)}</div>` : ""}
      ${drawingLabel ? `<div class="event-tags">${escapeHtml(drawingLabel)}</div>` : ""}
      ${e.empitjora?.length ? `<div class="event-tags">Empitjora: ${e.empitjora.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.naturalesaDolor?.length ? `<div class="event-tags">Tipus d’episodi: ${e.naturalesaDolor.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.impacteSon?.length ? `<div class="event-tags">Son: ${e.impacteSon.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.limitacions?.length ? `<div class="event-tags" style="color: var(--clay);">${e.limitacions.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}


async function refreshPainInsights(container) {
  const target = container.querySelector("#pain-ai-insights");
  if (!target) return;
  const records = (await repo.getAll()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (records.length < 3) {
    target.innerHTML = `<p class="ledger-empty">Encara falten dades. Amb 3 registres començaré a resumir tendències; amb 8 o més seran més útils.</p>`;
    return;
  }

  const zoneCounts = new Map();
  const typeCounts = new Map();
  const contextCounts = new Map();
  const sleepCounts = new Map();
  let intensityTotal = 0;
  records.forEach(record => {
    intensityTotal += Number(record.intensitat || 0);
    (record.entries || []).forEach(entry => {
      (entry.zonaLabels || []).forEach(label => zoneCounts.set(label, (zoneCounts.get(label) || 0) + 1));
      (entry.tipus || []).forEach(type => typeCounts.set(type, (typeCounts.get(type) || 0) + 1));
    });
    (record.painDrawing || []).forEach(stroke => {
      const label = stroke.label || stroke.type;
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    });
    (record.empitjora || []).forEach(value => contextCounts.set(value, (contextCounts.get(value) || 0) + 1));
    (record.impacteSon || []).forEach(value => sleepCounts.set(value, (sleepCounts.get(value) || 0) + 1));
  });

  const top = map => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const insights = [];
  const topZone = top(zoneCounts);
  const topType = top(typeCounts);
  const topContext = top(contextCounts);
  const sleepAffected = records.filter(r => (r.impacteSon || []).some(v => v !== "no afecta")).length;
  const avg = intensityTotal / records.length;

  insights.push(`La intensitat mitjana dels ${records.length} registres és de ${avg.toFixed(1)}/10.`);
  if (topZone) insights.push(`La zona registrada més sovint és <strong>${escapeHtml(topZone[0])}</strong> (${topZone[1]} episodis).`);
  if (topType) insights.push(`La sensació més repetida és <strong>${escapeHtml(topType[0])}</strong>.`);
  if (topContext) insights.push(`El factor que més coincideix amb l'empitjorament és <strong>${escapeHtml(topContext[0])}</strong>.`);
  if (sleepAffected) insights.push(`El dolor afecta el son en ${sleepAffected} de ${records.length} registres (${Math.round(sleepAffected / records.length * 100)}%).`);

  if (records.length >= 8) {
    const split = Math.floor(records.length / 2);
    const avgPart = rows => rows.reduce((sum, r) => sum + Number(r.intensitat || 0), 0) / Math.max(1, rows.length);
    const before = avgPart(records.slice(0, split));
    const after = avgPart(records.slice(split));
    const diff = after - before;
    if (Math.abs(diff) >= 0.7) {
      insights.push(`La intensitat sembla ${diff > 0 ? "augmentar" : "disminuir"}: ${before.toFixed(1)}/10 a la primera meitat i ${after.toFixed(1)}/10 a la segona.`);
    }
  }

  target.innerHTML = `<div class="ai-insight-list">${insights.map(text => `<div class="ai-insight"><span>✦</span><p>${text}</p></div>`).join("")}</div>
    <p class="ai-disclaimer">És una anàlisi estadística local, no un diagnòstic. Per buscar relacions amb son, cicle, exercici o digestiu, consulta l'apartat «Patrons detectats».</p>`;
}
