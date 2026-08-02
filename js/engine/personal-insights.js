import { VARIABLE_META } from "./normalizer.js";

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
}
function dateISO(d){ return d.toISOString().slice(0,10); }
function addDays(date, amount){ const d=new Date(`${date}T00:00:00`); d.setDate(d.getDate()+amount); return dateISO(d); }
function values(matrix,key,dates=Object.keys(matrix)){ return dates.map(d=>matrix[d]?.[key]).filter(v=>v!==undefined&&v!==null); }
function rate(matrix,key,dates=Object.keys(matrix)){ return dates.length ? dates.filter(d=>matrix[d]?.[key]===true).length/dates.length : 0; }
function fmt(value, digits=1){ return value==null?"—":Number(value).toFixed(digits); }
function sentenceCase(value){ const s=String(value||""); return s ? s[0].toUpperCase()+s.slice(1) : s; }

export function calendarIconsForDay(day={}) {
  const icons=[];
  if (Number(day.dolor_intensitat_max)>0 || Number(day.dolor_general)>0) icons.push({icon:"●",label:"Dolor",tone:"pain"});
  if (day.mal_de_cap_ocorregut) icons.push({icon:"◆",label:"Mal de cap",tone:"head"});
  if (day.vertigen_ocorregut) icons.push({icon:"◌",label:"Vertigen",tone:"vertigo"});
  if (Number(day.digestiu_general)>0 || Number(day.digestiu_inflor)>0 || day.digestiu_diarrea || day.digestiu_urgencia) icons.push({icon:"≈",label:"Digestiu",tone:"digestive"});
  if (day.son_registrat) icons.push({icon:"☾",label:"Son",tone:"sleep"});
  if (day.exercici_fet) icons.push({icon:"↗",label:"Exercici",tone:"exercise"});
  if (day.cicle_regla) icons.push({icon:"●",label:"Regla",tone:"cycle"});
  else if (day.cicle_premenstrual || day.cicle_postmenstrual || day.cicle_ovulacio_finestra) icons.push({icon:"○",label:"Cicle",tone:"cycle"});
  if (day.pell_brot) icons.push({icon:"✦",label:"Pell",tone:"skin"});
  if (day.medicacio_presa) icons.push({icon:"＋",label:"Medicació",tone:"medication"});
  return icons.slice(0,6);
}

export function buildPersonalProfile(matrix, intel) {
  const dates=Object.keys(matrix).sort();
  const pain=intel?.pain?.profile;
  const sleep=mean(values(matrix,"son_qualitat"));
  const awakenings=mean(values(matrix,"son_despertars"));
  const energy=mean(values(matrix,"energia_fisica"));
  const bloating=mean(values(matrix,"digestiu_inflor"));
  const cyclePatterns=(intel?.cycle?.detected||[]).map(x=>x.text);
  const trigger=intel?.triggers?.[0];
  const protector=intel?.protectors?.[0];
  const best=[
    protector ? protector.text || null : null,
    energy!=null ? `Energia física habitual: ${fmt(energy)}/10.` : null,
  ].filter(Boolean);
  return {
    days: dates.length,
    pain: {
      count:pain?.count||0,
      average:pain?.avg??null,
      mainZone:pain?.topZone?.[0]||null,
      mainType:pain?.topType?.[0]||null,
      sleepAffected:pain?.sleepAffected||0,
    },
    sleep:{ quality:sleep, awakenings },
    digestion:{ bloating, diarrheaRate:rate(matrix,"digestiu_diarrea",dates) },
    energy,
    cyclePatterns,
    mainTrigger:trigger?.text||null,
    mainProtector:protector?.text||null,
    positives:best,
    confidence:intel?.dataQuality?.level||"insuficient",
  };
}

function phasePrediction(day) {
  const list=[];
  if(day?.cicle_premenstrual) list.push("fase premenstrual");
  if(day?.cicle_postmenstrual) list.push("fase postmenstrual");
  if(day?.cicle_ovulacio_finestra) list.push("finestra d’ovulació");
  if(day?.cicle_regla) list.push("menstruació");
  return list;
}

function estimateCycleDay(matrix, targetDate) {
  const bleeding = new Set(Object.keys(matrix).filter(date => matrix[date]?.cicle_regla === true));
  const starts = [...bleeding].sort().filter(date => !bleeding.has(addDays(date,-1)));
  if (starts.length < 2) return {};
  const lengths=[];
  for(let i=1;i<starts.length;i++) lengths.push(Math.round((new Date(`${starts[i]}T00:00:00`)-new Date(`${starts[i-1]}T00:00:00`))/86400000));
  const avg=Math.max(21,Math.min(40,Math.round(mean(lengths)||28)));
  let nextStart=starts.at(-1);
  while(nextStart < targetDate) nextStart=addDays(nextStart,avg);
  const delta=Math.round((new Date(`${nextStart}T00:00:00`)-new Date(`${targetDate}T00:00:00`))/86400000);
  const ovulation=addDays(nextStart,-14);
  const ovDelta=Math.abs(Math.round((new Date(`${targetDate}T00:00:00`)-new Date(`${ovulation}T00:00:00`))/86400000));
  return {
    cicle_premenstrual: delta>=1 && delta<=5,
    cicle_ovulacio_finestra: ovDelta<=3,
    cicle_regla: delta<=0 && delta>=-4,
    estimatedCycleLength:avg,
    nextPeriodStart:nextStart,
  };
}

export function buildPredictions(matrix, intel, targetDate=addDays(dateISO(new Date()),1)) {
  const target={...estimateCycleDay(matrix,targetDate),...(matrix[targetDate]||{})};
  const phases=phasePrediction(target);
  const predictions=[];
  const detected=intel?.cycle?.detected||[];
  for(const item of detected){
    const relevant=(item.id.includes("before_period")&&target.cicle_premenstrual) ||
      (item.id.includes("after_period")&&target.cicle_postmenstrual) ||
      (item.id.includes("ovulation")&&target.cicle_ovulacio_finestra);
    if(relevant) predictions.push({label:item.title, confidence:item.confidence, reason:item.text});
  }
  const patterns=(intel?.patterns||[]).filter(p=>p.lag===1 || p.lag===0).slice(0,3);
  for(const p of patterns){
    const predictorValue=target[p.predictorKey];
    if(predictorValue===true || Number(predictorValue)>=6){
      predictions.push({label:`Possible canvi en ${p.outcomeLabel.toLowerCase()}`,confidence:p.confidence?.label||"preliminar",reason:p.text});
    }
  }
  return {
    date:targetDate,
    phases,
    items:predictions.slice(0,4),
    enoughData:(intel?.period?.days||0)>=30,
    nextPeriodStart: target.nextPeriodStart || null,
    note:predictions.length ? "Estimació basada només en patrons repetits del teu historial." : "Encara no hi ha prou patrons aplicables a aquest dia.",
  };
}

function strongestForCategory(intel, category) {
  return (intel?.patterns||[]).find(p=>VARIABLE_META[p.outcomeKey]?.category===category || VARIABLE_META[p.predictorKey]?.category===category);
}

export function answerHealthQuestion(question, matrix, intel) {
  const q=String(question||"").trim().toLowerCase();
  const profile=buildPersonalProfile(matrix,intel);
  const dates=Object.keys(matrix).sort();
  if(!q) return {title:"Escriu una pregunta",text:"Pots preguntar quan tens més dolor, què ha canviat aquest mes, què coincideix amb la diarrea o com influeix el cicle.",evidence:[]};

  if(q.includes("esquena") || q.includes("dolor")){
    const pattern=strongestForCategory(intel,"Dolor");
    const evidence=[];
    if(profile.pain.mainZone) evidence.push(`Zona més repetida: ${profile.pain.mainZone}.`);
    if(profile.pain.average!=null) evidence.push(`Intensitat mitjana: ${fmt(profile.pain.average)}/10 en ${profile.pain.count} registres.`);
    if(pattern) evidence.push(pattern.text);
    return {title:"Què mostren les dades del dolor",text:evidence.length?"Aquest és el resum més consistent que puc extreure ara mateix.":"Encara no hi ha prou registres de dolor per respondre amb fiabilitat.",evidence};
  }
  if(q.includes("diarrea") || q.includes("digest" ) || q.includes("inflor")){
    const pattern=strongestForCategory(intel,"Digestiu");
    const evidence=[`Diarrea registrada en el ${(profile.digestion.diarrheaRate*100).toFixed(0)}% dels dies amb dades.`];
    if(profile.digestion.bloating!=null) evidence.push(`Inflor mitjana registrada: ${fmt(profile.digestion.bloating)}/10.`);
    if(pattern) evidence.push(pattern.text);
    return {title:"Patrons digestius",text:"He comparat els registres digestius amb son, dolor, exercici i cicle.",evidence};
  }
  if(q.includes("regla") || q.includes("cicle") || q.includes("ovul")){
    const evidence=profile.cyclePatterns.length?profile.cyclePatterns:[intel?.cycle?.summary].filter(Boolean);
    return {title:"Relació amb el cicle",text:profile.cyclePatterns.length?"Només mostro patrons que han superat els llindars mínims de dades.":"Encara no s’ha detectat cap relació consistent amb el cicle.",evidence};
  }
  if(q.includes("son") || q.includes("despert")){
    const pattern=strongestForCategory(intel,"Son");
    const evidence=[];
    if(profile.sleep.quality!=null)evidence.push(`Qualitat mitjana del son: ${fmt(profile.sleep.quality)}/10.`);
    if(profile.sleep.awakenings!=null)evidence.push(`Mitjana de despertars: ${fmt(profile.sleep.awakenings)}.`);
    if(pattern)evidence.push(pattern.text);
    return {title:"Son i símptomes",text:evidence.length?"Aquests són els resultats disponibles.":"Encara falten registres de son comparables.",evidence};
  }
  if(q.includes("setmana") || q.includes("mes") || q.includes("canvi")){
    const trends=(intel?.trends||[]).slice(0,5).map(t=>t.text||`${t.label||t.key}: tendència detectada.`);
    return {title:"Canvis recents",text:trends.length?"He comparat la primera i la segona meitat del període disponible.":"Encara no hi ha prou dies per comparar tendències.",evidence:trends};
  }
  if(q.includes("pitjor") || q.includes("malament")){
    const evidence=(intel?.triggers||[]).slice(0,5).map(x=>x.text).filter(Boolean);
    return {title:"Factors que coincideixen amb dies pitjors",text:evidence.length?"Són associacions observades, no causes demostrades.":"Encara no hi ha cap possible desencadenant amb prou evidència.",evidence};
  }
  if(q.includes("millor") || q.includes("protector")){
    const evidence=(intel?.protectors||[]).slice(0,5).map(x=>x.text).filter(Boolean);
    return {title:"Factors que coincideixen amb dies millors",text:evidence.length?"Aquests factors s’han associat amb valors més favorables.":"Encara no hi ha cap factor protector consistent.",evidence};
  }
  const evidence=(intel?.patterns||[]).slice(0,5).map(p=>p.text);
  return {title:"Resposta basada en el teu historial",text:evidence.length?"No he pogut associar la pregunta a un únic apartat; et mostro els patrons més forts disponibles.":"Encara no hi ha prou dades per respondre aquesta pregunta.",evidence};
}

export function medicalSummaryData(matrix,intel){
  const profile=buildPersonalProfile(matrix,intel);
  const predictions=buildPredictions(matrix,intel);
  return {profile,predictions,patterns:(intel?.patterns||[]).slice(0,4),flares:(intel?.flares||[]).slice(0,3)};
}
