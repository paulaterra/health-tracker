import { supabase } from "../../db/supabase.js";
import { APP_INFO } from "../../app-info.js";
import { isViewerMode, getViewerToken } from "../../view-mode.js";

function statusRow(label, value, state = "neutral", id = "") {
  const icon = state === "ok" ? "🟢" : state === "error" ? "🔴" : state === "checking" ? "🟡" : "";
  return `
    <div class="app-status-row">
      <span>${label}</span>
      <strong ${id ? `id="${id}"` : ""} class="app-status-value app-status-${state}">${icon ? `${icon} ` : ""}${value}</strong>
    </div>`;
}

async function checkStatus() {
  const database = document.getElementById("status-database");
  const supabaseStatus = document.getElementById("status-supabase");
  const pwa = document.getElementById("status-pwa");

  try {
    if (isViewerMode()) {
      const { error } = await supabase.rpc("professional_records", {
        p_token: getViewerToken(),
        p_store_name: null,
        p_record_id: null,
      });
      if (error) throw error;
      supabaseStatus.textContent = "🟢 Mode consulta";
      supabaseStatus.className = "app-status-value app-status-ok";
    } else {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw sessionError || new Error("No hi ha cap sessió activa");
      supabaseStatus.textContent = "🟢 OK";
      supabaseStatus.className = "app-status-value app-status-ok";
      const { error } = await supabase.from("health_records").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    }
    database.textContent = "🟢 Connectada";
    database.className = "app-status-value app-status-ok";
  } catch (error) {
    console.error("Comprovació d'estat:", error);
    database.textContent = "🔴 Sense connexió";
    database.className = "app-status-value app-status-error";
    supabaseStatus.textContent = "🔴 Error";
    supabaseStatus.className = "app-status-value app-status-error";
  }

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration("./");
      pwa.textContent = registration ? "Versió actual" : "Disponible al navegador";
      pwa.className = `app-status-value ${registration ? "app-status-ok" : "app-status-neutral"}`;
    } catch {
      pwa.textContent = "No disponible";
      pwa.className = "app-status-value app-status-error";
    }
  } else {
    pwa.textContent = "No compatible";
    pwa.className = "app-status-value app-status-error";
  }
}

export async function renderAbout(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <p class="view-eyebrow">Paula Tracker</p>
        <h1>Versió i estat</h1>
      </div>
    </div>

    <section class="card app-status-card">
      ${statusRow("Versió", APP_INFO.version)}
      ${statusRow("Última actualització", APP_INFO.updatedAt)}
      ${statusRow("Base de dades", "Comprovant…", "checking", "status-database")}
      ${statusRow("Supabase", "Comprovant…", "checking", "status-supabase")}
      ${statusRow("PWA", "Comprovant…", "checking", "status-pwa")}
    </section>`;

  await checkStatus();
}
