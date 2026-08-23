export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

/** Valor per a input[type=datetime-local] corresponent a l'hora local actual. */
export function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Converteix un ISO guardat a valor local per mostrar-lo en un input datetime-local. */
export function isoToLocalInput(iso) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Converteix el valor d'un input datetime-local (hora local) a ISO per guardar-lo. */
export function localInputToISO(value) {
  return new Date(value).toISOString();
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso) {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("ca-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/** HTML d'un lliscador 0-10 amb etiquetes d'escala. */
export function sliderField(key, label, value = 0, lowLabel = "cap", highLabel = "màxim") {
  return `
    <div class="field">
      <div class="field-label-row">
        <label class="field-label" for="${key}">${label}</label>
        <span class="field-value" data-out-for="${key}">${value}</span>
      </div>
      <input type="range" id="${key}" name="${key}" min="0" max="10" step="1" value="${value}">
      <div class="scale-ticks"><span>${lowLabel}</span><span>${highLabel}</span></div>
    </div>
  `;
}

/** Connecta tots els input[type=range] d'un contenidor a la seva etiqueta de valor. */
export function wireSliders(container) {
  container.querySelectorAll('input[type="range"]').forEach((input) => {
    const out = container.querySelector(`[data-out-for="${input.name}"]`);
    if (!out) return;
    input.addEventListener("input", () => { out.textContent = input.value; });
  });
}

/** HTML d'un grup de xips seleccionables (multi-selecció). options: [{value,label}] */
export function chipGroup(key, label, options, selected = []) {
  const chips = options.map(opt => `
    <button type="button" class="chip ${selected.includes(opt.value) ? "chip-active" : ""}" data-chip-group="${key}" data-value="${opt.value}">${opt.label}</button>
  `).join("");
  return `
    <div class="field">
      <label class="field-label">${label}</label>
      <div class="chip-row" data-chip-container="${key}">${chips}</div>
    </div>
  `;
}

/** Connecta el comportament de clic/toggle als grups de xips d'un contenidor. */
export function wireChips(container) {
  container.querySelectorAll("[data-chip-group]").forEach((btn) => {
    btn.addEventListener("click", () => btn.classList.toggle("chip-active"));
  });
}

/** Retorna els valors seleccionats d'un grup de xips. */
export function getChipValues(container, key) {
  return Array.from(container.querySelectorAll(`[data-chip-group="${key}"].chip-active`)).map(b => b.dataset.value);
}

/** Mostra breument la confirmació de desat dins un contenidor amb #save-flash. */
export function flashSaved(container) {
  const flash = container.querySelector("#save-flash");
  if (!flash) return;
  flash.classList.add("show");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => flash.classList.remove("show"), 1800);
}

/** HTML d'un grup de xips de selecció ÚNICA (tipus radio). options: [{value,label}] */
export function radioChipGroup(key, label, options, selectedValue) {
  const chips = options.map(opt => `
    <button type="button" class="chip ${selectedValue === opt.value ? "chip-active" : ""}" data-radio-group="${key}" data-value="${opt.value}">${opt.label}</button>
  `).join("");
  return `
    <div class="field">
      <label class="field-label">${label}</label>
      <div class="chip-row" data-radio-container="${key}">${chips}</div>
    </div>
  `;
}

/** Connecta el comportament de selecció única als grups data-radio-group. */
export function wireRadioChips(container) {
  container.querySelectorAll("[data-radio-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.radioGroup;
      container.querySelectorAll(`[data-radio-group="${group}"]`).forEach(b => b.classList.remove("chip-active"));
      btn.classList.add("chip-active");
    });
  });
}

/** Retorna el valor seleccionat d'un grup de selecció única (o null). */
export function getRadioValue(container, key) {
  const active = container.querySelector(`[data-radio-group="${key}"].chip-active`);
  return active ? active.dataset.value : null;
}

/** HTML d'una fila d'interruptor booleà (sí/no). */
export function switchField(key, label, checked = false) {
  return `
    <div class="toggle-row">
      <label for="${key}">${label}</label>
      <label class="switch">
        <input type="checkbox" id="${key}" name="${key}" ${checked ? "checked" : ""}>
        <span class="switch-track"></span>
      </label>
    </div>
  `;
}

/** Badge de nivell d'intensitat 0-10 (colors: baix/mitjà/alt). */
export function intensityBadge(value) {
  const level = value <= 3 ? "low" : value <= 6 ? "mid" : "high";
  return `<span class="badge badge-${level}">${value}/10</span>`;
}
