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
  if (day.vertigen_ocorregut) icons.push({icon:"◌",label:"Vertigen / boira mental",tone:"vertigo"});
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
    energy!=null ? `Cansament físic habitual: ${fmt(energy)}/10.` : null,
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

function normalizeQuestion(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function relevantDatesForQuestion(q, allDates) {
  if (!allDates.length) return [];
  const last = allDates.at(-1);
  const end = new Date(`${last}T00:00:00`);
  let days = null;
  if (q.includes("avui")) days = 1;
  else if (q.includes("aquesta setmana") || q.includes("ultima setmana") || q.includes("darrers 7") || q.includes("ultims 7")) days = 7;
  else if (q.includes("aquest mes") || q.includes("ultim mes") || q.includes("darrers 30") || q.includes("ultims 30")) days = 30;
  else if (q.includes("tres mesos") || q.includes("90 dies")) days = 90;
  if (!days) return allDates;
  const min = new Date(end); min.setDate(min.getDate() - days + 1);
  return allDates.filter(date => new Date(`${date}T00:00:00`) >= min);
}

function metricSummary(matrix, key, dates) {
  const rows = dates.map(date => ({ date, value: Number(matrix[date]?.[key]) })).filter(row => Number.isFinite(row.value));
  if (!rows.length) return null;
  const avg = mean(rows.map(row => row.value));
  const max = Math.max(...rows.map(row => row.value));
  const maxDates = rows.filter(row => row.value === max).map(row => row.date).slice(-3);
  return { count: rows.length, avg, max, maxDates };
}

function booleanSummary(matrix, key, dates) {
  const active = dates.filter(date => matrix[date]?.[key] === true);
  return { count: active.length, total: dates.length, rate: dates.length ? active.length / dates.length : 0, dates: active.slice(-5) };
}

function phaseBreakdown(matrix, symptomKey, dates) {
  const phases = [
    ["Premenstrual", "cicle_premenstrual"],
    ["Postmenstrual", "cicle_postmenstrual"],
    ["Ovulació", "cicle_ovulacio_finestra"],
    ["Menstruació", "cicle_regla"],
  ];
  const rows = phases.map(([label, phaseKey]) => {
    const phaseDates = dates.filter(date => matrix[date]?.[phaseKey] === true);
    const symptomDates = phaseDates.filter(date => {
      const value = matrix[date]?.[symptomKey];
      return value === true || Number(value) > 0;
    });
    return { label, n: phaseDates.length, hits: symptomDates.length, rate: phaseDates.length ? symptomDates.length / phaseDates.length : 0 };
  }).filter(row => row.n >= 2).sort((a,b) => b.rate - a.rate);
  return rows;
}

function matchingPatterns(intel, keys) {
  const wanted = new Set(keys);
  return (intel?.patterns || [])
    .filter(p => wanted.has(p.outcomeKey) || wanted.has(p.predictorKey))
    .slice(0, 3)
    .map(p => p.text)
    .filter(Boolean);
}

function comparisonEvidence(matrix, key, dates) {
  if (dates.length < 8) return null;
  const half = Math.floor(dates.length / 2);
  const a = mean(values(matrix, key, dates.slice(0, half)));
  const b = mean(values(matrix, key, dates.slice(half)));
  if (a == null || b == null) return null;
  const diff = b - a;
  if (Math.abs(diff) < 0.25) return `S'ha mantingut estable (${fmt(a)} → ${fmt(b)}).`;
  return `${diff > 0 ? "Ha augmentat" : "Ha disminuït"} ${Math.abs(diff).toFixed(1)} punts (${fmt(a)} → ${fmt(b)}).`;
}

export function answerHealthQuestion(question, matrix, intel) {
  const q = normalizeQuestion(question);
  const allDates = Object.keys(matrix).sort();
  const dates = relevantDatesForQuestion(q, allDates);
  const scope = dates.length === allDates.length ? `tot l'historial (${dates.length} dies)` : `els ${dates.length} dies més recents amb dades`;
  if (!q) return { title: "Escriu una pregunta", text: "Pots preguntar per una zona, un símptoma, una fase del cicle o un període concret.", evidence: [] };
  if (!dates.length) return { title: "Sense dades", text: "Encara no hi ha dades registrades per respondre.", evidence: [] };

  const includes = (...words) => words.some(word => q.includes(word));
  let keys = [];
  let title = "Resposta basada en el teu historial";
  let evidence = [];

  if (includes("esquena", "lumbar", "dorsal", "cervical", "dolor")) {
    keys = includes("esquena", "lumbar", "dorsal", "cervical") ? ["dolor_esquena_intensitat", "dolor_intensitat_max", "dolor_rigidesa"] : ["dolor_general", "dolor_intensitat_max", "dolor_rigidesa"];
    title = includes("esquena", "lumbar", "dorsal", "cervical") ? "Anàlisi del mal d’esquena" : "Anàlisi del dolor";
    const metric = metricSummary(matrix, keys[0], dates) || metricSummary(matrix, "dolor_intensitat_max", dates);
    if (metric) {
      evidence.push(`Mitjana: ${fmt(metric.avg)}/10 en ${metric.count} dies o registres comparables.`);
      evidence.push(`Màxim: ${fmt(metric.max,0)}/10${metric.maxDates.length ? ` (${metric.maxDates.join(", ")})` : ""}.`);
    }
    const profile = intel?.pain?.profile;
    if (profile?.topZone?.[0]) evidence.push(`Zona més repetida: ${profile.topZone[0]}.`);
    if (profile?.topType?.[0]) evidence.push(`Tipus més repetit: ${profile.topType[0]}.`);
    const phases = phaseBreakdown(matrix, keys[0], dates);
    if (phases[0]?.hits >= 2) evidence.push(`Fase amb més coincidència: ${phases[0].label} (${phases[0].hits}/${phases[0].n} dies registrats).`);
    const trend = comparisonEvidence(matrix, keys[0], dates); if (trend) evidence.push(`Evolució: ${trend}`);
  } else if (includes("mal de cap", "migranya", "cefalea")) {
    keys = ["mal_de_cap_ocorregut", "mal_de_cap_intensitat"];
    title = "Anàlisi del mal de cap";
    const freq = booleanSummary(matrix, "mal_de_cap_ocorregut", dates);
    const metric = metricSummary(matrix, "mal_de_cap_intensitat", dates);
    evidence.push(`${freq.count} episodis en ${dates.length} dies analitzats.`);
    if (metric) evidence.push(`Intensitat mitjana ${fmt(metric.avg)}/10; màxima ${fmt(metric.max,0)}/10.`);
  } else if (includes("vertigen", "mareig", "boira", "se me’n va el cap", "se me'n va el cap", "sensació estranya")) {
    keys = ["vertigen_ocorregut", "vertigen_intensitat"];
    title = "Anàlisi dels vertígens i la boira mental";
    const freq = booleanSummary(matrix, "vertigen_ocorregut", dates);
    const metric = metricSummary(matrix, "vertigen_intensitat", dates);
    evidence.push(`${freq.count} episodis en ${dates.length} dies analitzats.`);
    if (metric) evidence.push(`Intensitat mitjana ${fmt(metric.avg)}/10; màxima ${fmt(metric.max,0)}/10.`);
  } else if (includes("diarrea", "digest", "inflor", "gasos", "bristol", "panxa")) {
    const key = includes("diarrea", "bristol") ? "digestiu_diarrea" : includes("inflor", "panxa") ? "digestiu_inflor" : includes("gasos") ? "digestiu_gasos" : "digestiu_general";
    keys = [key, "digestiu_diarrea", "digestiu_inflor", "digestiu_urgencia"];
    title = "Anàlisi digestiva";
    if (key === "digestiu_diarrea") {
      const freq = booleanSummary(matrix, key, dates);
      evidence.push(`${freq.count} dies amb diarrea en ${dates.length} dies analitzats.`);
    } else {
      const metric = metricSummary(matrix, key, dates);
      if (metric) evidence.push(`Mitjana ${fmt(metric.avg)}/10; màxim ${fmt(metric.max,0)}/10 en ${metric.count} registres.`);
    }
    const phases = phaseBreakdown(matrix, key, dates);
    if (phases[0]?.hits >= 2) evidence.push(`Fase amb més coincidència: ${phases[0].label} (${phases[0].hits}/${phases[0].n}).`);
  } else if (includes("son", "dorm", "despert", "llums")) {
    const key = includes("despert") ? "son_despertars" : includes("llums") ? "son_llums_dormida" : "son_qualitat";
    keys = [key, "son_qualitat", "son_despertars", "son_fatiga_mati"];
    title = "Anàlisi del son";
    if (key === "son_llums_dormida") {
      const freq = booleanSummary(matrix, key, dates);
      evidence.push(`${freq.count} nits amb llums enceses dormida en ${dates.length} dies analitzats.`);
    } else {
      const metric = metricSummary(matrix, key, dates);
      if (metric) evidence.push(`${VARIABLE_META[key]?.label || "Valor"}: mitjana ${fmt(metric.avg)}${key === "son_qualitat" ? "/10" : ""}; màxim ${fmt(metric.max,0)}.`);
    }
    const quality = metricSummary(matrix, "son_qualitat", dates); if (quality && key !== "son_qualitat") evidence.push(`Mal descans mitjà: ${fmt(quality.avg)}/10.`);
    const trend = comparisonEvidence(matrix, "son_qualitat", dates); if (trend) evidence.push(`Evolució del mal descans: ${trend}`);
  } else if (includes("pell", "eczema", "acne", "urtic", "picor")) {
    keys = ["pell_brot"];
    title = "Anàlisi de la pell";
    const freq = booleanSummary(matrix, "pell_brot", dates);
    evidence.push(`${freq.count} dies amb brot en ${dates.length} dies analitzats.`);
    const phases = phaseBreakdown(matrix, "pell_brot", dates);
    if (phases[0]?.hits >= 2) evidence.push(`Fase amb més brots: ${phases[0].label} (${phases[0].hits}/${phases[0].n}).`);
  } else if (includes("exercici", "gimnas", "caminar", "passos", "fisio")) {
    const key = includes("passos", "caminar") ? "exercici_passos" : "exercici_fet";
    keys = [key, "exercici_fet", "exercici_passos", "exercici_gimnas", "exercici_fisio"];
    title = "Anàlisi de l’activitat";
    if (key === "exercici_passos") {
      const metric = metricSummary(matrix, key, dates);
      if (metric) evidence.push(`Mitjana de ${Math.round(metric.avg).toLocaleString("ca-ES")} passos; màxim ${Math.round(metric.max).toLocaleString("ca-ES")}.`);
    }
    const freq = booleanSummary(matrix, "exercici_fet", dates);
    evidence.push(`Activitat registrada en ${freq.count} de ${dates.length} dies.`);
  } else if (includes("regla", "cicle", "ovul", "premenstrual", "postmenstrual")) {
    keys = ["cicle_regla", "cicle_premenstrual", "cicle_postmenstrual", "cicle_ovulacio_finestra"];
    title = "Anàlisi del cicle";
    evidence = (intel?.cycle?.detected || []).map(item => item.text).slice(0, 5);
    if (!evidence.length && intel?.cycle?.summary) evidence.push(intel.cycle.summary);
  } else if (includes("medic", "ibuprofen", "paracetamol")) {
    keys = ["medicacio_presa"];
    title = "Anàlisi de la medicació";
    const freq = booleanSummary(matrix, "medicacio_presa", dates);
    evidence.push(`Medicació registrada en ${freq.count} de ${dates.length} dies.`);
    const med = intel?.medication?.summary || intel?.medication?.text; if (med) evidence.push(med);
  } else if (includes("energia", "cans", "esgot")) {
    const key = includes("mental") ? "energia_mental" : "energia_fisica";
    keys = [key, "energia_esgotament"];
    title = "Anàlisi del cansament i la boira mental";
    const metric = metricSummary(matrix, key, dates);
    if (metric) evidence.push(`Mitjana ${fmt(metric.avg)}/10; mínims i màxims basats en ${metric.count} dies.`);
    const exhausted = booleanSummary(matrix, "energia_esgotament", dates); if (exhausted.count) evidence.push(`Esgotament registrat en ${exhausted.count} dies.`);
  } else if (includes("pitjor", "empitjora", "desencaden")) {
    title = "Factors que coincideixen amb dies pitjors";
    evidence = (intel?.triggers || []).slice(0, 5).map(x => x.text).filter(Boolean);
  } else if (includes("millor", "protector")) {
    title = "Factors que coincideixen amb dies millors";
    evidence = (intel?.protectors || []).slice(0, 5).map(x => x.text).filter(Boolean);
  } else if (includes("canvi", "evoluc", "setmana", "mes")) {
    title = "Canvis recents";
    evidence = (intel?.trends || []).slice(0, 5).map(t => t.text || `${t.label || t.key}: tendència detectada.`);
  }

  const patterns = matchingPatterns(intel, keys);
  patterns.forEach(text => { if (!evidence.includes(text)) evidence.push(text); });
  evidence = evidence.filter(Boolean).slice(0, 7);
  const text = evidence.length
    ? `He analitzat ${scope}. La resposta separa els valors observats dels patrons que compleixen els llindars mínims.`
    : `No hi ha prou dades específiques per respondre amb precisió sobre ${scope}. Prova d'indicar el símptoma, la zona o el període.`;
  return { title, text, evidence };
}

export function medicalSummaryData(matrix,intel){
  const profile=buildPersonalProfile(matrix,intel);
  const predictions=buildPredictions(matrix,intel);
  return {profile,predictions,patterns:(intel?.patterns||[]).slice(0,4),flares:(intel?.flares||[]).slice(0,3)};
}
