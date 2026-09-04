import { buildDailyMatrix } from "../../engine/normalizer.js";
import { computeCorrelations } from "../../engine/correlation.js";
import { classifyConclusions } from "../../engine/conclusions.js";
import { escapeHtml } from "../../utils/dom.js";
import { generateIntelligence } from "../../engine/intelligence.js";
import { intelligentSummaryHtml, recommendationsHtml } from "../../engine/intelligence-view.js";
import { buildClinicalHypotheses, clinicalHypothesesHtml, loadHypothesisFollowups } from "../../engine/clinical-hypotheses.js?v=1.6.31";
import { Repository } from "../../db/repository.js";
import { isViewerMode } from "../../view-mode.js";

export async function renderConclusions(container) {
  container.innerHTML = `
    <div class="view-header">
      <span class="view-eyebrow">Anàlisi</span>
      <h1 class="view-title">Conclusions i recomanacions</h1>
      <p class="view-sub">L'app genera aquestes hipòtesis sola, a partir dels patrons detectats a les teves dades — no cal que n'escriguis cap. Classifica cada relació com a possible factor desencadenant o protector, i hi afegeix una recomanació pràctica.</p>
    </div>
    <div class="card" id="conclusions-wrap"><p class="ledger-empty">Calculant…</p></div>
  `;

  const [matrix, intel] = await Promise.all([buildDailyMatrix(), generateIntelligence()]);
  const numDays = Object.keys(matrix).length;
  const correlations = computeCorrelations(matrix);
  const { triggers, protectors } = classifyConclusions(correlations);

  const wrap = container.querySelector("#conclusions-wrap");

  if (numDays < 14) {
    wrap.innerHTML = emptyState(`Encara tens poques dades (${numDays} dia${numDays === 1 ? "" : "s"}). Amb almenys 14 dies de registre constant, l'app ja podrà proposar les primeres conclusions.`);
    return;
  }

  const clinicalHypotheses = buildClinicalHypotheses(matrix);
  const hypothesisFollowups = await loadHypothesisFollowups();

  if (triggers.length === 0 && protectors.length === 0 && clinicalHypotheses.length === 0) {
    wrap.innerHTML = emptyState(`Amb ${numDays} dies de dades, encara no hi ha prou relacions consistents com per treure conclusions. Segueix registrant i torna-hi més endavant.`);
    return;
  }

  wrap.outerHTML = `
    ${intelligentSummaryHtml(intel, { title: "Conclusió global" })}
    <div style="height:var(--sp-5)"></div>

    ${section("Hipòtesis a explorar", "var(--ink-soft)",
      "Perfils de símptomes que poden orientar què comentar amb un professional. No són diagnòstics i es mantenen separats dels patrons estadístics.",
      clinicalHypothesesHtml(clinicalHypotheses, { interactive:true, followups:hypothesisFollowups }))}

    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: var(--sp-4);">
      <p style="font-size: var(--fs-sm); color: var(--ink-soft);">${numDays} dies amb dades · ${triggers.length} possibles desencadenants · ${protectors.length} possibles factors protectors.</p>
      <button class="btn btn-ghost" id="recalc-btn">Torna a calcular</button>
    </div>

    ${section("Possibles factors desencadenants", "var(--clay)",
      "Coses que, a les teves dades, semblen coincidir amb un empitjorament. Quan hi ha percentatges: 0% = cap dels casos analitzats; 100% = tots els casos analitzats.",
      triggers.length ? triggers.slice(0, 12).map(conclusionCard).join("") : `<p class="ledger-empty">Cap detectat encara.</p>`)}

    ${section("Possibles factors protectors", "var(--sage)",
      "Coses modificables que, a les teves dades, semblen coincidir amb una millora. Quan hi ha percentatges: 0% = cap dels casos analitzats; 100% = tots els casos analitzats.",
      protectors.length ? protectors.slice(0, 12).map(conclusionCard).join("") : `<p class="ledger-empty">Cap detectat encara.</p>`)}

    ${recommendationsHtml(intel)}
  `;

  container.querySelector("#recalc-btn")?.addEventListener("click", () => renderConclusions(container));
  bindHypothesisFollowups(container, hypothesisFollowups);
}


const hypothesisRepo = new Repository("hypotheses");

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("No s'ha pogut llegir el fitxer."));
    reader.readAsDataURL(file);
  });
}

export function bindHypothesisFollowups(container, initialFollowups = {}) {
  if (isViewerMode()) return;
  container.querySelectorAll("[data-hypothesis-followup]").forEach(editor => {
    const possibilityId = editor.dataset.hypothesisFollowup;
    let status = initialFollowups[possibilityId]?.status || "pending";
    let attachments = [...(initialFollowups[possibilityId]?.attachments || [])];

    const persistFollowup = async () => {
      const date = editor.querySelector(".hypothesis-date")?.value || "";
      const note = editor.querySelector(".hypothesis-note")?.value?.trim() || "";
      const existing = initialFollowups[possibilityId] || {};
      const saved = await hypothesisRepo.put({
        ...existing,
        id: existing.id || `clinical-${possibilityId}`,
        possibilityId,
        status,
        date,
        note,
        attachments
      });
      initialFollowups[possibilityId] = saved;
      return saved;
    };

    const refreshButtons = () => {
      const styles = {
        pending:   { bg: "#f2eadb", fg: "#725a2c" },
        confirmed: { bg: "#e4efe8", fg: "#315f45" },
        discarded: { bg: "#f3e3e0", fg: "#7a433d" }
      };

      editor.querySelectorAll(".hypothesis-status-btn").forEach(btn => {
        const active = btn.dataset.status === status;
        const visual = styles[btn.dataset.status] || styles.pending;
        btn.setAttribute("aria-pressed", String(active));
        btn.style.background = active ? visual.bg : "var(--paper)";
        btn.style.color = active ? visual.fg : "var(--ink-soft)";
        btn.style.borderColor = active ? visual.fg : "var(--line)";
        btn.style.fontWeight = active ? "750" : "600";
        btn.style.boxShadow = active ? `inset 0 0 0 1px ${visual.fg}` : "none";

        const icon = btn.querySelector("span");
        if (icon) {
          icon.style.background = active ? visual.fg : "var(--paper-alt)";
          icon.style.color = active ? "white" : "var(--ink-faint)";
        }
      });
    };

    editor.querySelectorAll(".hypothesis-status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        status = btn.dataset.status;
        refreshButtons();
      });
    });

    refreshButtons();

    editor.querySelector(".hypothesis-file-input")?.addEventListener("change", async event => {
      const state = editor.querySelector(".hypothesis-save-state");
      const labelInput = editor.querySelector(".hypothesis-file-label");
      const customLabel = labelInput?.value?.trim() || "";
      const files = [...(event.target.files || [])];
      if (!files.length) return;
      if (attachments.length + files.length > 10) {
        alert("Pots adjuntar un màxim de 10 fitxers per hipòtesi.");
        event.target.value = "";
        return;
      }
      state.textContent = "Preparant fitxer…";
      try {
        for (const file of files) {
          if (file.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" supera els 10 MB.`);
          attachments.push({
            label: files.length === 1 ? (customLabel || file.name) : (customLabel ? `${customLabel} ${attachments.length + 1}` : file.name),
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataUrl: await fileToDataUrl(file),
            addedAt: new Date().toISOString()
          });
        }
        if (labelInput) labelInput.value = "";
        renderAttachmentList();
        state.textContent = "Desant fitxer…";
        await persistFollowup();
        state.textContent = "Fitxer desat ✓";
      } catch (error) {
        alert(error.message || "No s'ha pogut afegir el fitxer.");
        state.textContent = "";
      } finally {
        event.target.value = "";
      }
    });

    const renderAttachmentList = () => {
      const list = editor.querySelector(".hypothesis-files");
      if (!list) return;
      list.innerHTML = attachments.map((f, i) => `<div class="hypothesis-file-row" data-file-index="${i}" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;padding:9px 10px;background:var(--paper-alt);border-radius:var(--radius-sm);font-size:var(--fs-xs);">
        <div style="min-width:0;">
          <label style="display:block;color:var(--ink-soft);font-size:11px;margin-bottom:3px;">Nom del document</label>
          <input type="text" class="input hypothesis-file-name-edit" data-file-index="${i}" value="${(f.label || f.name || `Document ${i+1}`).replace(/"/g,'&quot;')}" style="width:100%;padding:7px 8px;font-size:var(--fs-xs);">
          ${f.name ? `<div style="margin-top:3px;color:var(--ink-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Fitxer: ${f.name}</div>` : ""}
        </div>
        <span style="display:flex;gap:6px;flex-shrink:0;">
          <a class="btn btn-ghost hypothesis-download-file" href="${f.dataUrl || "#"}" download="${f.name || "document"}" style="padding:6px 8px;">Descarrega</a>
          <button type="button" class="btn btn-ghost hypothesis-remove-file" data-file-index="${i}" style="padding:6px 8px;">Elimina</button>
        </span>
      </div>`).join("");
      list.querySelectorAll(".hypothesis-file-name-edit").forEach(input => {
        const saveName = async () => {
          const idx = Number(input.dataset.fileIndex);
          if (!Number.isInteger(idx) || !attachments[idx]) return;
          const next = input.value.trim() || attachments[idx].name || `Document ${idx + 1}`;
          attachments[idx].label = next;
          input.value = next;
          try {
            await persistFollowup();
            const state = editor.querySelector(".hypothesis-save-state");
            if (state) {
              state.textContent = "Nom desat ✓";
              setTimeout(() => { if (state.textContent === "Nom desat ✓") state.textContent = ""; }, 1400);
            }
          } catch (error) {
            console.error(error);
            alert(error.message || "No s'ha pogut desar el nom del document.");
          }
        };
        input.addEventListener("change", saveName);
        input.addEventListener("blur", saveName);
      });

      list.querySelectorAll(".hypothesis-remove-file").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.fileIndex);
          if (Number.isInteger(idx)) {
            attachments.splice(idx, 1);
            renderAttachmentList();
            persistFollowup().catch(error => {
              console.error(error);
              alert(error.message || "No s'ha pogut actualitzar els documents.");
            });
          }
        });
      });
    };
    renderAttachmentList();

    editor.querySelector(".hypothesis-save-btn")?.addEventListener("click", async () => {
      const state = editor.querySelector(".hypothesis-save-state");
      state.textContent = "Desant…";
      try {
        await persistFollowup();
        state.textContent = "Desat ✓";
        setTimeout(() => { if (state.textContent === "Desat ✓") state.textContent = ""; }, 1800);
      } catch (error) {
        console.error(error);
        state.textContent = "";
        alert(error.message || "No s'ha pogut desar el seguiment.");
      }
    });
  });
}

function section(title, color, sub, bodyHtml) {
  return `
    <div style="margin-bottom: var(--sp-6);">
      <h2 style="font-family: var(--font-display); font-size: var(--fs-md); margin-bottom: var(--sp-1); color: ${color};">${title}</h2>
      <p style="font-size: var(--fs-xs); color: var(--ink-faint); margin: 0 0 var(--sp-3);">${sub}</p>
      <div style="display:flex; flex-direction:column; gap: var(--sp-3);">${bodyHtml}</div>
    </div>
  `;
}

function emptyState(message) {
  return `
    <div class="empty-state">
      <div class="emoji-mark">···</div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function conclusionCard(p) {
  const condLower = p.predictorType === "boolean"
    ? p.predictorLabel.toLowerCase()
    : `${p.predictorLabel.toLowerCase()} alt (≥6/10)`;

  const kindColor = p.kind === "trigger" ? "var(--clay)" : "var(--sage)";
  const kindLabel = p.kind === "trigger" ? "Hipòtesi: desencadenant" : "Hipòtesi: protector";

  const timing = p.lag >= 0
    ? `${humanCond(condLower)} <span style="color: var(--ink-faint); font-weight: 400;">(${p.lagLabel})</span>`
    : `<strong>${p.lagLabel}</strong> de tenir <strong>${escapeHtml(condLower)}</strong>`;

  let outcomeSentence;
  if (p.outcomeType === "numeric") {
    const { meanA, meanB } = p.effect;
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} passa de mitjana de ${meanB.toFixed(1)} a ${meanA.toFixed(1)}. ${numericScaleLegend(p.outcomeKey)}`;
  } else {
    const { rateA, rateB } = p.effect;
    const pctB = (rateB * 100).toFixed(0);
    const pctA = (rateA * 100).toFixed(0);
    const casesA = Math.round(rateA * p.nA);
    const casesB = Math.round(rateB * p.nB);
    outcomeSentence = `${escapeHtml(p.outcomeLabel)} apareix en ${pctA}% (${casesA} de ${p.nA} dies) quan hi ha el factor, comparat amb ${pctB}% (${casesB} de ${p.nB} dies) quan no hi és.`;
  }

  return `
    <div class="card" style="border-left: 3px solid ${kindColor};">
      <span class="badge" style="background: transparent; color: ${kindColor}; padding-left:0;">${kindLabel}</span>
      <p style="margin: var(--sp-1) 0 0; font-size: var(--fs-md); font-weight: 600;">${timing}</p>
      <p style="margin: var(--sp-1) 0 0; color: var(--ink-soft);">${outcomeSentence}</p>
      <p style="margin: var(--sp-3) 0 0; font-size: var(--fs-sm); color: ${kindColor};">💡 ${escapeHtml(p.recommendation)}</p>
      <p style="margin: var(--sp-2) 0 0; font-size: var(--fs-xs); color: var(--ink-faint); font-style: italic;">
        Basat en ${p.nA + p.nB} dies (n=${p.nA} vs n=${p.nB}) · confiança ${p.confidence.label}. Correlació, no diagnòstic.
      </p>
    </div>
  `;
}

function numericScaleLegend(key) {
  const legends = {
    dolor_general: "Escala 0–10: 0 = cap dolor; 10 = dolor màxim/molt intens.",
    dolor_intensitat_max: "Escala 0–10: 0 = cap dolor; 10 = dolor màxim/molt intens.",
    dolor_esquena_intensitat: "Escala 0–10: 0 = cap dolor; 10 = dolor màxim/molt intens.",
    dolor_darrere_cap_intensitat: "Escala 0–10: 0 = cap dolor; 10 = dolor màxim/molt intens.",
    mal_de_cap_intensitat: "Escala 0–10: 0 = cap dolor; 10 = mal de cap molt intens.",
    vertigen_intensitat: "Escala 0–10: 0 = cap sensació; 10 = sensació molt intensa.",
    digestiu_general: "Escala 0–10: 0 = cap molèstia; 10 = molèstia molt intensa.",
    digestiu_inflor: "Escala 0–10: 0 = gens d’inflor; 10 = inflor màxima/molt intensa.",
    digestiu_dolorAbdominal: "Escala 0–10: 0 = cap dolor; 10 = dolor molt intens.",
    digestiu_retortijons: "Escala 0–10: 0 = cap molèstia; 10 = molèstia molt intensa.",
    digestiu_gasos: "Escala 0–10: 0 = cap molèstia; 10 = molèstia molt intensa.",
    son_qualitat: "Escala 0–10: 0 = descans reparador; 10 = molt mal son.",
    son_fatiga_mati: "Escala 0–10: 0 = cap fatiga; 10 = fatiga extrema.",
    energia_fisica: "Escala 0–10: 0 = molta energia; 10 = esgotament.",
    energia_mental: "Escala 0–10: 0 = cap boira mental; 10 = boira mental molt intensa."
  };
  return legends[key] || "Escala 0–10: 0 = absència/mínim; 10 = màxim/molt intens.";
}

function humanCond(condLower) {
  return `Quan hi ha <strong>${escapeHtml(condLower)}</strong>`;
}
