import { VARIABLE_META } from "./normalizer.js";

const LAGS = [-30, -21, -14, -7, -3, -2, -1, 0, 1, 2, 3, 7, 14, 21, 30];
const NUMERIC_HIGH = 6;
const NUMERIC_LOW = 3;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function mean(arr) { return arr.reduce((a,b)=>a+b,0) / arr.length; }
function stdDev(arr, m) {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/(arr.length-1));
}
function minPerGroup(totalDays) {
  if (totalDays >= 90) return 12;
  if (totalDays >= 60) return 10;
  if (totalDays >= 30) return 7;
  return 5;
}
function splitGroups(pairs, predictorType) {
  const groupA = [], groupB = [];
  pairs.forEach(([pVal,oVal]) => {
    if (predictorType === "boolean") (pVal ? groupA : groupB).push(oVal);
    else if (pVal >= NUMERIC_HIGH) groupA.push(oVal);
    else if (pVal <= NUMERIC_LOW) groupB.push(oVal);
  });
  return { groupA, groupB };
}
function effectSizeNumeric(groupA, groupB) {
  const mA = mean(groupA), mB = mean(groupB);
  const sA = stdDev(groupA,mA), sB = stdDev(groupB,mB);
  const pooled = Math.sqrt(((groupA.length-1)*sA*sA+(groupB.length-1)*sB*sB)/(groupA.length+groupB.length-2)) || 0.001;
  return { diff:mA-mB, meanA:mA, meanB:mB, cohend:(mA-mB)/pooled };
}
function effectSizeBoolean(groupA, groupB) {
  const rateA = groupA.filter(Boolean).length/groupA.length;
  const rateB = groupB.filter(Boolean).length/groupB.length;
  return { diff:rateA-rateB, rateA, rateB };
}
function effectFor(pairs, predictorType, outcomeType) {
  const { groupA, groupB } = splitGroups(pairs, predictorType);
  if (!groupA.length || !groupB.length) return null;
  const effect = outcomeType === "numeric" ? effectSizeNumeric(groupA,groupB) : effectSizeBoolean(groupA,groupB);
  const direction = effect.diff > 0 ? 1 : effect.diff < 0 ? -1 : 0;
  return { effect, direction, nA:groupA.length, nB:groupB.length };
}
function stabilityFor(pairs, predictorType, outcomeType) {
  if (pairs.length < 16) return "desconeguda";
  const mid = Math.floor(pairs.length/2);
  const first = effectFor(pairs.slice(0,mid), predictorType, outcomeType);
  const second = effectFor(pairs.slice(mid), predictorType, outcomeType);
  if (!first || !second || first.nA < 3 || first.nB < 3 || second.nA < 3 || second.nB < 3) return "desconeguda";
  return first.direction !== 0 && first.direction === second.direction ? "estable" : "inestable";
}
function confidenceLabel({ strength, nA, nB, totalDays, coverage, stability }) {
  let score = 0;
  if (strength >= 1.1) score += 3; else if (strength >= 0.6) score += 2; else score += 1;
  const minGroup = Math.min(nA,nB);
  if (minGroup >= 15) score += 3; else if (minGroup >= 10) score += 2; else if (minGroup >= 7) score += 1;
  if (totalDays >= 90) score += 3; else if (totalDays >= 60) score += 2; else if (totalDays >= 30) score += 1;
  if (coverage >= 0.65) score += 2; else if (coverage >= 0.4) score += 1;
  if (stability === "estable") score += 2;
  if (stability === "inestable") score -= 2;

  if (totalDays < 30 || minGroup < 7) return { label:"preliminar", pct:35, score };
  if (score >= 10 && totalDays >= 60) return { label:"alta", pct:85, score };
  if (score >= 7) return { label:"moderada", pct:65, score };
  return { label:"baixa", pct:45, score };
}

export function computeCorrelations(matrix) {
  const dates = Object.keys(matrix).sort();
  const totalDays = dates.length;
  if (totalDays < 14) return [];
  const minN = minPerGroup(totalDays);
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
          const oVal = matrix[addDays(d,lag)]?.[outcomeKey];
          if (oVal === undefined) continue;
          pairs.push([pVal,oVal,d]);
        }
        const base = effectFor(pairs, predictorMeta.type, outcomeMeta.type);
        if (!base || base.nA < minN || base.nB < minN) continue;

        let strength;
        if (outcomeMeta.type === "numeric") {
          strength = Math.abs(base.effect.cohend);
          if (strength < 0.35) continue;
        } else {
          strength = Math.abs(base.effect.diff) * 3;
          if (Math.abs(base.effect.diff) < 0.18) continue;
        }
        const stability = stabilityFor(pairs, predictorMeta.type, outcomeMeta.type);
        const coverage = pairs.length / totalDays;
        const confidence = confidenceLabel({ strength, nA:base.nA, nB:base.nB, totalDays, coverage, stability });
        results.push({
          predictorKey, outcomeKey, lag,
          predictorLabel: predictorMeta.label, outcomeLabel: outcomeMeta.label,
          predictorType: predictorMeta.type, outcomeType: outcomeMeta.type,
          direction: base.effect.diff > 0 ? "augmenta" : "disminueix",
          effect: base.effect, strength, confidence,
          nA:base.nA, nB:base.nB, totalDays, coverage, stability,
        });
      }
    }
  }
  results.sort((a,b) => b.confidence.score-a.confidence.score || b.strength-a.strength);
  return results;
}

export function humanLagLabel(lag) {
  if (lag === 0) return "el mateix dia";
  if (lag > 0) return lag === 1 ? "l'endemà (+1 dia)" : `+${lag} dies després`;
  return lag === -1 ? "el dia abans" : `${Math.abs(lag)} dies abans`;
}

const DOW_NAMES = ["diumenge","dilluns","dimarts","dimecres","dijous","divendres","dissabte"];
export function computeDayOfWeekPatterns(matrix, { minN = 3 } = {}) {
  const keys = Object.keys(VARIABLE_META), results = [];
  for (const key of keys) {
    const meta = VARIABLE_META[key], byDow=[[],[],[],[],[],[],[]], all=[];
    for (const date of Object.keys(matrix)) {
      const val = matrix[date][key]; if (val === undefined) continue;
      const numeric = meta.type === "boolean" ? (val?1:0) : val;
      byDow[new Date(`${date}T00:00:00`).getDay()].push(numeric); all.push(numeric);
    }
    if (all.length < minN*3) continue;
    const overallMean=mean(all), overallStd=stdDev(all,overallMean)||0.5;
    byDow.forEach((vals,dow)=>{
      if (vals.length < minN) return;
      const groupMean=mean(vals), z=(groupMean-overallMean)/overallStd;
      if (Math.abs(z)<0.6) return;
      results.push({ key,label:meta.label,type:meta.type,dow,dowName:DOW_NAMES[dow],groupMean,overallMean,n:vals.length,strength:Math.abs(z),direction:groupMean>overallMean?"més alt":"més baix" });
    });
  }
  return results.sort((a,b)=>b.strength-a.strength);
}

export function computeTrends(matrix, { minN = 6 } = {}) {
  const dates=Object.keys(matrix).sort(); if (dates.length<minN*2) return [];
  const midDate=dates[Math.floor(dates.length/2)], results=[];
  for (const key of Object.keys(VARIABLE_META)) {
    const meta=VARIABLE_META[key], firstHalf=[],secondHalf=[];
    for (const date of dates) {
      const val=matrix[date][key]; if (val===undefined) continue;
      const numeric=meta.type==="boolean"?(val?1:0):val;
      (date<midDate?firstHalf:secondHalf).push(numeric);
    }
    if (firstHalf.length<minN||secondHalf.length<minN) continue;
    const m1=mean(firstHalf),m2=mean(secondHalf),pooled=stdDev([...firstHalf,...secondHalf],mean([...firstHalf,...secondHalf]))||0.5;
    const diff=m2-m1,strength=Math.abs(diff)/pooled; if(strength<0.4)continue;
    results.push({key,label:meta.label,type:meta.type,firstMean:m1,secondMean:m2,diff,strength,direction:diff>0?"a l'alça":"a la baixa",nFirst:firstHalf.length,nSecond:secondHalf.length});
  }
  return results.sort((a,b)=>b.strength-a.strength);
}
