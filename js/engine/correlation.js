import { VARIABLE_META } from "./normalizer.js";

const OBSERVATION_KEYS = new Set([
  "dolor_registrat", "digestiu_deposicio_registrada", "son_registrat",
]);
const CONTEXT_CATEGORIES = new Set(["Exercici", "Medicació", "Cicle"]);

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
function quantile(sorted,q){
  if(!sorted.length)return null;
  const pos=(sorted.length-1)*q,base=Math.floor(pos),rest=pos-base;
  return sorted[base+1]!==undefined?sorted[base]+rest*(sorted[base+1]-sorted[base]):sorted[base];
}
function minPerGroup(totalDays) {
  if (totalDays >= 90) return 12;
  if (totalDays >= 60) return 10;
  if (totalDays >= 30) return 7;
  return 5;
}
function allowedLags(totalDays) {
  if (totalDays < 21) return [0,1,2];
  if (totalDays < 45) return [0,1,2,3,7];
  if (totalDays < 75) return [0,1,2,3,7,14];
  return [0,1,2,3,7,14,21,30];
}
function numericThresholds(key, values) {
  if (key === "son_despertars") return { low:1, high:3, labelLow:"≤1", labelHigh:"≥3" };
  if (key === "exercici_passos") {
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    if(sorted.length<10)return null;
    const low=Math.round(quantile(sorted,0.33));
    const high=Math.round(quantile(sorted,0.67));
    if(high<=low)return null;
    return {low,high,labelLow:`≤${low}`,labelHigh:`≥${high}`};
  }
  return { low:3, high:6, labelLow:"≤3/10", labelHigh:"≥6/10" };
}
function splitGroups(pairs, predictorKey, predictorMeta) {
  const groupA=[],groupB=[];
  if(predictorMeta.type==="boolean") {
    pairs.forEach(([pVal,oVal]) => (pVal ? groupA : groupB).push(oVal));
    return {groupA,groupB,thresholds:null};
  }
  const thresholds=numericThresholds(predictorKey,pairs.map(p=>Number(p[0])));
  if(!thresholds)return {groupA,groupB,thresholds:null};
  pairs.forEach(([pVal,oVal])=>{
    const n=Number(pVal);
    if(n>=thresholds.high)groupA.push(oVal);
    else if(n<=thresholds.low)groupB.push(oVal);
  });
  return {groupA,groupB,thresholds};
}
function activeOutcome(meta,value){
  if(meta.type==="boolean")return Boolean(value);
  if(meta.valence==="negative")return Number(value)>=6;
  if(meta.valence==="positive")return Number(value)<=3;
  return false;
}
function effectSizeNumeric(groupA, groupB, outcomeMeta) {
  const mA=mean(groupA),mB=mean(groupB);
  const sA=stdDev(groupA,mA),sB=stdDev(groupB,mB);
  const pooled=Math.sqrt(((groupA.length-1)*sA*sA+(groupB.length-1)*sB*sB)/(groupA.length+groupB.length-2))||0.001;
  const rateA=groupA.filter(v=>activeOutcome(outcomeMeta,v)).length/groupA.length;
  const rateB=groupB.filter(v=>activeOutcome(outcomeMeta,v)).length/groupB.length;
  return {diff:mA-mB,meanA:mA,meanB:mB,cohend:(mA-mB)/pooled,rateA,rateB,relativeRisk:rateB>0?rateA/rateB:null};
}
function effectSizeBoolean(groupA, groupB) {
  const rateA=groupA.filter(Boolean).length/groupA.length;
  const rateB=groupB.filter(Boolean).length/groupB.length;
  return {diff:rateA-rateB,rateA,rateB,relativeRisk:rateB>0?rateA/rateB:null};
}
function effectFor(pairs,predictorKey,predictorMeta,outcomeMeta){
  const {groupA,groupB,thresholds}=splitGroups(pairs,predictorKey,predictorMeta);
  if(!groupA.length||!groupB.length)return null;
  const effect=outcomeMeta.type==="numeric"?effectSizeNumeric(groupA,groupB,outcomeMeta):effectSizeBoolean(groupA,groupB);
  const direction=effect.diff>0?1:effect.diff<0?-1:0;
  return {effect,direction,nA:groupA.length,nB:groupB.length,thresholds};
}
function stabilityFor(pairs,predictorKey,predictorMeta,outcomeMeta){
  if(pairs.length<24)return "desconeguda";
  const mid=Math.floor(pairs.length/2);
  const first=effectFor(pairs.slice(0,mid),predictorKey,predictorMeta,outcomeMeta);
  const second=effectFor(pairs.slice(mid),predictorKey,predictorMeta,outcomeMeta);
  if(!first||!second||first.nA<3||first.nB<3||second.nA<3||second.nB<3)return "desconeguda";
  return first.direction!==0&&first.direction===second.direction?"estable":"inestable";
}
function confidenceLabel({strength,nA,nB,totalDays,coverage,stability}){
  const minGroup=Math.min(nA,nB);
  let score=0;
  if(strength>=1.3)score+=3;else if(strength>=1.0)score+=2;else score+=1;
  if(minGroup>=15)score+=3;else if(minGroup>=10)score+=2;else if(minGroup>=7)score+=1;
  if(totalDays>=90)score+=3;else if(totalDays>=60)score+=2;else if(totalDays>=30)score+=1;
  if(coverage>=0.8)score+=2;else if(coverage>=0.65)score+=1;
  if(stability==="estable")score+=2;
  if(totalDays<21||minGroup<7)return {label:"observació",pct:25,score};
  if(score>=10&&totalDays>=60)return {label:"alta",pct:85,score};
  if(score>=7)return {label:"moderada",pct:65,score};
  return {label:"preliminar",pct:40,score};
}
function isSymptom(meta){return meta?.valence==="negative"||meta?.valence==="positive";}
function pairAllowed(predictorKey,outcomeKey,lag){
  if(OBSERVATION_KEYS.has(predictorKey)||OBSERVATION_KEYS.has(outcomeKey))return false;
  const p=VARIABLE_META[predictorKey],o=VARIABLE_META[outcomeKey];
  if(!p||!o)return false;
  // Cicle només s'analitza amb dates menstruals reals al motor específic.
  if(p.category==="Cicle"||o.category==="Cicle")return false;
  // Evita relacions internes redundants: dolor general ↔ dolor màxim, inflor ↔ gasos, etc.
  if(p.category===o.category&&isSymptom(p)&&isSymptom(o))return false;
  if(p.category===o.category&&CONTEXT_CATEGORIES.has(p.category))return false;
  // Símptoma→símptoma és descripció de seqüència, no desencadenant: només curt termini.
  if(lag>2&&isSymptom(p)&&isSymptom(o))return false;
  return true;
}

export function computeCorrelations(matrix){
  const dates=Object.keys(matrix).sort();
  const totalDays=dates.length;
  if(totalDays<14)return [];
  const minN=minPerGroup(totalDays),keys=Object.keys(VARIABLE_META),candidates=[];

  for(const predictorKey of keys){
    const predictorMeta=VARIABLE_META[predictorKey];
    for(const outcomeKey of keys){
      if(predictorKey===outcomeKey)continue;
      const outcomeMeta=VARIABLE_META[outcomeKey];
      for(const lag of allowedLags(totalDays)){
        if(!pairAllowed(predictorKey,outcomeKey,lag))continue;
        if(lag===0&&predictorKey.localeCompare(outcomeKey)>0)continue;
        const pairs=[];
        for(const d of dates){
          const pVal=matrix[d]?.[predictorKey];
          if(pVal===undefined)continue;
          const oVal=matrix[addDays(d,lag)]?.[outcomeKey];
          if(oVal===undefined)continue;
          pairs.push([pVal,oVal,d]);
        }
        const requiredCoverage=totalDays<30?0.70:0.60;
        if(pairs.length<Math.max(12,Math.ceil(totalDays*requiredCoverage)))continue;
        const base=effectFor(pairs,predictorKey,predictorMeta,outcomeMeta);
        if(!base||base.nA<minN||base.nB<minN)continue;

        let strength;
        if(outcomeMeta.type==="numeric"){
          strength=Math.abs(base.effect.cohend);
          if(strength<0.9||Math.abs(base.effect.diff)<0.9)continue;
          // A més de la mitjana, demanem una diferència apreciable d'episodis alts.
          if(Math.abs(base.effect.rateA-base.effect.rateB)<0.20)continue;
        }else{
          strength=Math.abs(base.effect.diff)*3;
          if(Math.abs(base.effect.diff)<0.35)continue;
        }
        const stability=stabilityFor(pairs,predictorKey,predictorMeta,outcomeMeta);
        if(stability==="inestable")continue;
        const coverage=pairs.length/totalDays;
        const confidence=confidenceLabel({strength,nA:base.nA,nB:base.nB,totalDays,coverage,stability});
        candidates.push({
          predictorKey,outcomeKey,lag,
          predictorLabel:predictorMeta.label,outcomeLabel:outcomeMeta.label,
          predictorType:predictorMeta.type,outcomeType:outcomeMeta.type,
          direction:base.effect.diff>0?"augmenta":"disminueix",
          effect:base.effect,strength,confidence,
          nA:base.nA,nB:base.nB,totalDays,coverage,stability,thresholds:base.thresholds,
          relationType:lag===0?"coincidencia":"sequencia",
        });
      }
    }
  }

  // Només una finestra per parella. Amb el mateix dia, una sola direcció ja està filtrada.
  const best=new Map();
  candidates.forEach(item=>{
    const key=`${item.predictorKey}|${item.outcomeKey}`;
    const prev=best.get(key);
    const rank=item.confidence.score*10+item.strength+item.coverage;
    const prevRank=prev?prev.confidence.score*10+prev.strength+prev.coverage:-Infinity;
    if(!prev||rank>prevRank)best.set(key,item);
  });
  return [...best.values()].sort((a,b)=>b.confidence.score-a.confidence.score||b.strength-a.strength||b.coverage-a.coverage).slice(0,30);
}

export function humanLagLabel(lag){
  if(lag===0)return "el mateix dia";
  if(lag===1)return "l'endemà";
  return `${lag} dies després`;
}

const DOW_NAMES=["diumenge","dilluns","dimarts","dimecres","dijous","divendres","dissabte"];
export function computeDayOfWeekPatterns(matrix,{minN=4}={}){
  const keys=Object.keys(VARIABLE_META),results=[];
  for(const key of keys){
    if(OBSERVATION_KEYS.has(key))continue;
    const meta=VARIABLE_META[key];
    // Amb poques setmanes, un "dimarts pitjor" és gairebé sempre soroll.
    const byDow=[[],[],[],[],[],[],[]],all=[];
    for(const date of Object.keys(matrix)){
      const val=matrix[date][key];if(val===undefined)continue;
      const numeric=meta.type==="boolean"?(val?1:0):val;
      byDow[new Date(`${date}T00:00:00`).getDay()].push(numeric);all.push(numeric);
    }
    if(all.length<42)continue;
    const overallMean=mean(all),overallStd=stdDev(all,overallMean)||0.5;
    byDow.forEach((vals,dow)=>{
      if(vals.length<Math.max(minN,5))return;
      const groupMean=mean(vals),z=(groupMean-overallMean)/overallStd;
      if(Math.abs(z)<1.0)return;
      results.push({key,label:meta.label,type:meta.type,dow,dowName:DOW_NAMES[dow],groupMean,overallMean,n:vals.length,strength:Math.abs(z),direction:groupMean>overallMean?"més alt":"més baix"});
    });
  }
  return results.sort((a,b)=>b.strength-a.strength).slice(0,6);
}

export function computeTrends(matrix,{minN=7}={}){
  const dates=Object.keys(matrix).sort();if(dates.length<35)return [];
  const midDate=dates[Math.floor(dates.length/2)],results=[];
  for(const key of Object.keys(VARIABLE_META)){
    if(OBSERVATION_KEYS.has(key))continue;
    const meta=VARIABLE_META[key],firstHalf=[],secondHalf=[];
    for(const date of dates){
      const val=matrix[date][key];if(val===undefined)continue;
      const numeric=meta.type==="boolean"?(val?1:0):val;
      (date<midDate?firstHalf:secondHalf).push(numeric);
    }
    if(firstHalf.length<minN||secondHalf.length<minN)continue;
    const m1=mean(firstHalf),m2=mean(secondHalf),pooled=stdDev([...firstHalf,...secondHalf],mean([...firstHalf,...secondHalf]))||0.5;
    const diff=m2-m1,strength=Math.abs(diff)/pooled;if(strength<0.8)continue;
    results.push({key,label:meta.label,type:meta.type,firstMean:m1,secondMean:m2,diff,strength,direction:diff>0?"a l'alça":"a la baixa",nFirst:firstHalf.length,nSecond:secondHalf.length});
  }
  return results.sort((a,b)=>b.strength-a.strength).slice(0,6);
}
