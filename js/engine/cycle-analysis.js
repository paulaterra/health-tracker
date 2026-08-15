import { VARIABLE_META } from "./normalizer.js";

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function periodStarts(matrix) {
  const bleeding = new Set(Object.keys(matrix).filter(date => matrix[date]?.cicle_regla === true));
  return [...bleeding].sort().filter(date => !bleeding.has(addDays(date,-1)));
}
function active(meta, value) {
  if (value === undefined || value === null) return false;
  if (meta.type === "boolean") return value === true;
  return Number(value) >= 6;
}
function confidence(cycles, hitRate) {
  if (cycles >= 4 && hitRate >= 0.75) return "alta";
  if (cycles >= 3 && hitRate >= 0.67) return "moderada";
  return "preliminar";
}

const WINDOWS = [
  { id:"before_22_28", min:-28, max:-22, label:"3–4 setmanes abans de la regla" },
  { id:"before_15_21", min:-21, max:-15, label:"2–3 setmanes abans de la regla" },
  { id:"before_8_14",  min:-14, max:-8,  label:"1–2 setmanes abans de la regla" },
  { id:"before_1_7",   min:-7,  max:-1,  label:"la setmana abans de la regla" },
  { id:"period",       min:0,   max:4,   label:"durant els primers dies de la regla" },
  { id:"after_1_7",    min:5,   max:11,  label:"la setmana posterior a la regla" },
];

const EXCLUDED = new Set([
  "dolor_registrat", "digestiu_deposicio_registrada", "son_registrat",
  "cicle_regla", "cicle_premenstrual", "cicle_postmenstrual", "cicle_ovulacio_finestra", "cicle_ovulacio_registrada",
  "exercici_fet", "exercici_gimnas", "exercici_fisio", "exercici_activacio_neuromuscular", "exercici_caminar", "exercici_passos",
  "medicacio_presa",
]);

function hasRealObservation(day) {
  if (!day) return false;
  return Object.keys(day).some(key => !key.startsWith("cicle_"));
}
function windowCoverage(matrix, start, win) {
  let observed = 0;
  for (let offset=win.min; offset<=win.max; offset++) {
    if (hasRealObservation(matrix[addDays(start,offset)])) observed++;
  }
  return observed / (win.max-win.min+1);
}

function cyclesWithSignal(matrix, starts, key, meta, win) {
  const eligible = [];
  const hits = [];
  for (const start of starts) {
    // No atribuïm una finestra al cicle si gairebé no hi ha dies registrats en aquella finestra.
    if (windowCoverage(matrix,start,win) < 0.5) continue;
    eligible.push(start);
    let found = false;
    for (let offset=win.min; offset<=win.max; offset++) {
      if (active(meta, matrix[addDays(start,offset)]?.[key])) { found = true; break; }
    }
    if (found) hits.push(start);
  }
  return { eligible, hits };
}

export function analyzeCyclePatterns(matrix) {
  const starts = periodStarts(matrix);
  // Només els intervals ENTRE dos inicis reals són cicles complets comparables.
  // L'últim inici continua sent un cicle obert i no pot comptar com a cicle comparable.
  const completedStarts = starts.slice(0, -1);

  // Regla fonamental V3: sense menstruacions REALMENT registrades, el motor no
  // genera ni observacions ni hipòtesis temporals sobre el cicle.
  if (starts.length === 0) {
    return {
      cycleCount: 0,
      periodStarts: [],
      hypotheses: [], detected: [], tracking: [],
      analysisAvailable: false,
      summary: "Encara no hi ha cap inici de menstruació registrat. No s'analitzen patrons respecte al cicle fins que hi hagi dades reals del cicle.",
    };
  }

  // Amb un únic inici només sabem situar temporalment els símptomes, però no
  // podem afirmar que una finestra es repeteix. Evitem llistes d'"observacions"
  // que podrien semblar patrons.
  if (starts.length < 2) {
    return {
      cycleCount: starts.length,
      periodStarts: starts,
      hypotheses: [], detected: [], tracking: [],
      analysisAvailable: false,
      summary: "Hi ha un cicle registrat, però encara no es comparen símptomes per setmanes del cicle. Cal almenys un segon inici de menstruació real per buscar repeticions.",
    };
  }

  const hypotheses = [];
  for (const [key, meta] of Object.entries(VARIABLE_META)) {
    if (EXCLUDED.has(key) || meta.valence !== "negative") continue;

    const totalSignalDays = Object.keys(matrix).filter(d => active(meta, matrix[d]?.[key])).length;
    if (totalSignalDays < 3) continue;

    let best = null;
    for (const win of WINDOWS) {
      const { eligible, hits } = cyclesWithSignal(matrix, completedStarts, key, meta, win);
      if (eligible.length < 2) continue;
      const rate = hits.length / eligible.length;
      const candidate = { win, eligible, hits, rate };
      if (!best || candidate.rate > best.rate || (candidate.rate === best.rate && candidate.hits.length > best.hits.length)) best = candidate;
    }
    if (!best) continue;

    const cyclesObserved = best.eligible.length;
    const cyclesWithSignalCount = best.hits.length;
    const recurrent = cyclesObserved >= 2 && cyclesWithSignalCount >= 2 && best.rate >= 0.67;
    if (!recurrent) continue;

    hypotheses.push({
      id:`${key}_${best.win.id}`,
      key,
      title:`${meta.label} · ${best.win.label}`,
      status: cyclesObserved >= 3 ? "detected" : "tracking",
      confidence: confidence(cyclesObserved,best.rate),
      cyclesObserved,
      cyclesWithSignal:cyclesWithSignalCount,
      rate:best.rate,
      text:`${meta.label} ha aparegut en ${cyclesWithSignalCount} de ${cyclesObserved} cicles comparables dins de ${best.win.label} (${Math.round(best.rate*100)}%).`,
      trackingText:`Continua registrant ${meta.label.toLowerCase()} i la menstruació per comprovar si aquesta finestra es manté en més cicles.`,
    });
  }

  hypotheses.sort((a,b) => (b.status==="detected")-(a.status==="detected") || (b.rate||0)-(a.rate||0));
  const detected = hypotheses.filter(x=>x.status==="detected");
  const tracking = hypotheses.filter(x=>x.status==="tracking").slice(0,4);
  return {
    cycleCount: starts.length,
    periodStarts: starts,
    hypotheses,
    detected,
    tracking,
    analysisAvailable: completedStarts.length >= 2,
    summary: completedStarts.length < 2
      ? `Hi ha ${starts.length} inicis de menstruació registrats, però només ${completedStarts.length} cicle complet. Encara no es mostren patrons menstruals repetits: calen almenys 2 cicles complets comparables.`
      : detected.length
      ? `S'han detectat ${detected.length} patrons que es repeteixen respecte a la menstruació en almenys 3 cicles comparables.`
      : tracking.length
        ? `Hi ha ${tracking.length} senyal${tracking.length===1?"":"s"} que s'ha repetit en 2 cicles, però encara calen més cicles abans de considerar-lo patró.`
        : "Encara no hi ha cap finestra del cicle que es repeteixi prou entre cicles per mostrar-la com a patró.",
  };
}
