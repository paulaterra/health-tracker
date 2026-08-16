import { VARIABLE_META } from "./normalizer.js";

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function dayDiff(a,b){ return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`))/86400000); }
function periodStarts(matrix) {
  const bleeding = new Set(Object.keys(matrix).filter(date => matrix[date]?.cicle_regla === true));
  return [...bleeding].sort().filter(date => !bleeding.has(addDays(date,-1)));
}
function active(meta, value) {
  if (value === undefined || value === null) return false;
  if (meta.type === "boolean") return value === true;
  return Number(value) >= 6;
}
function confidenceLabel(cycles, hitRate) {
  if (cycles >= 3 && hitRate >= 0.75) return "alta";
  if (cycles >= 2 && hitRate >= 0.67) return "moderada";
  return "preliminar";
}
function statusLabel(cycles, rate){
  if(cycles >= 3 && rate >= 0.67) return "recurrent";
  if(cycles >= 2 && rate >= 0.67) return "emerging";
  return "initial";
}

const OVULATION_WINDOWS = [
  { id:"periovulatory", min:-2, max:3, label:"al voltant de l’ovulació", shortLabel:"Patró periovulatori", kind:"ovulation" },
  { id:"early_luteal", min:4, max:8, label:"als primers dies de la fase lútia", shortLabel:"Patró de fase lútia inicial", kind:"ovulation" },
  { id:"mid_luteal", min:9, max:12, label:"a la fase lútia mitjana", shortLabel:"Patró de fase lútia", kind:"ovulation" },
];
const PERIOD_WINDOWS = [
  { id:"perimenstrual", min:-5, max:2, label:"els 5 dies previs i primers dies de la regla", shortLabel:"Patró perimenstrual", kind:"period" },
  { id:"menstrual", min:0, max:4, label:"durant els primers dies de la regla", shortLabel:"Patró menstrual", kind:"period" },
];
const WINDOWS = [...OVULATION_WINDOWS, ...PERIOD_WINDOWS];

const EXCLUDED = new Set([
  "dolor_registrat", "digestiu_deposicio_registrada", "son_registrat",
  "cicle_regla", "cicle_premenstrual", "cicle_postmenstrual", "cicle_ovulacio_finestra", "cicle_ovulacio_registrada",
  "cicle_fase_follicular", "cicle_fase_lutea",
  "exercici_fet", "exercici_gimnas", "exercici_fisio", "exercici_activacio_neuromuscular", "exercici_caminar", "exercici_passos",
  "medicacio_presa",
]);

function hasRealObservation(day) {
  if (!day) return false;
  return Object.keys(day).some(key => !key.startsWith("cicle_"));
}
function windowCoverage(matrix, anchor, win) {
  let observed = 0;
  for (let offset=win.min; offset<=win.max; offset++) {
    if (hasRealObservation(matrix[addDays(anchor,offset)])) observed++;
  }
  return observed / (win.max-win.min+1);
}
function signalInWindow(matrix, anchor, key, meta, win){
  for(let offset=win.min; offset<=win.max; offset++){
    if(active(meta, matrix[addDays(anchor,offset)]?.[key])) return true;
  }
  return false;
}
function mean(values){ return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null; }

function ovulationAnchors(matrix, starts){
  const manual=[...new Set(Object.keys(matrix).filter(d=>matrix[d]?.cicle_ovulacio_registrada===true))].sort();
  const completed=starts.slice(0,-1);
  return completed.map((start,i)=>{
    const next=starts[i+1];
    const candidates=manual.filter(d=>d>=addDays(start,7) && d<next);
    if(candidates.length) return {cycleStart:start, anchor:candidates[0], source:"manual", sourceLabel:"ovulació introduïda manualment"};
    return {cycleStart:start, anchor:addDays(next,-14), source:"calendar", sourceLabel:"ovulació estimada per calendari"};
  });
}

function periodAnchors(starts){
  return starts.map(start=>({cycleStart:start,anchor:start,source:"period",sourceLabel:"menstruació registrada"}));
}

function eligibleAnchors(matrix, anchors, win){
  return anchors.filter(a=>windowCoverage(matrix,a.anchor,win)>=0.5);
}

function buildHypothesis(matrix,key,meta,win,anchors){
  const eligible=eligibleAnchors(matrix,anchors,win);
  if(!eligible.length) return null;
  const hits=eligible.filter(a=>signalInWindow(matrix,a.anchor,key,meta,win));
  const rate=hits.length/eligible.length;
  if(hits.length===0) return null;
  // 1 cicle = senyal inicial; a partir de 2 exigim una repetició clara.
  if(eligible.length>=2 && (hits.length<2 || rate<0.67)) return null;
  const status=statusLabel(eligible.length,rate);
  const sourceCounts={manual:0,calendar:0,period:0};
  eligible.forEach(a=>sourceCounts[a.source]=(sourceCounts[a.source]||0)+1);
  const sourceNote=win.kind==="ovulation"
    ? sourceCounts.manual===eligible.length
      ? "Ovulació situada amb dades manuals."
      : sourceCounts.manual>0
        ? `Ovulació situada amb dades manuals en ${sourceCounts.manual} cicle${sourceCounts.manual===1?"":"s"} i estimada per calendari en ${sourceCounts.calendar}.`
        : "Ovulació estimada per calendari (aprox. 14 dies abans de la menstruació següent)."
    : "Finestra situada a partir de menstruacions registrades.";
  return {
    id:`${key}_${win.id}`,
    key,
    title:`${win.shortLabel} · ${meta.label}`,
    status,
    confidence:confidenceLabel(eligible.length,rate),
    cyclesObserved:eligible.length,
    cyclesWithSignal:hits.length,
    rate,
    window:win.id,
    windowLabel:win.label,
    sourceNote,
    text: eligible.length===1
      ? `${meta.label} ha aparegut dins de ${win.label} en l’únic cicle comparable disponible. És un senyal inicial, no un patró repetit.`
      : `${meta.label} ha aparegut en ${hits.length} de ${eligible.length} cicles comparables dins de ${win.label} (${Math.round(rate*100)}%).`,
    trackingText:`Continua registrant ${meta.label.toLowerCase()}, la menstruació i, si en tens, dades d’ovulació per comprovar si aquesta finestra es manté.`,
  };
}

function multisystemDay(day={}){
  const domains=[
    Number(day.dolor_general)>=5 || Number(day.dolor_intensitat_max)>=5,
    Number(day.digestiu_general)>=4 || Number(day.digestiu_inflor)>=4 || day.digestiu_bristol_anormal,
    Number(day.son_qualitat)>=5 || Number(day.son_fatiga_mati)>=5,
    day.pell_brot===true,
    day.vertigen_ocorregut===true || day.mal_de_cap_ocorregut===true,
  ];
  return domains.filter(Boolean).length>=3;
}

function buildMultisystemCycleHypotheses(matrix, windows, ovAnchors, pAnchors){
  const out=[];
  for(const win of windows){
    const anchors=win.kind==="ovulation"?ovAnchors:pAnchors.slice(0,-1);
    const eligible=eligibleAnchors(matrix,anchors,win);
    if(!eligible.length) continue;
    const hits=eligible.filter(a=>{
      for(let o=win.min;o<=win.max;o++) if(multisystemDay(matrix[addDays(a.anchor,o)])) return true;
      return false;
    });
    const rate=hits.length/eligible.length;
    if(!hits.length) continue;
    if(eligible.length>=2 && (hits.length<2 || rate<0.67)) continue;
    const status=statusLabel(eligible.length,rate);
    out.push({
      id:`multisystem_${win.id}`,
      key:"multisystem",
      title:`${win.shortLabel} · brots multisímptoma`,
      status,
      confidence:confidenceLabel(eligible.length,rate),
      cyclesObserved:eligible.length,
      cyclesWithSignal:hits.length,
      rate,
      window:win.id,
      windowLabel:win.label,
      sourceNote:win.kind==="ovulation" ? "La posició respecte de l’ovulació pot ser estimada si no s’ha introduït manualment." : "Finestra situada respecte de la menstruació registrada.",
      text: eligible.length===1
        ? `S’ha observat un brot multisímptoma dins de ${win.label} en l’únic cicle comparable. Cal veure si es repeteix.`
        : `Els brots multisímptoma han coincidit amb ${win.label} en ${hits.length} de ${eligible.length} cicles comparables (${Math.round(rate*100)}%).`,
      trackingText:"Observa si els brots tornen a concentrar-se en la mateixa fase durant els pròxims cicles.",
    });
  }
  return out;
}

export function analyzeCyclePatterns(matrix) {
  const starts=periodStarts(matrix);
  if(!starts.length){
    return {cycleCount:0,periodStarts:[],hypotheses:[],detected:[],tracking:[],analysisAvailable:false,summary:"Encara no hi ha cap inici de menstruació registrat. No s'analitzen patrons respecte al cicle fins que hi hagi dades reals del cicle."};
  }

  const completedStarts=starts.slice(0,-1);
  const ovAnchors=ovulationAnchors(matrix,starts);
  const pAnchors=periodAnchors(starts);
  const hypotheses=[];

  for(const [key,meta] of Object.entries(VARIABLE_META)){
    if(EXCLUDED.has(key)||meta.valence!=="negative") continue;
    const totalSignalDays=Object.keys(matrix).filter(d=>active(meta,matrix[d]?.[key])).length;
    if(totalSignalDays<2) continue;
    for(const win of WINDOWS){
      const anchors=win.kind==="ovulation"?ovAnchors:pAnchors.slice(0,-1);
      const h=buildHypothesis(matrix,key,meta,win,anchors);
      if(h) hypotheses.push(h);
    }
  }
  hypotheses.push(...buildMultisystemCycleHypotheses(matrix,WINDOWS,ovAnchors,pAnchors));

  // Evita mostrar diverses finestres gairebé idèntiques del mateix símptoma: conserva la més forta.
  const bestByKey=new Map();
  hypotheses.forEach(h=>{
    const prev=bestByKey.get(h.key);
    const score=(h.cyclesWithSignal*10)+(h.rate*3)+(h.status==="recurrent"?5:h.status==="emerging"?2:0);
    const prevScore=prev?((prev.cyclesWithSignal*10)+(prev.rate*3)+(prev.status==="recurrent"?5:prev.status==="emerging"?2:0)):-1;
    if(score>prevScore) bestByKey.set(h.key,h);
  });
  const final=[...bestByKey.values()].sort((a,b)=>{
    const rank={recurrent:3,emerging:2,initial:1};
    return rank[b.status]-rank[a.status] || b.rate-a.rate || b.cyclesWithSignal-a.cyclesWithSignal;
  });
  const detected=final.filter(x=>x.status==="recurrent");
  const tracking=final.filter(x=>x.status!=="recurrent").slice(0,6);

  const avgCycle=completedStarts.length ? mean(completedStarts.map((s,i)=>dayDiff(s,starts[i+1]))) : null;
  return {
    cycleCount:starts.length,
    completedCycleCount:completedStarts.length,
    periodStarts:starts,
    averageCycleLength:avgCycle,
    ovulationAnchors:ovAnchors,
    hypotheses:final,
    detected,
    tracking,
    analysisAvailable:completedStarts.length>=1,
    summary: completedStarts.length===0
      ? "Hi ha una menstruació iniciada, però encara no hi ha cap cicle complet per comparar."
      : detected.length
        ? `S'han detectat ${detected.length} patrons recurrents relacionats temporalment amb una fase del cicle.`
        : tracking.some(x=>x.status==="emerging")
          ? "Hi ha senyals que s'han repetit en 2 cicles i convé seguir-los abans de considerar-los recurrents."
          : "Hi ha senyals inicials relacionats amb una fase del cicle, però encara calen més cicles per saber si es repeteixen.",
  };
}
