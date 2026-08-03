import { VARIABLE_META } from "./normalizer.js";

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function periodStarts(matrix) {
  const bleeding = new Set(Object.keys(matrix).filter(date => matrix[date]?.cicle_regla === true));
  return [...bleeding].sort().filter(date => {
    const previous = new Date(`${date}T00:00:00`);
    previous.setDate(previous.getDate() - 1);
    return !bleeding.has(previous.toISOString().slice(0, 10));
  });
}

function nearestCycleStart(date, starts) {
  let result = null;
  for (const start of starts) {
    if (start > date) break;
    result = start;
  }
  return result;
}

function confidenceLabel({ cycleCount, phaseN, controlN, effectStrength }) {
  if (cycleCount < 2 || phaseN < 4 || controlN < 7) return "dades insuficients";
  if (cycleCount >= 5 && phaseN >= 12 && effectStrength >= 0.35) return "alta";
  if (cycleCount >= 3 && phaseN >= 7 && effectStrength >= 0.2) return "moderada";
  return "preliminar";
}

function numericHypothesis(matrix, starts, config) {
  const phaseRows = [];
  const controlRows = [];
  for (const [date, day] of Object.entries(matrix)) {
    const value = Number(day[config.outcome]);
    if (!Number.isFinite(value)) continue;
    const row = { date, value, cycle: nearestCycleStart(date, starts) };
    if (day[config.phase] === true) phaseRows.push(row);
    else if (!day.cicle_regla) controlRows.push(row);
  }
  const phaseMean = mean(phaseRows.map(row => row.value));
  const controlMean = mean(controlRows.map(row => row.value));
  const diff = phaseMean != null && controlMean != null ? phaseMean - controlMean : null;
  const scale = config.scale || 10;
  const strength = diff == null ? 0 : Math.min(1, Math.abs(diff) / scale);
  const cyclesWithSignal = new Set(
    phaseRows.filter(row => config.signal ? config.signal(row.value) : row.value >= (config.threshold ?? 6)).map(row => row.cycle).filter(Boolean)
  ).size;
  const confidence = confidenceLabel({
    cycleCount: starts.length,
    phaseN: phaseRows.length,
    controlN: controlRows.length,
    effectStrength: strength,
  });
  return {
    id: config.id,
    title: config.title,
    phaseLabel: config.phaseLabel,
    outcomeLabel: VARIABLE_META[config.outcome]?.label || config.outcome,
    type: "numeric",
    phaseN: phaseRows.length,
    controlN: controlRows.length,
    phaseMean,
    controlMean,
    diff,
    cyclesObserved: starts.length,
    cyclesWithSignal,
    confidence,
    supported: diff != null && diff >= (config.minDiff ?? 0.8) && phaseRows.length >= 4 && controlRows.length >= 7,
    trackingText: config.trackingText,
  };
}

function booleanHypothesis(matrix, starts, config) {
  const phaseRows = [];
  const controlRows = [];
  for (const [date, day] of Object.entries(matrix)) {
    const hasObservation = day[config.outcome] !== undefined || day[config.observationKey || config.outcome] !== undefined;
    if (!hasObservation) continue;
    const value = day[config.outcome] === true;
    const row = { date, value, cycle: nearestCycleStart(date, starts) };
    if (day[config.phase] === true) phaseRows.push(row);
    else if (!day.cicle_regla) controlRows.push(row);
  }
  const phaseRate = phaseRows.length ? phaseRows.filter(row => row.value).length / phaseRows.length : null;
  const controlRate = controlRows.length ? controlRows.filter(row => row.value).length / controlRows.length : null;
  const diff = phaseRate != null && controlRate != null ? phaseRate - controlRate : null;
  const cyclesWithSignal = new Set(phaseRows.filter(row => row.value).map(row => row.cycle).filter(Boolean)).size;
  const confidence = confidenceLabel({
    cycleCount: starts.length,
    phaseN: phaseRows.length,
    controlN: controlRows.length,
    effectStrength: diff == null ? 0 : Math.abs(diff),
  });
  return {
    id: config.id,
    title: config.title,
    phaseLabel: config.phaseLabel,
    outcomeLabel: VARIABLE_META[config.outcome]?.label || config.outcome,
    type: "boolean",
    phaseN: phaseRows.length,
    controlN: controlRows.length,
    phaseRate,
    controlRate,
    diff,
    cyclesObserved: starts.length,
    cyclesWithSignal,
    confidence,
    supported: diff != null && diff >= (config.minDiff ?? 0.2) && phaseRows.length >= 4 && controlRows.length >= 7,
    trackingText: config.trackingText,
  };
}

function formatHypothesis(item) {
  if (item.confidence === "dades insuficients") {
    return {
      ...item,
      status: "tracking",
      text: `${item.title}: encara no hi ha prou dades comparables. ${item.trackingText}`,
    };
  }
  if (!item.supported) {
    return {
      ...item,
      status: "not_detected",
      text: `${item.title}: de moment no s'observa una diferència consistent (${item.phaseN} dies de fase comparats amb ${item.controlN} dies de control).`,
    };
  }
  if (item.type === "numeric") {
    return {
      ...item,
      status: "detected",
      text: `${item.title}: mitjana ${item.phaseMean.toFixed(1)} durant ${item.phaseLabel}, davant de ${item.controlMean.toFixed(1)} fora d'aquesta fase (+${item.diff.toFixed(1)}; ${item.cyclesWithSignal} de ${item.cyclesObserved} cicles amb senyal; confiança ${item.confidence}).`,
    };
  }
  return {
    ...item,
    status: "detected",
    text: `${item.title}: apareix en el ${(item.phaseRate * 100).toFixed(0)}% dels dies de ${item.phaseLabel}, davant del ${(item.controlRate * 100).toFixed(0)}% fora d'aquesta fase (${item.cyclesWithSignal} de ${item.cyclesObserved} cicles; confiança ${item.confidence}).`,
  };
}

export function analyzeCyclePatterns(matrix) {
  const starts = periodStarts(matrix);
  const definitions = [
    numericHypothesis(matrix, starts, {
      id: "back_after_period",
      title: "Mal d'esquena després de la regla",
      phase: "cicle_postmenstrual",
      phaseLabel: "els 5 dies posteriors a la regla",
      outcome: "dolor_esquena_intensitat",
      minDiff: 0.8,
      trackingText: "Registra el mapa del dolor i el cicle durant almenys 3 cicles.",
    }),
    booleanHypothesis(matrix, starts, {
      id: "stiffness_after_period",
      title: "Rigidesa després de la regla",
      phase: "cicle_postmenstrual",
      phaseLabel: "la fase postmenstrual",
      outcome: "dolor_rigidesa",
      observationKey: "dolor_registrat",
      minDiff: 0.2,
      trackingText: "Marca sempre el tipus «rigidesa» quan aparegui.",
    }),
    numericHypothesis(matrix, starts, {
      id: "bloating_before_period",
      title: "Inflor abdominal abans de la regla",
      phase: "cicle_premenstrual",
      phaseLabel: "els 5 dies previs a la regla",
      outcome: "digestiu_inflor",
      minDiff: 0.8,
      trackingText: "Registra la inflor també els dies en què és baixa o absent.",
    }),
    booleanHypothesis(matrix, starts, {
      id: "diarrhea_ovulation",
      title: "Diarrea durant la setmana d'ovulació",
      phase: "cicle_ovulacio_finestra",
      phaseLabel: "la finestra d'ovulació (±3 dies)",
      outcome: "digestiu_diarrea",
      observationKey: "digestiu_deposicio_registrada",
      minDiff: 0.2,
      trackingText: "Registra l'ovulació i totes les deposicions durant almenys 3 cicles.",
    }),
    booleanHypothesis(matrix, starts, {
      id: "exhaustion_before_period",
      title: "Esgotament abans de la regla",
      phase: "cicle_premenstrual",
      phaseLabel: "la fase premenstrual",
      outcome: "energia_esgotament",
      observationKey: "energia_fisica",
      minDiff: 0.2,
      trackingText: "Completa el cansament físic cada dia, encara que et trobis bé.",
    }),
    numericHypothesis(matrix, starts, {
      id: "awakenings_before_period",
      title: "Múltiples despertars abans de la regla",
      phase: "cicle_premenstrual",
      phaseLabel: "la fase premenstrual",
      outcome: "son_despertars",
      scale: 6,
      minDiff: 1,
      threshold: 3,
      trackingText: "Registra el nombre de despertars cada matí.",
    }),
    booleanHypothesis(matrix, starts, {
      id: "lights_before_period",
      title: "Encendre llums dormida abans de la regla",
      phase: "cicle_premenstrual",
      phaseLabel: "la fase premenstrual",
      outcome: "son_llums_dormida",
      observationKey: "son_registrat",
      minDiff: 0.15,
      trackingText: "Marca aquesta conducta al registre de son sempre que passi.",
    }),
  ];

  const hypotheses = definitions.map(formatHypothesis);
  const detected = hypotheses.filter(item => item.status === "detected");
  const tracking = hypotheses.filter(item => item.status === "tracking");
  return {
    cycleCount: starts.length,
    periodStarts: starts,
    hypotheses,
    detected,
    tracking,
    summary: detected.length
      ? `S'han detectat ${detected.length} possibles patrons relacionats amb les fases del cicle en ${starts.length} cicles registrats.`
      : starts.length < 2
        ? "Encara cal registrar almenys dos inicis de regla per començar a comparar fases del cicle."
        : "Encara no hi ha prou repeticions consistents per confirmar cap patró del cicle.",
  };
}
