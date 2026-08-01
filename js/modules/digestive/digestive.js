import { Repository } from "../../db/repository.js";
import {
  escapeHtml, nowLocalInput, isoToLocalInput, localInputToISO, formatDateTime, sliderField, wireSliders, flashSaved,
  radioChipGroup, wireRadioChips, getRadioValue, switchField,
} from "../../utils/dom.js";
import { bristolIconSvg } from "./bristol-icons.js";

const symptomsRepo = new Repository("digestive_events");
const bowelRepo = new Repository("bowel_movements");

const SYMPTOM_FIELDS = [
  { key: "inflor", label: "Inflor" },
  { key: "dolorAbdominal", label: "Dolor abdominal" },
  { key: "retortijons", label: "Retortijons" },
  { key: "gasos", label: "Gasos" },
  { key: "acidesa", label: "Acidesa" },
  { key: "nausees", label: "Nàusees" },
];

const BRISTOL_SCALE = [
  { value: "1", label: "Tipus 1", desc: "Trossos durs i separats, com nous" },
  { value: "2", label: "Tipus 2", desc: "Com una salsitxa, grumollosa" },
  { value: "3", label: "Tipus 3", desc: "Salsitxa amb esquerdes" },
  { value: "4", label: "Tipus 4", desc: "Llisa i tova, com una serp" },
  { value: "5", label: "Tipus 5", desc: "Trossos tous, vores clares" },
  { value: "6", label: "Tipus 6", desc: "Pastosa, esfilagarsada" },
  { value: "7", label: "Tipus 7", desc: "Totalment líquida" },
];

const COLOR_OPTIONS = ["normal", "clara", "fosca", "vermellosa/amb sang"].map(v => ({ value: v, label: v }));

let activeTab = "symptoms";
let editingSymptomId = null;
let editingBowelId = null;

export async function renderDigestive(container) {
  activeTab = "symptoms";
  editingSymptomId = null;
  editingBowelId = null;
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre — digestiu</span>
      <h1 class="view-title">Digestiu</h1>
      <p class="view-sub">Registra símptomes puntuals (inflor, dolor, gasos...) o una deposició amb l'escala de Bristol. Pots canviar la data/hora per registrar un dia anterior.</p>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="symptoms">Símptomes</button>
      <button class="tab-btn" data-tab="bowel">Deposició</button>
    </div>

    <div class="grid-2" id="tab-content"></div>
  `;

  wireTabs(container);
  await renderTab(container);
}

function wireTabs(container) {
  container.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      activeTab = btn.dataset.tab;
      container.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
      await renderTab(container);
    });
  });
}

async function renderTab(container) {
  const content = container.querySelector("#tab-content");
  if (activeTab === "symptoms") {
    await renderSymptomsTab(content);
  } else {
    await renderBowelTab(content);
  }
}

/* ---------------- Símptomes ---------------- */

async function renderSymptomsTab(content) {
  content.innerHTML = `
    <form class="card" id="symptoms-form" novalidate>
      <h2 class="card-title" id="symptoms-form-title">Nou registre de símptomes</h2>
      <div id="symptoms-editing-banner"></div>
      <div class="field">
        <label class="field-label" for="entryDatetime">Data i hora</label>
        <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
      </div>
      ${SYMPTOM_FIELDS.map(f => sliderField(f.key, f.label, 0, f.low || "cap", f.high || "molt intens")).join("")}
      ${switchField("llaguesBoca", "Llagues a la boca")}
      <div class="field">
        <label class="field-label" for="comentari">Comentari (opcional)</label>
        <textarea id="comentari"></textarea>
      </div>
      <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
        <button type="submit" class="btn btn-primary" id="symptoms-submit-btn">Desar símptomes</button>
        <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
      </div>
    </form>
    <div class="card">
      <h2 class="card-title">Últims registres</h2>
      <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
    </div>
  `;

  wireSliders(content);
  await refreshSymptomsList(content);

  content.querySelector("#symptoms-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      id: editingSymptomId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    SYMPTOM_FIELDS.forEach(f => { payload[f.key] = Number(form.querySelector(`[name="${f.key}"]`).value); });
    payload.llaguesBoca = form.querySelector("#llaguesBoca").checked;
    await symptomsRepo.put(payload);
    flashSaved(content);
    editingSymptomId = null;
    await renderSymptomsTab(content);
  });
}

async function editSymptomEntry(content, id) {
  const entry = await symptomsRepo.get(id);
  if (!entry) return;
  editingSymptomId = id;

  content.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  SYMPTOM_FIELDS.forEach(f => {
    const input = content.querySelector(`[name="${f.key}"]`);
    input.value = entry[f.key] || 0;
    input.dispatchEvent(new Event("input"));
  });
  content.querySelector("#llaguesBoca").checked = !!entry.llaguesBoca;
  content.querySelector("#comentari").value = entry.comentari || "";

  content.querySelector("#symptoms-form-title").textContent = "Editant registre";
  content.querySelector("#symptoms-submit-btn").textContent = "Desar canvis";
  content.querySelector("#symptoms-editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant un registre existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-symptoms-edit">Cancel·la</button>
    </div>
  `;
  content.querySelector("#cancel-symptoms-edit").addEventListener("click", () => { editingSymptomId = null; renderSymptomsTab(content); });
  content.querySelector("#symptoms-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteSymptomEntry(content, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await symptomsRepo.delete(id);
  await renderSymptomsTab(content);
}

async function refreshSymptomsList(content) {
  const recent = await symptomsRepo.getRecent("timestamp", 10);
  const list = content.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre.</p>`;
    return;
  }
  list.innerHTML = recent.map(e => {
    const tags = SYMPTOM_FIELDS.filter(f => e[f.key] > 0).map(f => `${f.label} ${e[f.key]}/10`).join(" · ");
    const tagsWithLlagues = [tags, e.llaguesBoca ? "llagues a la boca" : ""].filter(Boolean).join(" · ");
    return `
      <div class="event-row">
        <div class="event-row-top">
          <span class="event-when">${formatDateTime(e.timestamp)}</span>
          <span class="row-actions">
            <button type="button" data-edit="${e.id}">editar</button>
            <button type="button" class="danger" data-delete="${e.id}">eliminar</button>
          </span>
        </div>
        <div class="event-tags">${escapeHtml(tagsWithLlagues || "sense símptomes destacats")}</div>
        ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
      </div>
    `;
  }).join("");
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editSymptomEntry(content, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteSymptomEntry(content, btn.dataset.delete)));
}

/* ---------------- Deposició (Bristol) ---------------- */

async function renderBowelTab(content) {
  content.innerHTML = `
    <form class="card" id="bowel-form" novalidate>
      <h2 class="card-title" id="bowel-form-title">Nova deposició</h2>
      <div id="bowel-editing-banner"></div>
      <div class="field">
        <label class="field-label" for="entryDatetime">Data i hora</label>
        <input type="datetime-local" id="entryDatetime" value="${nowLocalInput()}">
      </div>
      <div class="field">
        <label class="field-label">Escala de Bristol</label>
        <div class="bristol-grid" data-radio-container="bristol">
          ${BRISTOL_SCALE.map(b => `
            <button type="button" class="bristol-card" data-radio-group="bristol" data-value="${b.value}" title="${b.desc}">
              <span class="bristol-icon">${bristolIconSvg(b.value)}</span>
              <span class="bristol-card-label">${b.label}</span>
            </button>
          `).join("")}
        </div>
        <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin-top: var(--sp-2);" id="bristol-desc">Toca un tipus per veure la descripció.</p>
      </div>
      ${switchField("urgencia", "Urgència per anar al lavabo")}
      ${switchField("buidatgeIncomplet", "Sensació de buidatge incomplet")}
      ${radioChipGroup("color", "Color", COLOR_OPTIONS, "normal")}
      ${switchField("moc", "Presència de moc")}
      ${switchField("sang", "Presència de sang")}
      <div class="field">
        <label class="field-label" for="comentari">Comentari (opcional)</label>
        <textarea id="comentari"></textarea>
      </div>
      <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
        <button type="submit" class="btn btn-primary" id="bowel-submit-btn">Desar deposició</button>
        <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
      </div>
    </form>
    <div class="card">
      <h2 class="card-title">Últimes deposicions</h2>
      <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
    </div>
  `;

  wireRadioChips(content);
  content.querySelectorAll('[data-radio-group="bristol"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const b = BRISTOL_SCALE.find(x => x.value === btn.dataset.value);
      content.querySelector("#bristol-desc").textContent = b ? `${b.label}: ${b.desc}` : "";
    });
  });
  await refreshBowelList(content);

  content.querySelector("#bowel-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const bristol = getRadioValue(content, "bristol");
    if (!bristol) { alert("Selecciona un tipus a l'escala de Bristol."); return; }
    const payload = {
      id: editingBowelId || undefined,
      timestamp: localInputToISO(form.querySelector("#entryDatetime").value),
      bristol: Number(bristol),
      urgencia: form.querySelector("#urgencia").checked,
      buidatgeIncomplet: form.querySelector("#buidatgeIncomplet").checked,
      color: getRadioValue(content, "color") || "normal",
      moc: form.querySelector("#moc").checked,
      sang: form.querySelector("#sang").checked,
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await bowelRepo.put(payload);
    flashSaved(content);
    editingBowelId = null;
    await renderBowelTab(content);
  });
}

async function editBowelEntry(content, id) {
  const entry = await bowelRepo.get(id);
  if (!entry) return;
  editingBowelId = id;

  content.querySelector("#entryDatetime").value = isoToLocalInput(entry.timestamp);
  content.querySelectorAll('[data-radio-group="bristol"]').forEach(b => b.classList.toggle("chip-active", b.dataset.value === String(entry.bristol)));
  const b = BRISTOL_SCALE.find(x => x.value === String(entry.bristol));
  content.querySelector("#bristol-desc").textContent = b ? `${b.label}: ${b.desc}` : "";
  content.querySelector("#urgencia").checked = !!entry.urgencia;
  content.querySelector("#buidatgeIncomplet").checked = !!entry.buidatgeIncomplet;
  content.querySelectorAll('[data-radio-group="color"]').forEach(b2 => b2.classList.toggle("chip-active", b2.dataset.value === entry.color));
  content.querySelector("#moc").checked = !!entry.moc;
  content.querySelector("#sang").checked = !!entry.sang;
  content.querySelector("#comentari").value = entry.comentari || "";

  content.querySelector("#bowel-form-title").textContent = "Editant deposició";
  content.querySelector("#bowel-submit-btn").textContent = "Desar canvis";
  content.querySelector("#bowel-editing-banner").innerHTML = `
    <div class="editing-banner">
      <span>Estàs editant un registre existent.</span>
      <button type="button" class="btn btn-ghost" id="cancel-bowel-edit">Cancel·la</button>
    </div>
  `;
  content.querySelector("#cancel-bowel-edit").addEventListener("click", () => { editingBowelId = null; renderBowelTab(content); });
  content.querySelector("#bowel-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteBowelEntry(content, id) {
  if (!confirm("Segur que vols eliminar aquest registre?")) return;
  await bowelRepo.delete(id);
  await renderBowelTab(content);
}

async function refreshBowelList(content) {
  const recent = await bowelRepo.getRecent("timestamp", 10);
  const list = content.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre.</p>`;
    return;
  }
  list.innerHTML = recent.map(e => `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDateTime(e.timestamp)}</span>
        <span class="badge">Bristol ${e.bristol}</span>
        <span class="row-actions">
          <button type="button" data-edit="${e.id}">editar</button>
          <button type="button" class="danger" data-delete="${e.id}">eliminar</button>
        </span>
      </div>
      <div class="event-tags">
        ${e.urgencia ? "urgència · " : ""}${e.buidatgeIncomplet ? "buidatge incomplet · " : ""}color ${escapeHtml(e.color)}${e.moc ? " · moc" : ""}${e.sang ? " · <strong>sang</strong>" : ""}
      </div>
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `).join("");
  list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editBowelEntry(content, btn.dataset.edit)));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteBowelEntry(content, btn.dataset.delete)));
}
