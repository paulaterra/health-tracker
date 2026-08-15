import { VARIABLE_META } from "./normalizer.js";
import { humanLagLabel } from "./correlation.js";

// Un "factor protector" ha de ser una cosa potencialment modificable o una
// intervenció; mai un símptoma (mocs, inflor, diarrea, dolor...).
const ACTIONABLE_PROTECTORS = new Set([
  "exercici_fet", "exercici_gimnas", "exercici_fisio",
  "exercici_activacio_neuromuscular", "exercici_caminar", "exercici_passos",
  "medicacio_presa",
]);
// Possibles antecedents: només context/intervencions que poden passar abans.
const PLAUSIBLE_TRIGGERS = new Set([
  ...ACTIONABLE_PROTECTORS,
  "son_qualitat", "son_despertars", "son_fatiga_mati",
]);

export function classifyConclusions(correlations) {
  const triggers = [];
  const protectors = [];

  for (const p of correlations) {
    const outcomeMeta = VARIABLE_META[p.outcomeKey];
    if (!outcomeMeta?.valence || p.lag < 1) continue;
    // Una observació inicial no es converteix en desencadenant/protector.
    if (p.confidence?.label === "observació") continue;
    const worsens = (p.direction === "augmenta" && outcomeMeta.valence === "negative") ||
                    (p.direction === "disminueix" && outcomeMeta.valence === "positive");
    if (worsens && PLAUSIBLE_TRIGGERS.has(p.predictorKey)) triggers.push(buildConclusion(p, "trigger"));
    if (!worsens && ACTIONABLE_PROTECTORS.has(p.predictorKey)) protectors.push(buildConclusion(p, "protector"));
  }

  return {
    triggers: triggers.sort(rank).slice(0, 5),
    protectors: protectors.sort(rank).slice(0, 5),
  };
}

function rank(a,b) {
  return b.confidence.score-a.confidence.score || b.strength-a.strength;
}
function buildConclusion(p, kind) {
  return { ...p, kind, lagLabel: humanLagLabel(p.lag), recommendation: recommendationFor(p, kind) };
}
function recommendationFor(p, kind) {
  const category = VARIABLE_META[p.predictorKey]?.category;
  if (kind === "protector") {
    if (category === "Exercici") return "Comprova si aquesta diferència es repeteix amb el mateix tipus i quantitat d'activitat abans de considerar-la una pauta útil.";
    if (category === "Medicació") return "Comenta aquesta resposta temporal amb el professional que t'ha indicat la medicació; no la modifiquis només a partir de l'app.";
  }
  if (category === "Son") return "Segueix registrant el son la nit anterior i el símptoma de l'endemà per comprovar si la diferència es manté.";
  if (category === "Exercici") return "Comprova si es repeteix amb el mateix tipus i intensitat d'activitat abans de canviar la rutina.";
  if (category === "Medicació") return "Comenta aquesta associació temporal amb el professional sanitari; no modifiquis la medicació només a partir de l'app.";
  return "Continua registrant aquesta variable abans de l'episodi per veure si la relació es manté.";
}
