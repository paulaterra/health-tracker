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
  dolor_darrere_cap_intensitat:{ label: "Dolor darrere del cap", type: "numeric", category: "Dolor", valence: "negative" },
  dolor_rigidesa:           { label: "Rigidesa corporal", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_registrat:          { label: "Registre de dolor completat", type: "boolean", category: "Dolor" },
  dolor_regions_count:      { label: "Regions corporals amb dolor (dia)", type: "numeric", category: "Dolor", valence: "negative" },
  dolor_regio_cap_coll:     { label: "Dolor cap / coll / mandíbula", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_regio_tronc_superior:{ label: "Dolor dorsal / espatlles / tòrax", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_regio_lumbar_pelvis:{ label: "Dolor lumbar / pelvis / maluc", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_regio_membre_superior:{ label: "Dolor braços / mans", type: "boolean", category: "Dolor", valence: "negative" },
  dolor_regio_membre_inferior:{ label: "Dolor cames / peus", type: "boolean", category: "Dolor", valence: "negative" },
  mal_de_cap_ocorregut:     { label: "Mal de cap", type: "boolean", category: "Dolor", valence: "negative" },
  mal_de_cap_intensitat:    { label: "Mal de cap (intensitat)", type: "numeric", category: "Dolor", valence: "negative" },
  vertigen_ocorregut:       { label: "Vertígens i boira mental", type: "boolean", category: "Vertígens i boira mental", valence: "negative" },
  vertigen_intensitat:      { label: "Vertígens i boira mental (intensitat)", type: "numeric", category: "Vertígens i boira mental", valence: "negative" },

  digestiu_general:         { label: "Malestar digestiu general", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_inflor:          { label: "Inflor", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_dolorAbdominal:  { label: "Dolor abdominal", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_retortijons:     { label: "Retortijons", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_gasos:           { label: "Gasos", type: "numeric", category: "Digestiu", valence: "negative" },
  digestiu_urgencia:        { label: "Urgència al lavabo", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_bristol_anormal: { label: "Deposició anormal (Bristol 1-2 o 6-7)", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_diarrea:         { label: "Diarrea (Bristol 6-7)", type: "boolean", category: "Digestiu", valence: "negative" },
  digestiu_estrenyiment:     { label: "Femta dura / restrenyiment (Bristol 1-2)", type: "boolean", category: "Digestiu", valence: "negative" },
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
  energia_mental:           { label: "Boira mental (check-ins antics)", type: "numeric", category: "Vertígens i boira mental", valence: "negative" },
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
  cicle_fase_follicular:     { label: "Fase fol·licular", type: "boolean", category: "Cicle" },
  cicle_fase_lutea:          { label: "Fase lútia", type: "boolean", category: "Cicle" },
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

    // Agrupació anatòmica ampla per permetre que el motor detecti dolor multiregional
    // sense dependre dels noms exactes de cada zona del dibuix corporal.
    const regionFlags = {
      dolor_regio_cap_coll: labels.some(label => /cap|occipital|nuca|coll|cervical|mand[ií]bula|cara|templa/.test(label)),
      dolor_regio_tronc_superior: labels.some(label => /dorsal|esquena alta|om[oò]plat|esc[aà]pula|espatlla|t[oò]rax|pit|costella/.test(label)),
      dolor_regio_lumbar_pelvis: labels.some(label => /lumbar|sacre|sacro|pelvis|maluc|gluti|gl[uú]ti|ci[aà]tica/.test(label)),
      dolor_regio_membre_superior: labels.some(label => /bra[cç]|colze|avantbra[cç]|canell|(^|\s)(m[aà]|mans?)(\s|$)|dit.*m[aà]/.test(label)),
      dolor_regio_membre_inferior: labels.some(label => /cuixa|genoll|cama|panxell|turmell|peu|dit.*peu/.test(label)),
    };
    Object.entries(regionFlags).forEach(([key, present]) => { if (present) setBool(matrix, d, key); });
    // Recalcula sobre el dia complet perquè si hi ha diversos episodis de dolor el mateix dia
    // compti la unió de regions de tots els episodis, no només les d'un sol registre.
    const dayAfterRegions = ensureDay(matrix, d);
    const regionCount = Object.keys(regionFlags).filter(key => dayAfterRegions[key] === true).length;
    if (regionCount) setMax(matrix, d, "dolor_regions_count", regionCount);

    if (labels.some(label => /darrere.*cap|posterior.*cap|occipital|nuca/.test(label))) {
      setMax(matrix, d, "dolor_darrere_cap_intensitat", p.intensitat);
    }
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
    if (Number(b.bristol) <= 2) setBool(matrix, d, "digestiu_estrenyiment");
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
    const category = ex.categoria || ex.tipus;
    setBool(matrix, d, "exercici_fet");
    if (category === "gimnas_entrenador") setBool(matrix, d, "exercici_gimnas");
    if (category === "caminar") setBool(matrix, d, "exercici_caminar");
    if (category === "terapia") {
      const therapies = (ex.terapies || []).map(x => String(x).toLowerCase());
      if (therapies.some(x => x.includes("fisioter"))) setBool(matrix, d, "exercici_fisio");
      if (therapies.some(x => x.includes("activació neuromuscular") || x.includes("activacio neuromuscular"))) setBool(matrix, d, "exercici_activacio_neuromuscular");
    }
    if (ex.passos !== null && ex.passos !== undefined && ex.passos !== "" && Number.isFinite(Number(ex.passos))) {
      setValue(matrix, d, "exercici_passos", Number(ex.passos));
    }
  });

  // Cicle: menstruació + fases manuals i fases orientatives derivades.
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
    if (c.faseManual === "follicular") setBool(matrix, c.date, "cicle_fase_follicular");
    if (c.faseManual === "lutea") setBool(matrix, c.date, "cicle_fase_lutea");

    const legacyOvulation = (c.simptomes || []).some(x => String(x).toLowerCase().includes("ovul"));
    if (c.ovulacioEstimada || c.faseManual === "ovulacio" || legacyOvulation) {
      const date = c.ovulacioEstimada || c.date;
      explicitOvulation.push(date);
      setBool(matrix, date, "cicle_ovulacio_registrada");
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

  // Cicles tancats: si no hi ha ovulació manual, l'estimem a 14 dies de la menstruació següent.
  for (let i = 1; i < periodStarts.length; i++) {
    const cycleStart = periodStarts[i-1];
    const nextStart = periodStarts[i];
    let anchor = explicitOvulation.find(d => d >= cycleStart && d < nextStart);
    if (!anchor) {
      const estimated = new Date(nextStart + "T00:00:00");
      estimated.setDate(estimated.getDate() - 14);
      anchor = estimated.toISOString().slice(0,10);
      ovulationAnchors.add(anchor);
    }

    // Omplim fases orientatives només allà on no hi ha una marca manual incompatible.
    for (let d = new Date(cycleStart + "T00:00:00"); d < new Date(anchor + "T00:00:00"); d.setDate(d.getDate()+1)) {
      setBool(matrix, d.toISOString().slice(0,10), "cicle_fase_follicular");
    }
    for (let d = new Date(anchor + "T00:00:00"); d < new Date(nextStart + "T00:00:00"); d.setDate(d.getDate()+1)) {
      d.setDate(d.getDate()+1);
      if (d < new Date(nextStart + "T00:00:00")) setBool(matrix, d.toISOString().slice(0,10), "cicle_fase_lutea");
      d.setDate(d.getDate()-1);
    }
  }

  // Cicle obert: utilitzem ovulació manual si existeix; si no, estimació segons la durada mitjana.
  if (periodStarts.length) {
    const currentStart = periodStarts.at(-1);
    let currentOv = explicitOvulation.find(d => d >= currentStart) || null;
    if (!currentOv && periodStarts.length >= 2) {
      const lengths=[];
      for(let i=1;i<periodStarts.length;i++) lengths.push(Math.round((new Date(periodStarts[i]+"T00:00:00")-new Date(periodStarts[i-1]+"T00:00:00"))/86400000));
      const avg=Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length);
      const nextEstimated=new Date(currentStart+"T00:00:00");
      nextEstimated.setDate(nextEstimated.getDate()+avg);
      const estimatedOv=new Date(nextEstimated); estimatedOv.setDate(estimatedOv.getDate()-14);
      currentOv=estimatedOv.toISOString().slice(0,10);
      ovulationAnchors.add(currentOv);
    }
    if (currentOv) {
      const today = new Date(); today.setHours(0,0,0,0);
      const ovDate = new Date(currentOv+"T00:00:00");
      for(let d=new Date(currentStart+"T00:00:00"); d < ovDate && d <= today; d.setDate(d.getDate()+1)) setBool(matrix,d.toISOString().slice(0,10),"cicle_fase_follicular");
      for(let d=new Date(ovDate); d <= today; d.setDate(d.getDate()+1)) {
        if (d.toISOString().slice(0,10) > currentOv) setBool(matrix,d.toISOString().slice(0,10),"cicle_fase_lutea");
      }
    }
  }

  // Finestra periovulatòria interna (±3 dies): serveix per detectar patrons, no es mostra com a finestra fèrtil.
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
    // Pell es registra dia a dia: un registre només afecta la data indicada.
    setBool(matrix, sk.dataInici, "pell_brot");
  });

  // Filosofia de registre de Paula Tracker: en un dia amb alguna dada,
  // l’absència d’un registre de símptoma significa que aquell símptoma no hi era.
  // Les variables de context positiu (qualitat del son, energia...) continuen
  // sent desconegudes si no s’han registrat explícitament.
  Object.values(matrix).forEach(day => {
    const symptomDefaults = {
      dolor_registrat: false, dolor_general: 0, dolor_intensitat_max: 0, dolor_esquena_intensitat: 0, dolor_darrere_cap_intensitat: 0, dolor_rigidesa: false,
      mal_de_cap_ocorregut: false, mal_de_cap_intensitat: 0,
      vertigen_ocorregut: false, vertigen_intensitat: 0,
      digestiu_general: 0, digestiu_inflor: 0, digestiu_dolorAbdominal: 0, digestiu_retortijons: 0, digestiu_gasos: 0,
      digestiu_urgencia: false, digestiu_bristol_anormal: false, digestiu_diarrea: false, digestiu_llagues_boca: false,
      exercici_fet: false, exercici_gimnas: false, exercici_fisio: false, exercici_activacio_neuromuscular: false, exercici_caminar: false,
      cicle_regla: false, cicle_premenstrual: false, cicle_postmenstrual: false, cicle_ovulacio_finestra: false, cicle_ovulacio_registrada: false, cicle_fase_follicular: false, cicle_fase_lutea: false,
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
