import { Repository } from "../../db/repository.js";
import {
  escapeHtml, todayISO, formatDate, sliderField, wireSliders, flashSaved,
  chipGroup, wireChips, getChipValues, radioChipGroup, wireRadioChips, getRadioValue, switchField,
} from "../../utils/dom.js";

const repo = new Repository("sleep_log");

const PREVIOUS_FACTORS = ["pantalles", "alcohol", "cafè", "sopar tard", "exercici", "estrès", "medicació", "melatonina"].map(v => ({ value: v, label: v }));
const WAKE_REASONS = ["dolor", "diarrea / anar al lavabo", "sense motiu", "altre"].map(v => ({ value: v, label: v }));
const HOW_WOKE_UP = ["descansada", "cansada", "esgotada"].map(v => ({ value: v, label: v }));
const MUCUS_OPTIONS = [
  "boles de moc verdes",
  "moc blanc molt diluït (però abundant)",
  "moc espès",
  "moc abundant",
].map(v => ({ value: v, label: v }));

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

function wireDateNav(container, date, todayISOFn) {
  container.querySelector("#nav-prev").addEventListener("click", () => renderSleep(container, shiftDate(date, -1)));
  container.querySelector("#nav-next").addEventListener("click", () => renderSleep(container, shiftDate(date, 1)));
  container.querySelector("#nav-today")?.addEventListener("click", () => renderSleep(container, todayISOFn()));
  container.querySelector("#nav-date").addEventListener("change", (e) => {
    if (e.target.value) renderSleep(container, e.target.value);
  });
}

export async function renderSleep(container, dateOverride) {
  const date = dateOverride || todayISO();
  const isToday = date === todayISO();
  const existing = (await repo.getByIndex("date", date))[0] || null;
  const s = existing || {};

  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Registre</span>
      <h1 class="view-title">Son</h1>
      <p class="view-sub">Horaris, qualitat i tot allò que passa mentre dorms: despertars, ronc, i també episodis com caminar dormida, encendre llums o tenir visions.</p>
    </div>

    ${dateNavHtml(date, isToday)}

    <div class="grid-2">
      <form class="card" id="sleep-form" novalidate>
        <h2 class="card-title">${isToday ? "Nit passada" : `Nit del ${formatDate(date)}`}</h2>

        <div class="field">
          <label class="field-label" for="horaLlit">Hora d'anar al llit</label>
          <input type="text" id="horaLlit" placeholder="23:30" value="${escapeHtml(s.horaLlit || "")}">
        </div>
        <div class="field">
          <label class="field-label" for="horaIntent">Hora d'intentar dormir</label>
          <input type="text" id="horaIntent" placeholder="23:45" value="${escapeHtml(s.horaIntent || "")}">
        </div>
        <div class="field">
          <label class="field-label" for="horaAdormir">Hora d'adormir-me (aprox.)</label>
          <input type="text" id="horaAdormir" placeholder="00:15" value="${escapeHtml(s.horaAdormir || "")}">
        </div>
        <div class="field">
          <label class="field-label" for="horaLlevar">Hora de llevar-me</label>
          <input type="text" id="horaLlevar" placeholder="07:30" value="${escapeHtml(s.horaLlevar || "")}">
        </div>

        <div class="field"><label class="field-label" for="horesDormides">Temps dormint / hores dormides</label><input type="text" id="horesDormides" placeholder="p. ex. 7 h 20 min" value="${escapeHtml(s.horesDormides || "")}"><p class="field-help">Indica el temps que creus que has dormit realment, descomptant el temps desperta.</p></div>
        ${sliderField("qualitat", "Qualitat del son", s.qualitat ?? 5, "molt dolent", "excel·lent")}
        ${sliderField("numDespertars", "Nombre de despertars", s.numDespertars ?? 0, "cap", "molts")}
        ${sliderField("fatigaMati", "Fatiga en llevar-me", s.fatigaMati ?? 0, "cap", "extrema")}

        ${radioChipGroup("motiuDespertar", "Si t'has despertat, per quin motiu principal", WAKE_REASONS, s.motiuDespertar)}
        ${radioChipGroup("comLlevat", "Com t'has llevat", HOW_WOKE_UP, s.comLlevat)}

        <div class="field">
          <label class="field-label">Durant la nit</label>
          ${switchField("llumEnces", "He encès el llum", s.llumEnces)}
          ${switchField("anatLavabo", "He anat al lavabo", s.anatLavabo)}
          ${switchField("ronc", "Ronc / possibles apnees", s.ronc)}
          ${switchField("bruxisme", "Bruxisme (grinyolar dents)", s.bruxisme)}
          ${switchField("suorsNocturns", "Suors nocturns", s.suorsNocturns)}
          ${switchField("camesInquietes", "Cames inquietes / rampes", s.camesInquietes)}
        </div>

        <div class="field">
          <label class="field-label">Parasomnias</label>
          ${switchField("caminarDormida", "He caminat dormida", s.caminarDormida)}
          ${switchField("encendreLlumsDormida", "He encès els llums dormida (sense recordar-ho)", s.encendreLlumsDormida)}
          ${switchField("visions", "He tingut visions / al·lucinacions en despertar-me", s.visions)}
          ${switchField("crits", "He cridat mentre dormia", s.crits)}
        </div>

        ${chipGroup("mocsMati", "Mocs en llevar-me (pel coll)", MUCUS_OPTIONS, s.mocsMati || [])}

        ${chipGroup("factorsPrevis", "Factors previs (abans d'anar a dormir)", PREVIOUS_FACTORS, s.factorsPrevis || [])}

        <div class="field">
          <label class="field-label" for="comentari">Comentari (opcional)</label>
          <textarea id="comentari">${escapeHtml(s.comentari || "")}</textarea>
        </div>

        <div style="display:flex; align-items:center; gap: var(--sp-4); margin-top: var(--sp-5);">
          <button type="submit" class="btn btn-primary">Desar registre de son</button>
          <span class="save-flash" id="save-flash"><span class="dot"></span> Desat</span>
        </div>
      </form>

      <div class="card">
        <h2 class="card-title">Últimes nits</h2>
        <div class="event-list" id="event-list"><p class="ledger-empty">Carregant…</p></div>
      </div>
    </div>
  `;

  wireSliders(container);
  wireChips(container);
  wireRadioChips(container);
  wireDateNav(container, date, todayISO);
  await refreshList(container);

  container.querySelector("#sleep-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      id: existing?.id,
      date,
      horaLlit: form.querySelector("#horaLlit").value.trim(),
      horaIntent: form.querySelector("#horaIntent").value.trim(),
      horaAdormir: form.querySelector("#horaAdormir").value.trim(),
      horaLlevar: form.querySelector("#horaLlevar").value.trim(),
      horesDormides: form.querySelector("#horesDormides").value.trim(),
      qualitat: Number(form.querySelector('[name="qualitat"]').value),
      numDespertars: Number(form.querySelector('[name="numDespertars"]').value),
      fatigaMati: Number(form.querySelector('[name="fatigaMati"]').value),
      motiuDespertar: getRadioValue(container, "motiuDespertar"),
      comLlevat: getRadioValue(container, "comLlevat"),
      llumEnces: form.querySelector("#llumEnces").checked,
      anatLavabo: form.querySelector("#anatLavabo").checked,
      ronc: form.querySelector("#ronc").checked,
      bruxisme: form.querySelector("#bruxisme").checked,
      suorsNocturns: form.querySelector("#suorsNocturns").checked,
      camesInquietes: form.querySelector("#camesInquietes").checked,
      caminarDormida: form.querySelector("#caminarDormida").checked,
      encendreLlumsDormida: form.querySelector("#encendreLlumsDormida").checked,
      visions: form.querySelector("#visions").checked,
      crits: form.querySelector("#crits").checked,
      mocsMati: getChipValues(container, "mocsMati"),
      factorsPrevis: getChipValues(container, "factorsPrevis"),
      comentari: form.querySelector("#comentari").value.trim(),
    };
    await repo.put(payload);
    await renderSleep(container, date);
    flashSaved(container);
  });
}

async function refreshList(container) {
  const recent = await repo.getRecent("date", 7);
  const list = container.querySelector("#event-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="ledger-empty">Encara no hi ha cap registre de son.</p>`;
    return;
  }
  list.innerHTML = recent.map(rowTemplate).join("");
  list.querySelectorAll("[data-edit-date]").forEach(btn => btn.addEventListener("click", () => renderSleep(container, btn.dataset.editDate)));
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Segur que vols eliminar aquest registre?")) return;
      await repo.delete(btn.dataset.delete);
      await refreshList(container);
    });
  });
}

function rowTemplate(e) {
  const parasomnias = ["caminarDormida", "encendreLlumsDormida", "visions", "crits"].filter(k => e[k]);
  const flags = ["ronc", "bruxisme", "suorsNocturns", "camesInquietes"].filter(k => e[k]);
  return `
    <div class="event-row">
      <div class="event-row-top">
        <span class="event-when">${formatDate(e.date)}</span>
        <span class="badge">qualitat ${e.qualitat ?? "–"}/10</span>
        <span class="row-actions"><button type="button" data-edit-date="${e.date}">editar</button><button type="button" class="danger" data-delete="${e.id}">eliminar</button></span>
      </div>
      <div class="event-tags">${e.horaLlit || "–"} → ${e.horaLlevar || "–"}${e.horesDormides ? " · " + escapeHtml(e.horesDormides) + " dormides" : ""} · ${e.numDespertars ?? 0} despertars</div>
      ${flags.length ? `<div class="event-tags">${flags.join(", ")}</div>` : ""}
      ${parasomnias.length ? `<div class="event-tags" style="color: var(--clay);">Parasomnias: ${parasomnias.join(", ")}</div>` : ""}
      ${e.mocsMati?.length ? `<div class="event-tags">Mocs: ${e.mocsMati.map(escapeHtml).join(", ")}</div>` : ""}
      ${e.comentari ? `<div class="event-comment">${escapeHtml(e.comentari)}</div>` : ""}
    </div>
  `;
}
