import { Repository } from "../db/repository.js";
import { buildDailyMatrix } from "./normalizer.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "./correlation.js";
import { classifyConclusions } from "./conclusions.js";

const painRepo = new Repository("pain_events");

const PAIN_TYPE_LABELS = {
  punxant: "punxant / ganivet", cremor: "cremor", pressio: "pressió",
  contractura: "contractura", rigidesa: "rigidesa", descarrega: "descàrrega",
  difus: "dolor difús"
};

function dateOnly(value) { return (value || "").slice(0, 10); }
function inRange(date, start, end) { return (!start || date >= start) && (!end || date <= end); }
function average(values) { return values.length ? values.reduce((a,b)=>a+b,0) / values.length : null; }
function topCount(map) { return [...map.entries()].sort((a,b)=>b[1]-a[1])[0] || null; }
function confidenceFromCount(n) { return n >= 30 ? "alta" : n >= 14 ? "moderada" : n >= 7 ? "baixa" : "insuficient"; }

function painSpecificInsights(records) {
  if (!records.length) return { summary: [], profile: null, recommendations: [] };
  const intensities = records.map(r => Number(r.intensitat || 0));
  const zones = new Map(), types = new Map(), triggers = new Map(), sleep = new Map(), moments = new Map();
  records.forEach(r => {
    (r.entries || []).forEach(e => zones.set(e.zoneLabel || e.zone || "Zona no especificada", (zones.get(e.zoneLabel || e.zone || "Zona no especificada") || 0) + 1));
    (r.painDrawing || []).forEach(s => types.set(s.label || PAIN_TYPE_LABELS[s.type] || s.type, (types.get(s.label || PAIN_TYPE_LABELS[s.type] || s.type) || 0) + 1));
    (r.tipusDolor || []).forEach(t => types.set(PAIN_TYPE_LABELS[t] || t, (types.get(PAIN_TYPE_LABELS[t] || t) || 0) + 1));
    (r.empitjora || []).forEach(t => triggers.set(t, (triggers.get(t) || 0) + 1));
    (r.impacteSon || []).forEach(t => sleep.set(t, (sleep.get(t) || 0) + 1));
    const hour = new Date(r.timestamp).getHours();
    const moment = hour < 11 ? "matí" : hour < 16 ? "migdia" : hour < 21 ? "tarda" : "nit";
    moments.set(moment, (moments.get(moment) || 0) + 1);
  });
  const avg = average(intensities), max = Math.max(...intensities);
  const topZone = topCount(zones), topType = topCount(types), topTrigger = topCount(triggers), topMoment = topCount(moments);
  const sleepAffected = records.filter(r => (r.impacteSon || []).some(x => x !== "no_afecta" && x !== "no afecta")).length;
  const summary = [
    `Intensitat mitjana ${avg.toFixed(1)}/10 i pic màxim ${max}/10 en ${records.length} registres.`,
    topZone ? `La zona més repetida és ${topZone[0]} (${topZone[1]} registres).` : null,
    topType ? `El tipus de dolor més repetit és ${topType[0]} (${topType[1]} registres o traços).` : null,
    topTrigger ? `El context que coincideix més sovint amb l'empitjorament és ${topTrigger[0]} (${topTrigger[1]} registres).` : null,
    topMoment ? `El moment amb més registres és el ${topMoment[0]} (${topMoment[1]} registres).` : null,
    sleepAffected ? `El dolor afecta el son en ${sleepAffected} de ${records.length} registres (${Math.round(sleepAffected / records.length * 100)}%).` : null,
  ].filter(Boolean);
  const recommendations = [];
  if (records.length < 14) recommendations.push("Registra el dolor de manera constant durant almenys 14 dies per poder comparar millor son, activitat, cicle i digestió.");
  if (topTrigger) recommendations.push(`Continua marcant “${topTrigger[0]}” de manera sistemàtica per confirmar si la coincidència es manté.`);
  if (sleepAffected / records.length >= 0.3) recommendations.push("Comenta amb el professional sanitari que el dolor interfereix amb el son i porta l'informe amb les dates i intensitats.");
  if (topZone) recommendations.push(`Registra amb precisió la zona “${topZone[0]}” i diferencia dolor habitual, nou, irradiat o contractura.`);
  return {
    summary,
    recommendations,
    profile: { count: records.length, avg, max, topZone, topType, topTrigger, topMoment, sleepAffected, confidence: confidenceFromCount(records.length) }
  };
}

function patternText(p) {
  const predictor = p.predictorType === "boolean" ? p.predictorLabel.toLowerCase() : `${p.predictorLabel.toLowerCase()} alt`;
  let effect = "";
  if (p.outcomeType === "numeric") effect = `${p.outcomeLabel} passa de ${p.effect.meanB.toFixed(1)} a ${p.effect.meanA.toFixed(1)}/10`;
  else effect = `${p.outcomeLabel} passa de ${(p.effect.rateB*100).toFixed(0)}% a ${(p.effect.rateA*100).toFixed(0)}% dels dies`;
  return `${predictor} ↔ ${effect} (${humanLagLabel(p.lag)}).`;
}

export async function generateIntelligence({ start = null, end = null } = {}) {
  const [fullMatrix, pains] = await Promise.all([buildDailyMatrix(), painRepo.getAll()]);
  const matrix = Object.fromEntries(Object.entries(fullMatrix).filter(([d]) => inRange(d, start, end)));
  const painRecords = pains.filter(p => inRange(dateOnly(p.timestamp), start, end)).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  const dates = Object.keys(matrix).sort();
  const correlations = computeCorrelations(matrix);
  const weekly = computeDayOfWeekPatterns(matrix);
  const trends = computeTrends(matrix);
  const { triggers, protectors } = classifyConclusions(correlations);
  const pain = painSpecificInsights(painRecords);
  const strongest = correlations.slice(0, 6).map(p => ({ ...p, text: patternText(p) }));
  const conclusions = [
    ...triggers.slice(0, 4).map(p => ({ kind: "trigger", text: patternText(p), confidence: p.confidence.label, recommendation: p.recommendation })),
    ...protectors.slice(0, 4).map(p => ({ kind: "protector", text: patternText(p), confidence: p.confidence.label, recommendation: p.recommendation })),
  ];
  const recommendations = [...new Set([
    ...pain.recommendations,
    ...conclusions.map(c => c.recommendation).filter(Boolean),
    dates.length < 14 ? "Completa el check-in, el son i el dolor el mateix dia per reduir buits i millorar la fiabilitat." : null,
    "Interpreta aquests resultats com associacions observades, no com causes demostrades ni diagnòstics."
  ].filter(Boolean))].slice(0, 8);
  return {
    period: { start: start || dates[0] || null, end: end || dates.at(-1) || null, days: dates.length },
    dataQuality: { level: confidenceFromCount(dates.length), days: dates.length, painRecords: painRecords.length },
    pain,
    patterns: strongest,
    weekly: weekly.slice(0, 5),
    trends: trends.slice(0, 5),
    conclusions,
    recommendations,
    correlations,
    triggers,
    protectors,
  };
}
