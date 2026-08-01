import { supabase } from "./db/supabase.js";
import { countLocalRecords, migrateLocalRecords } from "./db/migration.js";
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

const ROUTES = {
  inici:     { label: "Check-in ràpid", index: "00", render: renderCheckin },
  dolor:     { label: "Dolor corporal", index: "01", render: renderPain },
  malcap:    { label: "Mal de cap", index: "02", render: renderHeadache },
  vertigen:  { label: "Vertígens", index: "03", render: renderVertigo },
  digestiu:  { label: "Digestiu", index: "04", render: renderDigestive },
  son:       { label: "Son", index: "05", render: renderSleep },
  exercici:  { label: "Exercici", index: "06", render: renderExercise },
  cicle:     { label: "Cicle menstrual", index: "07", render: renderCycle },
  pell:      { label: "Pell", index: "08", render: renderSkin },
  medicacio: { label: "Medicació", index: "09", render: renderMedication },
  patrons:   { label: "Patrons detectats", index: "10", render: renderPatterns },
  conclusions: { label: "Conclusions i recomanacions", index: "11", render: renderConclusions },
  dashboard: { label: "Dashboard", index: "12", render: renderDashboard },
  informes:  { label: "Informes", index: "13", render: renderReports },
};

let currentUser = null;

async function main() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await enterApp();
  } else {
    renderLogin();
  }

  supabase.auth.onAuthStateChange((_event, sessionNow) => {
    if (!sessionNow?.user) {
      currentUser = null;
      renderLogin();
    }
  });
}

function renderLogin(message = "") {
  document.getElementById("app").innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="auth-mark">QS</div>
        <p class="view-eyebrow">Quadern de salut</p>
        <h1 class="auth-title">Les teves dades, sincronitzades i privades.</h1>
        <p class="auth-copy">Inicia sessió amb l'usuari que has creat a Supabase.</p>
        <form id="login-form" class="auth-form">
          <label class="field-label" for="login-email">Correu electrònic</label>
          <input id="login-email" type="email" autocomplete="email" required>
          <label class="field-label" for="login-password">Contrasenya</label>
          <input id="login-password" type="password" autocomplete="current-password" required>
          <button class="btn btn-primary auth-submit" type="submit">Entrar</button>
          <p id="auth-message" class="auth-message">${message}</p>
        </form>
      </section>
    </main>`;

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const messageEl = document.getElementById("auth-message");
    button.disabled = true;
    button.textContent = "Entrant…";
    messageEl.textContent = "";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      messageEl.textContent = error.message === "Invalid login credentials"
        ? "El correu o la contrasenya no són correctes."
        : error.message;
      button.disabled = false;
      button.textContent = "Entrar";
      return;
    }

    currentUser = data.user;
    await enterApp();
  });
}

async function enterApp() {
  renderShell();
  await navigateTo("inici");
  await offerLocalMigration();
}

function renderShell() {
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">Quadern de salut<span class="brand-sub">Núvol · Privat</span></div>
        <ul class="nav-list" id="nav-list"></ul>
        <div class="sidebar-account">
          <span class="account-email" title="${currentUser?.email ?? ""}">${currentUser?.email ?? ""}</span>
          <button class="sidebar-link" id="logout-btn" type="button">Tancar sessió</button>
        </div>
        <div class="sidebar-footer"><span class="cloud-dot"></span> Sincronitzat amb Supabase</div>
      </aside>
      <main class="main" id="view"></main>
    </div>
    <div id="migration-slot"></div>`;

  const navList = document.getElementById("nav-list");
  navList.innerHTML = Object.entries(ROUTES).map(
    ([key, r]) => `<li class="nav-item" data-route="${key}"><span class="nav-index">${r.index}</span> ${r.label}</li>`
  ).join("");

  navList.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.dataset.route));
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

async function offerLocalMigration() {
  try {
    const localCount = await countLocalRecords();
    if (!localCount || localStorage.getItem("healthTrackerMigrationDismissed") === "1") return;

    const slot = document.getElementById("migration-slot");
    slot.innerHTML = `
      <div class="migration-banner" id="migration-banner">
        <div>
          <strong>Hem trobat ${localCount} registres antics en aquest navegador.</strong>
          <span id="migration-text">Els pots copiar a Supabase per no perdre'ls.</span>
        </div>
        <div class="migration-actions">
          <button class="btn btn-ghost" id="migration-dismiss" type="button">Ara no</button>
          <button class="btn btn-primary" id="migration-start" type="button">Copiar al núvol</button>
        </div>
      </div>`;

    document.getElementById("migration-dismiss").addEventListener("click", () => {
      localStorage.setItem("healthTrackerMigrationDismissed", "1");
      slot.innerHTML = "";
    });

    document.getElementById("migration-start").addEventListener("click", async () => {
      const button = document.getElementById("migration-start");
      const text = document.getElementById("migration-text");
      button.disabled = true;
      try {
        const result = await migrateLocalRecords(({ copied, total }) => {
          text.textContent = `Copiant ${copied} de ${total}…`;
        });
        text.textContent = `${result.copied} registres copiats correctament.`;
        button.textContent = "Fet";
        localStorage.setItem("healthTrackerMigrationDismissed", "1");
        setTimeout(() => { slot.innerHTML = ""; }, 2500);
        await navigateTo("inici");
      } catch (error) {
        text.textContent = `No s'han pogut copiar: ${error.message}`;
        button.disabled = false;
        button.textContent = "Tornar-ho a provar";
      }
    });
  } catch (error) {
    console.warn("No s'han pogut comprovar les dades locals", error);
  }
}

async function navigateTo(routeKey) {
  const route = ROUTES[routeKey];
  if (!route) return;

  document.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === routeKey);
  });

  const view = document.getElementById("view");
  view.innerHTML = `<div class="empty-state"><div class="emoji-mark">···</div><p>Carregant dades…</p></div>`;
  try {
    await route.render(view);
  } catch (error) {
    console.error(error);
    view.innerHTML = `<div class="empty-state"><div class="emoji-mark">!</div><p>No s'han pogut carregar les dades.<br>${error.message}</p></div>`;
  }
}

main();
