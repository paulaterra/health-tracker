import { VARIABLE_META } from "./normalizer.js";
import { humanLagLabel } from "./correlation.js";

/**
 * A partir dels patrons bruts del motor de correlacions, decideix si cada
 * un representa un possible factor desencadenant o protector (només per a
 * variables de resultat que tenen "valence" definida, és a dir, símptomes
 * on és clar si pujar és bo o dolent).
 */
export function classifyConclusions(correlations) {
  const withValence = correlations.filter(p => VARIABLE_META[p.outcomeKey]?.valence);

  const scored = withValence.map(p => {
    const valence = VARIABLE_META[p.outcomeKey].valence;
    const worsens = (p.direction === "augmenta" && valence === "negative") ||
                    (p.direction === "disminueix" && valence === "positive");
    const kind = worsens ? "trigger" : "protector";
    return { ...p, kind };
  });

  // Deduplica: per cada parella (predictor, outcome, kind), es queda només
  // amb la finestra temporal de força més alta, per no repetir gairebé el
  // mateix missatge 5 cops amb lags diferents.
  const bestByPair = new Map();
  scored.forEach(p => {
    const key = `${p.predictorKey}|${p.outcomeKey}|${p.kind}`;
    const prev = bestByPair.get(key);
    if (!prev || p.strength > prev.strength) bestByPair.set(key, p);
  });

  const deduped = [...bestByPair.values()];
  const triggers = deduped.filter(p => p.kind === "trigger").sort((a, b) => b.strength - a.strength);
  const protectors = deduped.filter(p => p.kind === "protector").sort((a, b) => b.strength - a.strength);

  return {
    triggers: triggers.map(buildConclusion),
    protectors: protectors.map(buildConclusion),
  };
}

function buildConclusion(p) {
  const predictorMeta = VARIABLE_META[p.predictorKey];
  return {
    ...p,
    lagLabel: humanLagLabel(p.lag),
    recommendation: recommendationFor(predictorMeta.category, p.kind),
  };
}

const TRIGGER_RECOMMENDATIONS = {
  Son: "Podria valer la pena parar atenció a la teva rutina de son i comentar-ho amb el metge si es repeteix.",
  Digestiu: "Rellevant per al SIBO / intestí irritable — anota-ho per a la propera visita amb digestiu.",
  Cicle: "Si es repeteix en diversos cicles, val la pena comentar-ho amb ginecologia.",
  Exercici: "Fixa't si aquest tipus d'esforç et convé o si caldria adaptar-lo (per exemple amb el fisio).",
  Medicació: "Comenta-ho amb qui te la va prescriure per si cal revisar la pauta.",
  Dolor: "Anota-ho per comentar-ho amb el metge; pot ajudar a localitzar l'origen del dolor.",
  Pell: "Anota-ho per a dermatologia, especialment si coincideix amb algun altre factor.",
  Energia: "Anota-ho — pot ajudar a entendre els teus dies de baixada d'energia.",
};

const PROTECTOR_RECOMMENDATIONS = {
  Son: "Sembla que ajuda al teu descans — podria valer la pena prioritzar-ho quan puguis.",
  Digestiu: "Sembla que ajuda al teu digestiu — útil per comentar-ho amb digestiu com a possible pauta.",
  Cicle: "Pot ser un factor protector real o casualitat del cicle — segueix observant-ho.",
  Exercici: "Sembla que t'ajuda — podria valer la pena mantenir aquesta rutina.",
  Medicació: "Sembla que ajuda quan la prens — comenta-ho amb qui te la va prescriure per confirmar-ho.",
  Dolor: "Sembla que ho redueix — pot valer la pena mantenir-ho o parlar-ne amb el fisio.",
  Pell: "Sembla protector per a la pell — útil per comentar-ho amb dermatologia.",
  Energia: "Sembla que t'ajuda a tenir més energia — val la pena mantenir-ho si pots.",
};

function recommendationFor(category, kind) {
  const table = kind === "trigger" ? TRIGGER_RECOMMENDATIONS : PROTECTOR_RECOMMENDATIONS;
  return table[category] || "Anota-ho per comentar-ho amb el metge a la propera visita.";
}
