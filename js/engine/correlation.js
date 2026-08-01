import { VARIABLE_META } from "./normalizer.js";

const LAGS = [-30, -21, -14, -7, -3, -2, -1, 0, 1, 2, 3, 7, 14, 21, 30];
const MIN_N = 4; // per sota d'això, no es mostra (evidència insuficient)
const NUMERIC_HIGH = 6; // llindar per considerar "alt" una variable numèrica 0-10
const NUMERIC_LOW = 3;  // llindar per considerar "baix"

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr, m) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/** Divideix els dies segons si el predictor està "exposat" o no, per al seu tipus. */
function splitGroups(pairs, predictorType) {
  const groupA = []; // exposat / cert
  const groupB = []; // no exposat / fals
  pairs.forEach(([pVal, oVal]) => {
    if (predictorType === "boolean") {
      if (pVal) groupA.push(oVal); else groupB.push(oVal);
    } else {
      if (pVal >= NUMERIC_HIGH) groupA.push(oVal);
      else if (pVal <= NUMERIC_LOW) groupB.push(oVal);
      // valors intermedis (4-5) es descarten per augmentar el contrast
    }
  });
  return { groupA, groupB };
}

function effectSizeNumeric(groupA, groupB) {
  const mA = mean(groupA), mB = mean(groupB);
  const sA = stdDev(groupA, mA), sB = stdDev(groupB, mB);
  const nA = groupA.length, nB = groupB.length;
  const pooledStd = Math.sqrt(((nA - 1) * sA * sA + (nB - 1) * sB * sB) / (nA + nB - 2)) || 0.001;
  const cohend = (mA - mB) / pooledStd;
  return { diff: mA - mB, meanA: mA, meanB: mB, cohend };
}

function effectSizeBoolean(groupA, groupB) {
  const rateA = groupA.filter(Boolean).length / groupA.length;
  const rateB = groupB.filter(Boolean).length / groupB.length;
  return { diff: rateA - rateB, rateA, rateB };
}

function confidenceLabel(strength) {
  if (strength >= 1.1) return { label: "alta", pct: 80 };
  if (strength >= 0.6) return { label: "moderada", pct: 60 };
  return { label: "preliminar", pct: 40 };
}

/**
 * Calcula patrons creuant totes les variables entre si, a diferents
 * finestres temporals. Retorna una llista ordenada per força d'associació.
 */
export function computeCorrelations(matrix, { minN = MIN_N } = {}) {
  const dates = Object.keys(matrix).sort();
  if (dates.length === 0) return [];

  const keys = Object.keys(VARIABLE_META);
  const results = [];

  for (const predictorKey of keys) {
    const predictorMeta = VARIABLE_META[predictorKey];
    for (const outcomeKey of keys) {
      if (predictorKey === outcomeKey) continue;
      const outcomeMeta = VARIABLE_META[outcomeKey];

      for (const lag of LAGS) {
        const pairs = [];
        for (const d of dates) {
          const pVal = matrix[d]?.[predictorKey];
          if (pVal === undefined) continue;
          const targetDate = addDays(d, lag);
          const oVal = matrix[targetDate]?.[outcomeKey];
          if (oVal === undefined) continue;
          pairs.push([pVal, oVal]);
        }
        if (pairs.length < minN * 2) continue;

        const { groupA, groupB } = splitGroups(pairs, predictorMeta.type);
        if (groupA.length < minN || groupB.length < minN) continue;

        let effect, strength, direction;
        if (outcomeMeta.type === "numeric") {
          effect = effectSizeNumeric(groupA, groupB);
          strength = Math.abs(effect.cohend);
          direction = effect.diff > 0 ? "augmenta" : "disminueix";
          if (strength < 0.3) continue; // efecte massa petit per remarcar
        } else {
          effect = effectSizeBoolean(groupA, groupB);
          strength = Math.abs(effect.diff) * 3; // reescalat aprox. a un rang comparable
          direction = effect.diff > 0 ? "augmenta" : "disminueix";
          if (Math.abs(effect.diff) < 0.15) continue;
        }

        const conf = confidenceLabel(strength);
        results.push({
          predictorKey, outcomeKey, lag,
          predictorLabel: predictorMeta.label,
          outcomeLabel: outcomeMeta.label,
          predictorType: predictorMeta.type,
          outcomeType: outcomeMeta.type,
          direction,
          effect,
          strength,
          confidence: conf,
          nA: groupA.length,
          nB: groupB.length,
        });
      }
    }
  }

  results.sort((a, b) => b.strength - a.strength);
  return results;
}

export function humanLagLabel(lag) {
  if (lag === 0) return "el mateix dia";
  if (lag > 0) return lag === 1 ? "l'endemà (+1 dia)" : `+${lag} dies després`;
  return lag === -1 ? "el dia abans" : `${Math.abs(lag)} dies abans`;
}

const DOW_NAMES = ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"];

/**
 * Busca patrons setmanals: un dia de la setmana concret és sistemàticament
 * millor o pitjor que la mitjana per a una variable.
 */
export function computeDayOfWeekPatterns(matrix, { minN = 3 } = {}) {
  const keys = Object.keys(VARIABLE_META);
  const results = [];

  for (const key of keys) {
    const meta = VARIABLE_META[key];
    const byDow = [[], [], [], [], [], [], []];
    const all = [];
    for (const date of Object.keys(matrix)) {
      const val = matrix[date][key];
      if (val === undefined) continue;
      const dow = new Date(date + "T00:00:00").getDay();
      const numeric = meta.type === "boolean" ? (val ? 1 : 0) : val;
      byDow[dow].push(numeric);
      all.push(numeric);
    }
    if (all.length < minN * 3) continue;
    const overallMean = mean(all);
    const overallStd = stdDev(all, overallMean) || 0.5;

    byDow.forEach((groupVals, dow) => {
      if (groupVals.length < minN) return;
      const groupMean = mean(groupVals);
      const z = (groupMean - overallMean) / overallStd;
      if (Math.abs(z) < 0.6) return;
      results.push({
        key, label: meta.label, type: meta.type, dow, dowName: DOW_NAMES[dow],
        groupMean, overallMean, n: groupVals.length, strength: Math.abs(z),
        direction: groupMean > overallMean ? "més alt" : "més baix",
      });
    });
  }

  results.sort((a, b) => b.strength - a.strength);
  return results;
}

/**
 * Busca tendències generals: compara la primera meitat del període
 * registrat amb la segona per veure si una variable millora o empitjora.
 */
export function computeTrends(matrix, { minN = 6 } = {}) {
  const dates = Object.keys(matrix).sort();
  if (dates.length < minN * 2) return [];
  const midDate = dates[Math.floor(dates.length / 2)];

  const keys = Object.keys(VARIABLE_META);
  const results = [];

  for (const key of keys) {
    const meta = VARIABLE_META[key];
    const firstHalf = [];
    const secondHalf = [];
    for (const date of dates) {
      const val = matrix[date][key];
      if (val === undefined) continue;
      const numeric = meta.type === "boolean" ? (val ? 1 : 0) : val;
      if (date < midDate) firstHalf.push(numeric); else secondHalf.push(numeric);
    }
    if (firstHalf.length < minN || secondHalf.length < minN) continue;
    const m1 = mean(firstHalf), m2 = mean(secondHalf);
    const pooledStd = stdDev([...firstHalf, ...secondHalf], mean([...firstHalf, ...secondHalf])) || 0.5;
    const diff = m2 - m1;
    const strength = Math.abs(diff) / pooledStd;
    if (strength < 0.4) continue;
    results.push({
      key, label: meta.label, type: meta.type,
      firstMean: m1, secondMean: m2, diff, strength,
      direction: diff > 0 ? "a l'alça" : "a la baixa",
      nFirst: firstHalf.length, nSecond: secondHalf.length,
    });
  }

  results.sort((a, b) => b.strength - a.strength);
  return results;
}
