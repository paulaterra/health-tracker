import { supabase } from "./db/supabase.js";
import { renderCheckin } from "./modules/checkin/checkin.js";
import { renderPain } from "./modules/pain/pain.js";
import { renderHeadache } from "./modules/headache/headache.js";
import { renderVertigo } from "./modules/vertigo/vertigo.js";
import { renderDigestive } from "./modules/digestive/digestive.js";
import { renderSleep } from "./modules/sleep/sleep.js";
import { renderExercise } from "./modules/exercise/exercise.js";
import { renderCycle } from "./modules/cycle/cycle.js";
import { renderSkin } from "./modules/skin/skin.js";
import { renderMedication } from "./modules/medication/medication.js";
import { renderPatterns } from "./modules/patterns/patterns.js";
import { renderConclusions } from "./modules/conclusions/conclusions.js";
import { renderDashboard } from "./modules/dashboard/dashboard.js";
import { renderReports } from "./modules/reports/reports.js";
import { renderAbout } from "./modules/about/about.js";
import { renderProfile } from "./modules/profile/profile.js";
import { renderAssistant } from "./modules/assistant/assistant.js";
import { APP_INFO } from "./app-info.js";
import { migrateUnifiedScoreDirection } from "./engine/score-scale-migration.js";
import { isViewerMode, startViewerSession, clearViewerSession } from "./view-mode.js";

// Rutes construïdes fins ara (Fase 0 a Fase 3, completa).
const ROUTES = {
  inici:     { label: "Check-in ràpid", index: "00", render: renderCheckin },
  dolor:     { label: "Dolor corporal", index: "01", render: renderPain },
  malcap:    { label: "Mal de cap",     index: "02", render: renderHeadache },
  vertigen:  { label: "Vertígens i boira mental",      index: "03", render: renderVertigo },
  digestiu:  { label: "Digestiu",       index: "04", render: renderDigestive },
  son:       { label: "Son",            index: "05", render: renderSleep },
  exercici:  { label: "Exercici",       index: "06", render: renderExercise },
  cicle:     { label: "Cicle menstrual",index: "07", render: renderCycle },
  pell:      { label: "Pell",           index: "08", render: renderSkin },
  medicacio: { label: "Medicació",      index: "09", render: renderMedication },
  patrons:   { label: "Patrons detectats", index: "10", render: renderPatterns },
  conclusions: { label: "Conclusions i recomanacions", index: "11", render: renderConclusions },
  dashboard: { label: "Dashboard", index: "12", render: renderDashboard },
  informes:  { label: "Informes", index: "13", render: renderReports },
  perfil:    { label: "El meu cos", index: "14", render: renderProfile },
  assistent: { label: "Pregunta a la IA", index: "15", render: renderAssistant },
  configuracio: { label: "Versió i estat", index: "16", render: renderAbout },
};


const CATEGORY_META = {
  inici: { color: "#4F7462", soft: "#E3EBE2", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m7.5 12 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  dolor: { color: "#6C8F57", soft: "#E9F0E3", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 21v-5.5L7 11.5c-.6-1.8.4-3.8 2.2-4.4L12 6.2l2.8.9c1.8.6 2.8 2.6 2.2 4.4l-1.5 4V21M9 12h6M12 8v8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  malcap: { color: "#C85B52", soft: "#FAE9E6", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 20H9.8a5 5 0 0 1-5-5v-4a7 7 0 0 1 7-7h1.4a5.8 5.8 0 0 1 5.8 5.8V13l-3.5 1.8V20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m19.5 5.5 1.8-1.2M20.2 9h2.2M19.3 12.3l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  vertigen: { color: "#6F5AA8", soft: "#EEEAF8", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8.3a7.2 7.2 0 1 0 .4 6.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 11.8a4.3 4.3 0 1 0-1.2 4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13.7 14.1a1.7 1.7 0 1 0-2.3 1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  digestiu: { color: "#D28A20", soft: "#FBF0D8", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5v5c0 1.2-.8 2.2-2 2.6-1.8.6-3 2.2-3 4.1 0 2.9 2.4 5.3 5.3 5.3h2.4c4.6 0 8.3-3.7 8.3-8.3V9.8c0-2.2-1.8-4-4-4h-1.5v4.4c0 1.1-.9 2-2 2h-.3c-1.8 0-3.2-1.4-3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  son: { color: "#8252A1", soft: "#F1E8F5", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.7 15.2A8 8 0 0 1 8.8 4.3 8.2 8.2 0 1 0 19.7 15.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m17.5 4 .5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z" fill="currentColor"/></svg>` },
  exercici: { color: "#3978B9", soft: "#E6EFF9", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5c3.7.3 6.1-1.2 7.2-4.5l2.2 2.5c1.4 1.6 3.1 2.6 5.1 3l1.5.3v2.7H8.2A4.2 4.2 0 0 1 4 15.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.5 11 9 7.5l2.5-2 2 3.5 2-1.2 1.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 16.5h2M11 16.5h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  cicle: { color: "#C84E72", soft: "#F9E6EC", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 8.5c1.4 1 2.6 1.4 3.5 1.4s2.1-.4 3.5-1.4M12 10v6M9.5 17h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  pell: { color: "#D66A2C", soft: "#FBEADF", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2c2.8 3.6 5 6.3 5 9.4a5 5 0 0 1-10 0c0-3.1 2.2-5.8 5-9.4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 5.5h4M16 5.5h4M3 9h3M18 9h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` },
  medicacio: { color: "#32679B", soft: "#E5EEF7", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.2 14.8 9.6-9.6a3 3 0 0 1 4.2 4.2L9.4 19a3 3 0 1 1-4.2-4.2Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m9.2 10.8 4 4" stroke="currentColor" stroke-width="1.7"/><circle cx="17.5" cy="17.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15 17.5h5" stroke="currentColor" stroke-width="1.7"/></svg>` },
};

function categoryStyle(route) {
  const meta = CATEGORY_META[route] ?? CATEGORY_META.inici;
  return `--category:${meta.color};--category-soft:${meta.soft}`;
}
function categoryIcon(route) { return (CATEGORY_META[route] ?? CATEGORY_META.inici).icon; }

const COMING_SOON = [];

let currentUser = null;
const WRITE_ROUTES = new Set(["inici", "dolor", "malcap", "vertigen", "digestiu", "son", "exercici", "cicle", "pell", "medicacio"]);

function hasRecoveryMarker() {
  const params = `${window.location.search} ${window.location.hash}`;
  return /type=recovery|error_code=otp_expired|error=access_denied/i.test(params);
}

function clearRecoveryUrl() {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search.replace(/([?&])(type|code|token_hash)=[^&]*/g, "").replace(/[?&]$/, "")}`);
}

async function main() {
  if (isViewerMode()) {
    currentUser = { email: "Paula Track View" };
    await enterApp();
    return;
  }

  let recoveryScreenShown = false;
  supabase.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryScreenShown = true;
      currentUser = nextSession?.user ?? null;
      renderPasswordRecovery();
      return;
    }
    if (!nextSession?.user && !recoveryScreenShown) {
      currentUser = null;
      renderLogin();
    }
  });

  const recoveryRequested = hasRecoveryMarker();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("No s'ha pogut comprovar la sessió", error);

  if (recoveryRequested) {
    if (/error_code=otp_expired|error=access_denied/i.test(`${window.location.search} ${window.location.hash}`)) {
      renderLogin("L'enllaç de recuperació ha caducat. Torna a demanar un correu nou des de Supabase.");
      return;
    }
    if (session?.user) {
      recoveryScreenShown = true;
      currentUser = session.user;
      renderPasswordRecovery();
      return;
    }
    document.getElementById("app").innerHTML = `<main class="auth-page"><section class="auth-card"><div class="auth-mark">PT</div><p class="view-eyebrow">Paula Tracker</p><h1 class="auth-title">Preparant el canvi de contrasenya…</h1><p class="auth-copy">Espera un moment mentre validem l'enllaç segur.</p></section></main>`;
    window.setTimeout(() => {
      if (!recoveryScreenShown) renderLogin("No s'ha pogut validar l'enllaç. Torna a demanar un correu de recuperació nou.");
    }, 2500);
    return;
  }

  if (session?.user) {
    currentUser = session.user;
    await enterApp();
  } else {
    renderLogin();
  }
}

function renderPasswordRecovery(message = "") {
  document.getElementById("app").innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="auth-mark">PT</div>
        <p class="view-eyebrow">Paula Tracker</p>
        <h1 class="auth-title">Crea una nova contrasenya.</h1>
        <p class="auth-copy">Escriu-la dues vegades per confirmar-la. Ha de tenir almenys 8 caràcters.</p>
        <form id="password-recovery-form" class="auth-form is-active">
          <label class="field-label" for="new-password">Nova contrasenya</label>
          <input id="new-password" type="password" autocomplete="new-password" minlength="8" required>
          <label class="field-label" for="confirm-password">Repeteix la contrasenya</label>
          <input id="confirm-password" type="password" autocomplete="new-password" minlength="8" required>
          <button class="btn btn-primary auth-submit" type="submit">Guardar nova contrasenya</button>
        </form>
        <p id="auth-message" class="auth-message">${message}</p>
      </section>
    </main>`;

  document.getElementById("password-recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const messageEl = document.getElementById("auth-message");
    const password = document.getElementById("new-password").value;
    const confirmation = document.getElementById("confirm-password").value;

    if (password.length < 8) {
      messageEl.textContent = "La contrasenya ha de tenir almenys 8 caràcters.";
      return;
    }
    if (password !== confirmation) {
      messageEl.textContent = "Les dues contrasenyes no coincideixen.";
      return;
    }

    button.disabled = true;
    button.textContent = "Guardant…";
    messageEl.textContent = "";
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      messageEl.textContent = `No s'ha pogut canviar la contrasenya: ${error.message}`;
      button.disabled = false;
      button.textContent = "Guardar nova contrasenya";
      return;
    }

    clearRecoveryUrl();
    await supabase.auth.signOut();
    currentUser = null;
    renderLogin("Contrasenya actualitzada correctament. Ja pots iniciar sessió amb la nova contrasenya.");
  });
}

function renderLogin(message = "") {
  document.getElementById("app").innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="auth-mark">PT</div>
        <p class="view-eyebrow">Paula Tracker</p>
        <h1 class="auth-title">Les teves dades, sincronitzades i privades.</h1>
        <div class="auth-tabs" role="tablist">
          <button class="auth-tab active" id="owner-tab" type="button" role="tab" aria-selected="true"><span class="auth-tab-icon" aria-hidden="true">🔒</span><span>Accés Paula</span></button>
          <button class="auth-tab" id="viewer-tab" type="button" role="tab" aria-selected="false"><span class="auth-tab-icon" aria-hidden="true">👁</span><span>Accés professionals</span></button>
        </div>
        <form id="login-form" class="auth-form is-active">
          <label class="field-label" for="login-email">Correu electrònic</label>
          <input id="login-email" type="email" autocomplete="email" required>
          <label class="field-label" for="login-password">Contrasenya</label>
          <input id="login-password" type="password" autocomplete="current-password" required>
          <button class="btn btn-primary auth-submit" type="submit">Entrar</button>
        </form>
        <form id="viewer-form" class="auth-form" hidden>
          <p class="auth-copy">Accés permanent de només lectura per a professionals.</p>
          <label class="field-label" for="viewer-password">Contrasenya d'accés</label>
          <input id="viewer-password" type="password" autocomplete="current-password" required>
          <button class="btn btn-primary auth-submit" type="submit">Entrar en mode consulta</button>
        </form>
        <p id="auth-message" class="auth-message">${message}</p>
      </section>
    </main>`;

  const ownerTab = document.getElementById("owner-tab");
  const viewerTab = document.getElementById("viewer-tab");
  const ownerForm = document.getElementById("login-form");
  const viewerForm = document.getElementById("viewer-form");
  const showTab = (viewer) => {
    ownerTab.classList.toggle("active", !viewer);
    viewerTab.classList.toggle("active", viewer);
    ownerTab.setAttribute("aria-selected", String(!viewer));
    viewerTab.setAttribute("aria-selected", String(viewer));
    ownerForm.hidden = viewer;
    viewerForm.hidden = !viewer;
    ownerForm.classList.toggle("is-active", !viewer);
    viewerForm.classList.toggle("is-active", viewer);
    document.getElementById("auth-message").textContent = "";
    const firstField = (viewer ? viewerForm : ownerForm).querySelector("input");
    if (firstField) requestAnimationFrame(() => firstField.focus());
  };
  ownerTab.addEventListener("click", () => showTab(false));
  viewerTab.addEventListener("click", () => showTab(true));

  ownerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const messageEl = document.getElementById("auth-message");
    button.disabled = true; button.textContent = "Entrant…"; messageEl.textContent = "";
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      messageEl.textContent = error.message === "Invalid login credentials" ? "El correu o la contrasenya no són correctes." : error.message;
      button.disabled = false; button.textContent = "Entrar"; return;
    }
    currentUser = data.user; await enterApp();
  });

  viewerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const messageEl = document.getElementById("auth-message");
    button.disabled = true; button.textContent = "Comprovant…"; messageEl.textContent = "";
    const password = document.getElementById("viewer-password").value;
    const { data, error } = await supabase.rpc("professional_login", { p_password: password });
    const token = Array.isArray(data) ? data[0] : data;
    if (error || !token) {
      messageEl.textContent = "La contrasenya de consulta no és correcta.";
      button.disabled = false; button.textContent = "Entrar en mode consulta"; return;
    }
    startViewerSession(token);
    currentUser = { email: "Paula Track View" };
    await enterApp();
  });
}
async function enterApp() {
  if (!isViewerMode()) await migrateUnifiedScoreDirection();
  renderShell();
  await navigateTo(isViewerMode() ? "dashboard" : "inici");
}

function renderShell() {
  document.getElementById("app").innerHTML = `
    <div class="app-shell ${isViewerMode() ? "viewer-mode" : ""}" id="app-shell">
      ${isViewerMode() ? `<div class="viewer-banner">Mode consulta · Només lectura</div>` : ""}
      <header class="mobile-topbar">
        <div class="mobile-brand"><strong>Paula Tracker</strong><span>Quadern de salut · Núvol privat</span></div>
        <button class="mobile-avatar" id="mobile-profile" type="button" aria-label="Obrir més opcions">PT</button>
      </header>


      <button class="mobile-nav-backdrop" id="mobile-nav-backdrop" type="button" aria-label="Tancar menú"></button>

      <aside class="sidebar" aria-label="Navegació principal">
        <button class="sidebar-close" id="mobile-menu-close" type="button" aria-label="Tancar menú">×</button>
        <div class="brand">Quadern de salut<span class="brand-sub">Núvol · Privat</span></div>
        <ul class="nav-list" id="nav-list"></ul>
        <div class="sidebar-account">
          <span class="account-email" title="${currentUser?.email ?? ""}">${currentUser?.email ?? ""}</span>
          <button class="sidebar-link" id="logout-btn" type="button">Tancar sessió</button>
        </div>
        <div class="sidebar-footer"><span class="cloud-dot"></span> Sincronitzat amb Supabase · v${APP_INFO.version}</div>
      </aside>

      <main class="main" id="view"></main>

      <button class="mobile-sheet-backdrop" id="mobile-sheet-backdrop" type="button" aria-label="Tancar panell"></button>

      <section class="mobile-sheet" id="register-sheet" aria-hidden="true" aria-label="Registrar dades">
        <div class="mobile-sheet-handle"></div>
        <div class="mobile-sheet-header">
          <div><p class="mobile-sheet-eyebrow">Nou registre</p><h2>Què vols registrar?</h2></div>
          <button class="mobile-sheet-close" type="button" data-close-sheet aria-label="Tancar">×</button>
        </div>
        <div class="register-grid">
          ${[
            ["inici", "Check-in", "Resum del dia"],
            ["dolor", "Dolor corporal", "Mapa i intensitat"],
            ["malcap", "Mal de cap", "Tipus i desencadenants"],
            ["vertigen", "Vertígens i boira mental", "Sensacions, intensitat i durada"],
            ["digestiu", "Digestiu", "Símptomes i deposicions"],
            ["son", "Son", "Qualitat i despertars"],
            ["exercici", "Exercici", "Activitat i passos"],
            ["cicle", "Cicle", "Fase i símptomes"],
            ["pell", "Pell", "Brots i zones"],
            ["medicacio", "Medicació", "Presa i efecte"]
          ].map(([route, title, sub]) => `<button class="register-card category-${route}" style="${categoryStyle(route)}" data-sheet-route="${route}" type="button"><span class="register-card-icon">${categoryIcon(route)}</span><span><strong>${title}</strong><small>${sub}</small></span></button>`).join("")}
        </div>
      </section>

      <section class="mobile-sheet" id="more-sheet" aria-hidden="true" aria-label="Més opcions">
        <div class="mobile-sheet-handle"></div>
        <div class="mobile-sheet-header">
          <div><p class="mobile-sheet-eyebrow">Paula Tracker</p><h2>Més opcions</h2></div>
          <button class="mobile-sheet-close" type="button" data-close-sheet aria-label="Tancar">×</button>
        </div>
        <div class="more-menu-list">
          <button data-sheet-route="dashboard" type="button"><span>⌂</span><span><strong>Dashboard</strong><small>Resum i evolució</small></span><b>›</b></button>
          <button data-sheet-route="patrons" type="button"><span>⌁</span><span><strong>Patrons detectats</strong><small>Relacions entre dades</small></span><b>›</b></button>
          <button data-sheet-route="conclusions" type="button"><span>✓</span><span><strong>Conclusions</strong><small>Resum i recomanacions</small></span><b>›</b></button>
          <button data-sheet-route="perfil" type="button"><span>◎</span><span><strong>El meu cos</strong><small>Perfil personal viu</small></span><b>›</b></button>
          <button data-sheet-route="assistent" type="button"><span>✦</span><span><strong>Pregunta a la IA</strong><small>Respostes del teu historial</small></span><b>›</b></button>
          <button data-sheet-route="informes" type="button"><span>▤</span><span><strong>Informes</strong><small>PDF i exportació</small></span><b>›</b></button>
          <button data-sheet-route="configuracio" type="button"><span>ⓘ</span><span><strong>Versió i estat</strong><small>v${APP_INFO.version} · Connexions</small></span><b>›</b></button>
          <button id="mobile-sheet-logout" class="danger" type="button"><span>↪</span><span><strong>Tancar sessió</strong><small>${currentUser?.email ?? ""}</small></span><b>›</b></button>
        </div>
      </section>

      <nav class="mobile-bottom-nav" aria-label="Navegació principal">
        <button class="mobile-nav-btn" data-mobile-route="dashboard" type="button"><span class="mobile-nav-icon">⌂</span><span>Inici</span></button>
        <button class="mobile-nav-btn" id="mobile-register" type="button"><span class="mobile-nav-icon">＋</span><span>Registres</span></button>
        <button class="mobile-nav-btn" data-mobile-route="patrons" type="button"><span class="mobile-nav-icon">▥</span><span>Anàlisi</span></button>
        <button class="mobile-nav-btn" data-mobile-route="informes" type="button"><span class="mobile-nav-icon">▤</span><span>Informes</span></button>
        <button class="mobile-nav-btn" id="mobile-more" type="button"><span class="mobile-nav-icon">•••</span><span>Més</span></button>
      </nav>
    </div>`;

  const navList = document.getElementById("nav-list");
  navList.innerHTML = Object.entries(ROUTES).map(
    ([key, r]) => `<li class="nav-item category-${key} ${isViewerMode() && WRITE_ROUTES.has(key) ? "locked" : ""}" style="${CATEGORY_META[key] ? categoryStyle(key) : ""}" data-route="${key}">${CATEGORY_META[key] ? `<span class="nav-category-icon">${categoryIcon(key)}</span>` : `<span class="nav-index">${r.index}</span>`}<span>${r.label}</span>${isViewerMode() && WRITE_ROUTES.has(key) ? `<span class="nav-lock">🔒</span>` : ""}</li>`
  ).join("");

  const shell = document.getElementById("app-shell");
  const closeMenu = () => shell.classList.remove("menu-open");
  const openMenu = () => shell.classList.add("menu-open");

  navList.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.addEventListener("click", async () => {
      closeMenu();
      await navigateTo(el.dataset.route);
    });
  });

  document.getElementById("mobile-menu-open")?.addEventListener("click", openMenu);
  document.getElementById("mobile-menu-close")?.addEventListener("click", closeMenu);
  document.getElementById("mobile-profile")?.addEventListener("click", () => openSheet("more-sheet"));
  document.getElementById("mobile-nav-backdrop")?.addEventListener("click", closeMenu);

  const sheetBackdrop = document.getElementById("mobile-sheet-backdrop");
  const sheets = [...document.querySelectorAll(".mobile-sheet")];
  const closeSheets = () => {
    shell.classList.remove("sheet-open");
    sheets.forEach((sheet) => {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    });
  };
  const openSheet = (id) => {
    closeMenu();
    closeSheets();
    const sheet = document.getElementById(id);
    if (!sheet) return;
    shell.classList.add("sheet-open");
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  };

  document.getElementById("mobile-register")?.addEventListener("click", () => openSheet("register-sheet"));
  document.getElementById("mobile-more")?.addEventListener("click", () => openSheet("more-sheet"));
  sheetBackdrop?.addEventListener("click", closeSheets);
  document.querySelectorAll("[data-close-sheet]").forEach((button) => button.addEventListener("click", closeSheets));
  document.querySelectorAll("[data-sheet-route]").forEach((button) => {
    button.addEventListener("click", async () => {
      closeSheets();
      await navigateTo(button.dataset.sheetRoute);
    });
  });
  document.querySelectorAll("[data-quick-route]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSheets();
      navigateTo(button.dataset.quickRoute);
    });
  });
  document.querySelectorAll("[data-mobile-route]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSheets();
      navigateTo(button.dataset.mobileRoute);
    });
  });

  const logout = async () => {
    closeSheets();
    if (isViewerMode()) { clearViewerSession(); currentUser = null; renderLogin(); }
    else await supabase.auth.signOut();
  };
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("mobile-sheet-logout")?.addEventListener("click", logout);
}


function showRestrictedMessage() {
  const existing = document.getElementById("restricted-dialog");
  if (existing) existing.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "restricted-dialog";
  dialog.className = "restricted-dialog";
  dialog.innerHTML = `<div class="restricted-icon">🔒</div><h2>Accés restringit</h2><p>Aquest apartat permet registrar o modificar dades de salut i només està disponible per a Paula. En mode consulta només es poden visualitzar i analitzar les dades.</p><button class="btn btn-primary" type="button">Entesos</button>`;
  document.body.appendChild(dialog);
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

async function navigateTo(routeKey) {
  if (isViewerMode() && WRITE_ROUTES.has(routeKey)) {
    showRestrictedMessage();
    return;
  }
  const route = ROUTES[routeKey];
  if (!route) return;

  document.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === routeKey);
  });
  document.querySelectorAll("[data-mobile-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.mobileRoute === routeKey);
  });
  document.querySelectorAll("[data-quick-route]").forEach((el) => {
    const active = el.dataset.quickRoute === routeKey;
    el.classList.toggle("active", active);
    if (active && window.matchMedia("(max-width: 820px)").matches) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
    }
  });
  document.body.dataset.route = routeKey;
  window.scrollTo({ top: 0, behavior: "smooth" });

  const view = document.getElementById("view");
  await route.render(view);
}

main();
