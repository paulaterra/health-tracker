import { Repository } from "../db/repository.js";

const checkinRepo = new Repository("daily_checkin");
const painRepo = new Repository("pain_events");
const headacheRepo = new Repository("headache_events");
const vertigoRepo = new Repository("vertigo_events");
const digestiveRepo = new Repository("digestive_events");
const bowelRepo = new Repository("bowel_movements");
const sleepRepo = new Repository("sleep_log");
const exerciseRepo = new Repository("exercise_log");
const cycleRepo = new Repository("cycle_log");
const skinRepo = new Repository("skin_episodes");
const medicationRepo = new Repository("medications");

/**
 * Registre de variables estàndard que el motor de patrons pot creuar.
 * type: "boolean" (present/absent aquell dia) o "numeric" (escala 0-10 o similar).
 */
export const VARIABLE_META = {
  dolor_general:            { label: "Dolor general", type: "numeric", category: "Dolor", valence: "negative" },
  dolor_intensitat_max:     { label: "Dolor corporal (pic del dia)", type: "numeric", category: "Dolor", valence: "negative" },
  dolor_esquena_intensitat: { label: "Mal d’esquena", type: "numeric", category: "Dolor", valence: "negative" },
  dolor_rigidesa:           { label: "Rigidesa corporal", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_registrat:          { label: "Registre de dolor completat", type: "boolean", category: "Dolor" },
  mal_de_cap_ocorregut:     { label: "Mal de cap", type: "boolean", category: "Dolor", valence: "negative" },
  mal_de_cap_intensitat:    { label: "Mal de cap (intensitat)", type: "numeric", category: "Dolor", valence: "negative" },
  vertigen_ocorregut:       { label: "Vertígens", type: "boolean", category: "Dolor", valence: "negative" },
  vertigen_intensitat:      { label: "Vertígens (intensitat)", type: "numeric", category: "Dolor", valence: "negative" },

  digestiu_general:         { label: "Malestar digestiu general", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_inflor:          { label: "Inflor", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_dolorAbdominal:  { label: "Dolor abdominal", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_retortijons:     { label: "Retortijons", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_gasos:           { label: "Gasos", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_urgencia:        { label: "Urgència al lavabo", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_bristol_anormal: { label: "Deposició anormal (Bristol 1-2 o 6-7)", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_diarrea:         { label: "Diarrea (Bristol 6-7)", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_deposicio_registrada: { label: "Deposició registrada", type: "boolean", category: "Digestiu" },
  digestiu_llagues_boca:    { label: "Llagues a la boca", type: "boolean", category: "Digestiu", valence: "negative" },

  son_qualitat:             { label: "Mal descans", type: "numeric", category: "Son", valence: "negative" },
  son_despertars:           { label: "Nombre de despertars", type: "numeric", category: "Son", valence: "negative" },
  son_fatiga_mati:          { label: "Fatiga en llevar-se", type: "numeric", category: "Son", valence: "negative" },
  son_parasomnia:           { label: "Parasomnia (caminar, visions, crits...)", type: "boolean", category: "Son", valence: "negative" },
  son_llums_dormida:        { label: "Encendre llums dormida", type: "boolean", category: "Son", valence: "negative" },
  son_registrat:            { label: "Registre de son completat", type: "boolean", category: "Son" },
  son_mocs_matinals:        { label: "Mocs en llevar-me", type: "boolean", category: "Son", valence: "negative" },

  energia_fisica:           { label: "Cansament físic", type: "numeric", category: "Energia", valence: "negative" },
  energia_mental:           { label: "Boira mental", type: "numeric", category: "Energia", valence: "negative" },
  energia_esgotament:       { label: "Esgotament físic", type: "boolean", category: "Energia", valence: "negative" },

  exercici_fet:             { label: "Exercici (qualsevol tipus)", type: "boolean", category: "Exercici" },
  exercici_gimnas:          { label: "Gimnàs / entrenador", type: "boolean", category: "Exercici" },
  exercici_fisio:           { label: "Fisioteràpia", type: "boolean", category: "Exercici" },
  exercici_activacio_neuromuscular: { label: "Activació neuromuscular", type: "boolean", category: "Exercici" },
  exercici_caminar:         { label: "Caminar", type: "boolean", category: "Exercici" },
  exercici_passos:          { label: "Passos diaris", type: "numeric", category: "Exercici" },

  cicle_regla:              { label: "Regla / menstruació", type: "boolean", category: "Cicle" },
  cicle_premenstrual:       { label: "Fase premenstrual (1-5 dies abans)", type: "boolean", category: "Cicle" },
  cicle_postmenstrual:      { label: "Fase postmenstrual (1-5 dies després)", type: "boolean", category: "Cicle" },
  cicle_ovulacio_finestra:  { label: "Finestra d’ovulació (±3 dies)", type: "boolean", category: "Cicle" },
  cicle_ovulacio_registrada:{ label: "Ovulació registrada", type: "boolean", category: "Cicle" },
  medicacio_presa:          { label: "Medicació presa", type: "boolean", category: "Medicació" },
  pell_brot:                { label: "Brot de pell (èczema/picor/acne/urticària)", type: "boolean", category: "Pell", valence: "negative" },
};

function dateOnly(iso) {
  return (iso || "").slice(0, 10);
}

function ensureDay(matrix, date) {
  if (!matrix[date]) matrix[date] = {};
  return matrix[date];
}

/** Estableix un valor booleà a cert per a un dia (mai el torna a false un cop cert). */
function setBool(matrix, date, key) {
  const day = ensureDay(matrix, date);
  day[key] = true;
}

/** Estableix un valor numèric com el màxim observat aquell dia. */
function setMax(matrix, date, key, value) {
  if (value == null || Number.isNaN(value)) return;
  const day = ensureDay(matrix, date);
  day[key] = day[key] == null ? value : Math.max(day[key], value);
}

/** Estableix un valor numèric directe (un sol registre per dia esperat). */
function setValue(matrix, date, key, value) {
  if (value == null || Number.isNaN(value)) return;
  ensureDay(matrix, date)[key] = value;
}

/**
 * Construeix la taula diària {data: {variable: valor}} a partir de totes
 * les dades desades a IndexedDB. Aquesta és l'entrada del motor de correlacions.
 */
export async function buildDailyMatrix() {
  const [checkins, pains, headaches, vertigos, digestives, bowels, sleeps, exercises, cycles, skins, medications] =
    await Promise.all([
      checkinRepo.getAll(), painRepo.getAll(), headacheRepo.getAll(), vertigoRepo.getAll(),
      digestiveRepo.getAll(), bowelRepo.getAll(), sleepRepo.getAll(), exerciseRepo.getAll(),
      cycleRepo.getAll(), skinRepo.getAll(), medicationRepo.getAll(),
    ]);

  const matrix = {};

  checkins.forEach(c => {
    const d = c.date;
    setValue(matrix, d, "dolor_general", c.dolorGeneral);
    setValue(matrix, d, "digestiu_general", c.digestiuGeneral);
    setValue(matrix, d, "son_qualitat", c.sonQualitat);
    setValue(matrix, d, "energia_fisica", c.energiaFisica);
    setValue(matrix, d, "energia_mental", c.energiaMental);
    if (Number(c.energiaFisica) >= 7) setBool(matrix, d, "energia_esgotament");
    if (c.malDeCap) setBool(matrix, d, "mal_de_cap_ocorregut");
  });

  pains.forEach(p => {
    const d = dateOnly(p.timestamp);
    setBool(matrix, d, "dolor_registrat");
    setMax(matrix, d, "dolor_intensitat_max", p.intensitat);
    const entries = p.entries || [];
    const labels = entries.flatMap(entry => entry.zonaLabels || [entry.zoneLabel, entry.zone]).filter(Boolean).map(value => String(value).toLowerCase());
    const painTypes = [
      ...(p.tipusDolor || []),
      ...entries.flatMap(entry => entry.tipus || []),
      ...(p.painDrawing || []).map(stroke => stroke.type),
    ].map(value => String(value).toLowerCase());
    if (labels.some(label => /esquena|dorsal|lumbar|cervical|columna|omòplat/.test(label))) {
      setMax(matrix, d, "dolor_esquena_intensitat", p.intensitat);
    }
    if (painTypes.some(type => type.includes("rigides"))) setBool(matrix, d, "dolor_rigidesa");
  });

  headaches.forEach(h => {
    const d = dateOnly(h.timestamp);
    setBool(matrix, d, "mal_de_cap_ocorregut");
    setMax(matrix, d, "mal_de_cap_intensitat", h.intensitat);
  });

  vertigos.forEach(v => {
    const d = dateOnly(v.timestamp);
    setBool(matrix, d, "vertigen_ocorregut");
    setMax(matrix, d, "vertigen_intensitat", v.intensitat);
  });

  digestives.forEach(e => {
    const d = dateOnly(e.timestamp);
    setMax(matrix, d, "digestiu_inflor", e.inflor);
    setMax(matrix, d, "digestiu_dolorAbdominal", e.dolorAbdominal);
    setMax(matrix, d, "digestiu_retortijons", e.retortijons);
    setMax(matrix, d, "digestiu_gasos", e.gasos);
    if (e.llaguesBoca) setBool(matrix, d, "digestiu_llagues_boca");
  });

  bowels.forEach(b => {
    const d = dateOnly(b.timestamp);
    setBool(matrix, d, "digestiu_deposicio_registrada");
    if (b.urgencia) setBool(matrix, d, "digestiu_urgencia");
    if (b.bristol <= 2 || b.bristol >= 6) setBool(matrix, d, "digestiu_bristol_anormal");
    if (Number(b.bristol) >= 6) setBool(matrix, d, "digestiu_diarrea");
  });

  sleeps.forEach(s => {
    const d = s.date;
    setBool(matrix, d, "son_registrat");
    setValue(matrix, d, "son_qualitat", s.qualitat);
    setValue(matrix, d, "son_despertars", s.numDespertars);
    setValue(matrix, d, "son_fatiga_mati", s.fatigaMati);
    if (s.encendreLlumsDormida) setBool(matrix, d, "son_llums_dormida");
    if (Number(s.fatigaMati) >= 7) setBool(matrix, d, "energia_esgotament");
    if (s.caminarDormida || s.encendreLlumsDormida || s.visions || s.crits) {
      setBool(matrix, d, "son_parasomnia");
    }
    if (s.mocsMati?.length) setBool(matrix, d, "son_mocs_matinals");
  });

  exercises.forEach(ex => {
    const d = dateOnly(ex.timestamp);
    setBool(matrix, d, "exercici_fet");
    if (ex.tipus === "gimnas_entrenador") setBool(matrix, d, "exercici_gimnas");
    if (ex.tipus === "fisio") setBool(matrix, d, "exercici_fisio");
    if (ex.tipus === "activacio_neuromuscular") setBool(matrix, d, "exercici_activacio_neuromuscular");
    if (ex.tipus === "caminar") setBool(matrix, d, "exercici_caminar");
  });

  // Cicle: regla, fase premenstrual, postmenstrual i finestra d'ovulació.
  const bleedingDates = new Set(cycles.filter(c => c.sagnat).map(c => c.date));
  const sortedBleeding = [...bleedingDates].sort();
  const periodStarts = sortedBleeding.filter(date => {
    const prev = new Date(date + "T00:00:00");
    prev.setDate(prev.getDate() - 1);
    return !bleedingDates.has(prev.toISOString().slice(0, 10));
  });
  const periodEnds = sortedBleeding.filter(date => {
    const next = new Date(date + "T00:00:00");
    next.setDate(next.getDate() + 1);
    return !bleedingDates.has(next.toISOString().slice(0, 10));
  });
  const explicitOvulation = [];
  cycles.forEach(c => {
    if (c.sagnat) setBool(matrix, c.date, "cicle_regla");
    if ((c.simptomes || []).some(x => String(x).toLowerCase().includes("ovul"))) {
      explicitOvulation.push(c.date);
      setBool(matrix, c.date, "cicle_ovulacio_registrada");
    }
  });
  periodStarts.forEach(start => {
    for (let offset = 1; offset <= 5; offset++) {
      const d = new Date(start + "T00:00:00");
      d.setDate(d.getDate() - offset);
      setBool(matrix, d.toISOString().slice(0, 10), "cicle_premenstrual");
    }
  });
  periodEnds.forEach(endDate => {
    for (let offset = 1; offset <= 5; offset++) {
      const d = new Date(endDate + "T00:00:00");
      d.setDate(d.getDate() + offset);
      setBool(matrix, d.toISOString().slice(0, 10), "cicle_postmenstrual");
    }
  });
  const ovulationAnchors = new Set(explicitOvulation);
  // Si no s'ha registrat l'ovulació, l'estima a 14 dies de l'inici de la regla següent.
  for (let i = 1; i < periodStarts.length; i++) {
    const estimated = new Date(periodStarts[i] + "T00:00:00");
    estimated.setDate(estimated.getDate() - 14);
    ovulationAnchors.add(estimated.toISOString().slice(0, 10));
  }
  ovulationAnchors.forEach(anchor => {
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(anchor + "T00:00:00");
      d.setDate(d.getDate() + offset);
      setBool(matrix, d.toISOString().slice(0, 10), "cicle_ovulacio_finestra");
    }
  });

  medications.forEach(m => {
    setBool(matrix, dateOnly(m.timestamp), "medicacio_presa");
  });

  skins.forEach(sk => {
    if (!sk.dataInici) return;
    const start = new Date(sk.dataInici + "T00:00:00");
    const end = sk.dataFi ? new Date(sk.dataFi + "T00:00:00") : new Date();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      setBool(matrix, d.toISOString().slice(0, 10), "pell_brot");
    }
  });

  // Filosofia de registre de Paula Tracker: en un dia amb alguna dada,
  // l’absència d’un registre de símptoma significa que aquell símptoma no hi era.
  // Les variables de context positiu (qualitat del son, energia...) continuen
  // sent desconegudes si no s’han registrat explícitament.
  Object.values(matrix).forEach(day => {
    const symptomDefaults = {
      dolor_registrat: false, dolor_general: 0, dolor_intensitat_max: 0, dolor_esquena_intensitat: 0, dolor_rigidesa: false,
      mal_de_cap_ocorregut: false, mal_de_cap_intensitat: 0,
      vertigen_ocorregut: false, vertigen_intensitat: 0,
      digestiu_general: 0, digestiu_inflor: 0, digestiu_dolorAbdominal: 0, digestiu_retortijons: 0, digestiu_gasos: 0,
      digestiu_urgencia: false, digestiu_bristol_anormal: false, digestiu_diarrea: false, digestiu_llagues_boca: false,
      exercici_fet: false, exercici_gimnas: false, exercici_fisio: false, exercici_activacio_neuromuscular: false, exercici_caminar: false,
      cicle_regla: false, cicle_premenstrual: false, cicle_postmenstrual: false, cicle_ovulacio_finestra: false, cicle_ovulacio_registrada: false,
      medicacio_presa: false, pell_brot: false, energia_esgotament: false,
    };
    Object.entries(symptomDefaults).forEach(([key,value]) => { if (day[key] === undefined) day[key] = value; });
    if (day.son_registrat) {
      if (day.son_parasomnia === undefined) day.son_parasomnia = false;
      if (day.son_llums_dormida === undefined) day.son_llums_dormida = false;
      if (day.son_mocs_matinals === undefined) day.son_mocs_matinals = false;
    }
  });

  return matrix;
}
