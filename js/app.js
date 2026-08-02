import { openDatabase } from "./db/schema.js";
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

// Rutes construïdes fins ara (Fase 0 a Fase 3, completa).
const ROUTES = {
  inici:     { label: "Check-in ràpid", index: "00", render: renderCheckin },
  dolor:     { label: "Dolor corporal", index: "01", render: renderPain },
  malcap:    { label: "Mal de cap",     index: "02", render: renderHeadache },
  vertigen:  { label: "Vertígens",      index: "03", render: renderVertigo },
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
};

const COMING_SOON = [];

async function main() {
  try {
    await openDatabase();
  } catch (err) {
    document.getElementById("app").innerHTML = `
      <div class="empty-state">
        <div class="emoji-mark">!</div>
        <p>No s'ha pogut obrir la base de dades local (IndexedDB).<br>${err.message}</p>
      </div>`;
    return;
  }

  renderShell();
  navigateTo("inici");
}

function renderShell() {
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">Quadern de salut<span class="brand-sub">Local · Privat</span></div>
        <ul class="nav-list" id="nav-list"></ul>
        <div class="sidebar-footer">Totes les dades es queden<br>en aquest navegador.</div>
      </aside>
      <main class="main" id="view"></main>
    </div>
  `;

  const navList = document.getElementById("nav-list");
  navList.innerHTML = [
    ...Object.entries(ROUTES).map(
      ([key, r]) => `<li class="nav-item" data-route="${key}"><span class="nav-index">${r.index}</span> ${r.label}</li>`
    ),
    ...COMING_SOON.map(
      (r) => `<li class="nav-item disabled" title="Es construirà en una fase següent"><span class="nav-index">${r.index}</span> ${r.label}</li>`
    ),
  ].join("");

  navList.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.dataset.route));
  });
}

async function navigateTo(routeKey) {
  const route = ROUTES[routeKey];
  if (!route) return;

  document.querySelectorAll(".nav-item[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === routeKey);
  });

  const view = document.getElementById("view");
  await route.render(view);
}

main();
