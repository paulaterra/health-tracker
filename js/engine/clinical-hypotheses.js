import { analyzeCyclePatterns } from "./cycle-analysis.js";
import { Repository } from "../db/repository.js";
import { escapeHtml } from "../utils/dom.js";
import { isViewerMode } from "../view-mode.js";

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function pct(count,total){ return total ? Math.round(count/total*100) : 0; }
function count(days, fn){ return days.filter(fn).length; }
function overlap(days, a, b){
  const base=days.filter(a); return {base:base.length, both:base.filter(b).length};
}
function recurring(value, min=2){ return value>=min; }

/**
 * Motor d'hipòtesis V6.
 * IMPORTANT: no diagnostica. Només reconeix combinacions de símptomes que poden
 * justificar una conversa clínica i explica les dades que han activat la hipòtesi.
 * Una hipòtesi mai es genera a partir d'un únic símptoma aïllat.
 */

function domainsForDay(d={}){
  return {
    pain:n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5||d.dolor_rigidesa,
    digestive:n(d.digestiu_general)>=4||n(d.digestiu_inflor)>=4||n(d.digestiu_dolorAbdominal)>=4||d.digestiu_bristol_anormal||d.digestiu_diarrea||d.digestiu_estrenyiment,
    sleep:n(d.son_qualitat)>=5||n(d.son_fatiga_mati)>=5||d.energia_esgotament,
    skin:d.pell_brot===true,
    neuro:d.vertigen_ocorregut===true||d.mal_de_cap_ocorregut===true||n(d.vertigen_intensitat)>=4||n(d.mal_de_cap_intensitat)>=4,
  };
}
function sameDay(days, predicates){ return count(days,d=>predicates.every(fn=>fn(d))); }
function possibility(id,title,why,limit,extra={}){
  const compatibilityScore=Math.max(0,Math.min(100,n(extra.compatibilityScore)||50));
  const compatibilityLevel=extra.compatibilityLevel || (compatibilityScore>=70?'alta':compatibilityScore>=45?'moderada':'baixa / inicial');
  return {id,title,why,limit,...extra,compatibilityScore,compatibilityLevel};
}
function rankedPossibilities(items=[]){ return [...items].sort((a,b)=>(b.compatibilityScore||0)-(a.compatibilityScore||0)); }
function compatibilityColor(p={}){ return (p.compatibilityScore||0)>=70?'#2f855a':(p.compatibilityScore||0)>=45?'#b7791f':'#c53030'; }
function compatibilityScaleHtml(p={}){
  const color=compatibilityColor(p);
  const level=p.compatibilityLevel||'baixa / inicial';
  return `<div style="display:flex;align-items:center;gap:8px;margin:0 0 8px;"><span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:${color};white-space:nowrap;"><span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>Compatibilitat ${level}</span><span style="display:grid;grid-template-columns:repeat(3,18px);gap:3px;"><i style="height:5px;border-radius:99px;background:#c53030;opacity:${(p.compatibilityScore||0)<45?1:.16};"></i><i style="height:5px;border-radius:99px;background:#b7791f;opacity:${(p.compatibilityScore||0)>=45&&(p.compatibilityScore||0)<70?1:.16};"></i><i style="height:5px;border-radius:99px;background:#2f855a;opacity:${(p.compatibilityScore||0)>=70?1:.16};"></i></span></div>`;
}

function painMechanismAssessment(days){
  const painDays=days.filter(d=>n(d.dolor_general)>=3||n(d.dolor_intensitat_max)>=3||d.dolor_rigidesa);
  const significant=days.filter(d=>n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5);
  const multiRegion=days.filter(d=>n(d.dolor_regions_count)>=2);
  const regionKeys=['dolor_regio_cap_coll','dolor_regio_tronc_superior','dolor_regio_lumbar_pelvis','dolor_regio_membre_superior','dolor_regio_membre_inferior'];
  const distinctRegions=regionKeys.filter(k=>days.some(d=>d[k]===true)).length;
  const sleepOverlap=sameDay(days,[d=>n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5,d=>n(d.son_qualitat)>=5||n(d.son_fatiga_mati)>=5||d.energia_esgotament===true]);
  const fatigueDays=count(days,d=>n(d.son_fatiga_mati)>=5||n(d.energia_fisica)>=5||d.energia_esgotament===true);
  const rigidDays=count(days,d=>d.dolor_rigidesa===true);
  const neuroOverlap=sameDay(days,[d=>n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5,d=>d.mal_de_cap_ocorregut===true||d.vertigen_ocorregut===true]);

  // Puntuació de fenotip, no diagnòstica. Dona pes a recurrència, distribució i amplificadors,
  // i no necessita que l'usuari hagi introduït prèviament el nom d'una malaltia.
  let score=0;
  if(significant.length>=5) score+=2; else if(significant.length>=3) score+=1;
  if(painDays.length>=8) score+=1;
  if(distinctRegions>=3) score+=2; else if(distinctRegions>=2) score+=1;
  if(multiRegion.length>=3) score+=1;
  if(sleepOverlap>=4) score+=2; else if(sleepOverlap>=2) score+=1;
  if(fatigueDays>=4) score+=1;
  if(rigidDays>=3) score+=1;
  if(neuroOverlap>=3) score+=1;

  const level=score>=8?'moderada-alta':score>=5?'moderada':score>=3?'inicial':null;
  return {painDays,significant,multiRegion,distinctRegions,sleepOverlap,fatigueDays,rigidDays,neuroOverlap,score,level};
}

function painPhenotypePossibilities(days, assessment){
  const a=assessment||painMechanismAssessment(days);
  const out=[];
  if(a.level){
    const support=[];
    if(a.significant.length) support.push(`${a.significant.length} dies amb dolor rellevant`);
    if(a.distinctRegions>=2) support.push(`dolor registrat en ${a.distinctRegions} regions corporals àmplies`);
    if(a.sleepOverlap>=2) support.push(`${a.sleepOverlap} dies en què dolor rellevant coincideix amb mal descans o fatiga`);
    if(a.rigidDays>=3) support.push(`${a.rigidDays} dies amb rigidesa`);
    out.push(possibility(
      'central-sensitization-phenotype',
      'Dolor nociplàstic / sensibilització central',
      `El motor detecta una combinació de recurrència, distribució del dolor i possibles factors amplificadors${support.length?`: ${support.join('; ')}.`:'.'}`,
      `Això descriu un fenotip compatible, no el mecanisme confirmat del dolor. L’app no coneix per si sola l’exploració física, les proves d’imatge, analítiques ni altres causes que un professional ha de valorar.`,
      {clinicalSummary:'Possible fenotip de dolor nociplàstic/sensibilització central. Valorar fibromiàlgia segons evolució, distribució del dolor i criteris clínics.', compatibilityScore:Math.min(90,45+a.score*5)}
    ));
  }
  if(a.score>=5){
    out.push(possibility(
      'fibromyalgia-context',
      'Fibromiàlgia · possible, però no demostrada pels registres',
      `La persistència del dolor, la distribució multiregional i la coincidència amb son/fatiga poden aparèixer en fibromiàlgia, però l’app només en pot detectar compatibilitat longitudinal.`,
      `Per valorar fibromiàlgia cal durada suficient, distribució del dolor, càrrega simptomàtica, exploració clínica i exclusió raonable d’altres explicacions. Uns dies o setmanes de registre no permeten establir el diagnòstic.`,
      {compatibilityScore:Math.min(72,35+a.score*4)}
    ));
  }
  if(a.rigidDays>=3 || a.distinctRegions>=2){
    out.push(possibility(
      'myofascial-musculoskeletal-context',
      'Component musculoesquelètic / miofascial concomitant · plausible',
      `La recurrència en diverses zones i${a.rigidDays?` ${a.rigidDays} dies amb rigidesa`: ' el patró regional'} també és compatible amb un component muscular o miofascial que pot coexistir amb altres mecanismes de dolor.`,
      `Un autoregistre no pot distingir dolor muscular, articular, neuropàtic o referit ni substituir l’exploració musculoesquelètica.`,
      {compatibilityScore:Math.min(76,42+a.distinctRegions*7+a.rigidDays*2)}
    ));
  }
  if(a.sleepOverlap>=2){
    out.push(possibility(
      'sleep-pain-amplifier',
      'Alteració del son com a possible amplificador del dolor · rellevant',
      `Dolor rellevant i mal descans/fatiga coincideixen en ${a.sleepOverlap} dies. El motor ho interpreta com una relació que convé seguir, inclosa la possibilitat que el son actuï com a amplificador o conseqüència del dolor.`,
      `La coincidència no estableix direcció causal. Cal observar si el mal son precedeix, acompanya o segueix els dies de més dolor.`,
      {compatibilityScore:Math.min(80,40+a.sleepOverlap*7)}
    ));
  }
  return rankedPossibilities(out).slice(0,5);
}
function multisystemPossibilities(days, cycleAnalysis){
  const out=[];
  const vestibularHead=sameDay(days,[d=>d.vertigen_ocorregut||n(d.vertigen_intensitat)>=4,d=>d.mal_de_cap_ocorregut||n(d.mal_de_cap_intensitat)>=4]);
  if(vestibularHead>=2) out.push(possibility('migraine-vestibular','Migranya vestibular / perfil migranyós',`Vertigen/boira mental i cefalea han coincidit en ${vestibularHead} dies.`,`Aquesta coincidència no permet diferenciar migranya vestibular d’altres causes neurològiques o vestibulars.`,{compatibilityScore:Math.min(82,42+vestibularHead*8)}));

  const cycleMulti=(cycleAnalysis?.hypotheses||[]).find(h=>h.key==='multisystem');
  if(cycleMulti) out.push(possibility('cycle-modulation','Trastorns relacionats amb el cicle hormonal / migranya relacionada amb el cicle',cycleMulti.text,`${cycleMulti.sourceNote} La coincidència temporal no demostra una causa hormonal.`));

  const inflammatory=sameDay(days,[d=>d.dolor_rigidesa===true,d=>d.pell_brot===true||d.digestiu_llagues_boca===true||d.digestiu_diarrea===true]);
  if(inflammatory>=2) out.push(possibility('inflammatory-autoimmune','Malalties inflamatòries o autoimmunes (p. ex. lupus, Sjögren, artritis inflamatòria, celiaquia o MII)',`Rigidesa corporal ha coincidit amb pell, llagues a la boca o diarrea en ${inflammatory} dies.`,`Són signes molt inespecífics. Els noms indicats són exemples de diagnòstics diferencials que un professional podria valorar segons la resta de la clínica; l’app no pot suggerir-ne cap en concret ni aplicar-ne els criteris diagnòstics.`,{compatibilityScore:Math.min(72,38+inflammatory*7)}));

  const thyroidLike=sameDay(days,[d=>n(d.son_fatiga_mati)>=6||d.energia_esgotament===true,d=>d.digestiu_estrenyiment===true||d.digestiu_diarrea===true,d=>d.pell_brot===true]);
  if(thyroidLike>=3) out.push(possibility('endocrine-thyroid','Alteracions tiroïdals (hipotiroïdisme / hipertiroïdisme) i dèficits metabòlics',`Fatiga, alteració intestinal i símptomes de pell han coincidit en ${thyroidLike} dies.`,`Aquest perfil és inespecífic i només una valoració clínica i analítica pot orientar si té sentit estudiar tiroide, ferro, B12, vitamina D o altres causes metabòliques.`,{compatibilityScore:Math.min(68,34+thyroidLike*6)}));

  // Els mecanismes de dolor es valoren en una hipòtesi pròpia, no només dins dels brots multisímptoma.

  const mastCell=sameDay(days,[d=>d.pell_brot===true,d=>d.digestiu_diarrea===true||d.digestiu_urgencia===true||n(d.digestiu_dolorAbdominal)>=4,d=>d.mal_de_cap_ocorregut===true||d.vertigen_ocorregut===true]);
  if(mastCell>=2) out.push(possibility('mast-cell','Síndrome d’activació mastocitària (MCAS) / mecanismes mastocitaris',`Símptomes de pell, digestius i cefalea/vertigen han coincidit en ${mastCell} dies. Aquesta combinació pot justificar comentar si cal explorar causes al·lèrgiques o mastocitàries, inclosa MCAS només si la clínica global encaixa.`,`Tenir símptomes en diversos sistemes no equival a una síndrome d’activació mastocitària; el diagnòstic requereix criteris específics que l’app no pot aplicar.`,{compatibilityScore:Math.min(64,34+mastCell*6)}));

  const infectiousMedication=count(days,d=>d.medicacio_presa && Object.values(domainsForDay(d)).filter(Boolean).length>=3);
  if(infectiousMedication>=2) out.push(possibility('medication-context','Medicació / canvis de tractament com a context',`Hi ha ${infectiousMedication} dies multisímptoma en què també consta medicació.`,`La coincidència no indica que la medicació sigui la causa; cal revisar dates d’inici, dosis i indicació amb el professional.`,{compatibilityScore:Math.min(65,35+infectiousMedication*6)}));


  return rankedPossibilities(out).slice(0,6);
}


function digestivePossibilities(days, ev, cycleAnalysis){
  const out=[];
  const total=days.length;
  if(ev.dolor>=2 && ev.deposicions>=2) out.push(possibility('ibs','Síndrome de l’intestí irritable (SII)',`Dolor/malestar abdominal i canvis de deposició o urgència es repeteixen durant el període registrat.`,`El diagnòstic de SII requereix criteris clínics i valorar signes d’alarma; l’autoregistre no permet confirmar-lo.`,{compatibilityScore:Math.min(82,44+Math.min(ev.dolor,ev.deposicions)*7)}));
  if((ev.inflor>=3||ev.gasos>=3) && (ev.dolor>=2||ev.deposicions>=2)) out.push(possibility('sibo','Sobrecreixement bacterià de l’intestí prim (SIBO)',`Inflor o gasos recurrents coincideixen amb dolor o alteracions de deposició.`,`Aquests símptomes són molt inespecífics; el SIBO no es pot inferir només pel patró de símptomes i pot requerir proves específiques segons criteri mèdic.`,{compatibilityScore:Math.min(72,40+Math.max(ev.inflor,ev.gasos)*5)}));
  const inflammatoryGI=sameDay(days,[d=>d.digestiu_diarrea===true||d.digestiu_urgencia===true,d=>d.digestiu_llagues_boca===true||d.pell_brot===true||d.dolor_rigidesa===true]);
  if(inflammatoryGI>=2) out.push(possibility('ibd-celiac','Celiaquia o malaltia inflamatòria intestinal (MII)',`Diarrea/urgència ha coincidit amb llagues a la boca, pell o rigidesa en ${inflammatoryGI} dies.`,`Aquesta combinació no diferencia celiaquia, Crohn, colitis ulcerosa ni altres causes; només justifica comentar si cal estudi addicional.`,{compatibilityScore:Math.min(62,34+inflammatoryGI*6)}));
  if(ev.diarrea>=3 && ev.urgencia>=2) out.push(possibility('malabsorption-intolerance','Malabsorció o intoleràncies alimentàries',`Diarrea i urgència s’han repetit en diversos dies (${ev.diarrea} amb diarrea; ${ev.urgencia} amb urgència).`,`La relació temporal amb aliments concrets i una valoració professional són necessàries abans d’atribuir-ho a una intolerància.`,{compatibilityScore:Math.min(70,38+Math.min(ev.diarrea,ev.urgencia)*6)}));
  const cyc=(cycleAnalysis?.hypotheses||[]).find(h=>/digest/i.test(h.key||'')||/digest/i.test(h.title||''));
  if(cyc) out.push(possibility('cycle-digestive','Modulació digestiva relacionada amb el cicle',cyc.text,`${cyc.sourceNote} La coincidència amb una fase del cicle no demostra una causa hormonal.`));
  return rankedPossibilities(out).slice(0,5);
}

function vestibularPossibilities(days, cycleAnalysis){
  const out=[];
  const both=sameDay(days,[d=>d.vertigen_ocorregut||n(d.vertigen_intensitat)>=2,d=>d.mal_de_cap_ocorregut||n(d.mal_de_cap_intensitat)>=2]);
  if(both>=2) out.push(possibility('vestibular-migraine','Migranya vestibular',`Vertigen/boira mental i cefalea han coincidit en ${both} dies.`,`Cal valorar durada dels episodis, antecedents i trets migranyosos i descartar altres causes vestibulars; l’app no pot aplicar els criteris diagnòstics.`,{compatibilityScore:Math.min(82,42+both*8)}));
  const occ=sameDay(days,[d=>d.vertigen_ocorregut||n(d.vertigen_intensitat)>=2,d=>n(d.dolor_darrere_cap_intensitat)>=2||n(d.dolor_esquena_intensitat)>=2]);
  if(occ>=2) out.push(possibility('cervicogenic-dizziness','Component cervicogènic / mareig associat al coll',`El vertigen o mareig ha coincidit amb dolor occipital/cervical en ${occ} dies.`,`La coincidència no demostra que el coll sigui la causa; cal exploració clínica i considerar causes vestibulars o neurològiques alternatives.`,{compatibilityScore:Math.min(74,40+occ*7)}));
  const cyc=(cycleAnalysis?.hypotheses||[]).find(h=>/vert|cef|head|neuro|vest/i.test((h.key||'')+' '+(h.title||'')));
  if(cyc) out.push(possibility('cycle-migraine','Migranya o símptomes vestibulars relacionats amb el cicle',cyc.text,`${cyc.sourceNote} El patró temporal no confirma una causa hormonal.`));
  return rankedPossibilities(out).slice(0,4);
}

function occipitalPossibilities(days){
  const out=[];
  const occHead=sameDay(days,[d=>n(d.dolor_darrere_cap_intensitat)>=2,d=>d.mal_de_cap_ocorregut||n(d.mal_de_cap_intensitat)>=2]);
  const occBack=sameDay(days,[d=>n(d.dolor_darrere_cap_intensitat)>=2,d=>n(d.dolor_esquena_intensitat)>=2]);
  if(occHead>=2) out.push(possibility('cervicogenic-headache','Cefalea cervicogènica',`Dolor posterior del cap i cefalea han coincidit en ${occHead} dies.`,`Aquest patró no demostra causalitat cervical; la cefalea cervicogènica requereix exploració clínica i pot solapar-se amb migranya o cefalea tensional.`,{compatibilityScore:Math.min(78,42+occHead*7)}));
  if(occHead>=2||occBack>=2) out.push(possibility('tension-headache','Cefalea tensional / component muscular cervical',`Hi ha recurrència de dolor occipital juntament amb cefalea o dolor cervical.`,`La localització del dolor per si sola no permet distingir cefalea tensional, migranya ni altres causes.`,{compatibilityScore:Math.min(72,40+Math.max(occHead,occBack)*6)}));
  return rankedPossibilities(out).slice(0,3);
}

function sleepPossibilities(days){
  const out=[];
  const sleep=days.filter(d=>d.son_registrat);
  const fragmented=count(sleep,d=>n(d.son_despertars)>=3||n(d.son_qualitat)>=5);
  const fatigue=count(sleep,d=>n(d.son_fatiga_mati)>=5);
  const paras=count(sleep,d=>d.son_parasomnia===true);
  if(fragmented>=4 && fatigue>=3) out.push(possibility('insomnia-fragmented-sleep','Insomni de manteniment / son fragmentat',`S’han repetit despertares o mala qualitat del son i fatiga matinal.`,`Aquest patró no determina la causa del son fragmentat ni diferencia insomni, factors ambientals, dolor, respiració del son o altres trastorns.`,{compatibilityScore:Math.min(82,44+Math.min(fragmented,fatigue)*6)}));
  if(paras>=2) out.push(possibility('parasomnia','Parasòmnies',`S’han registrat fenòmens compatibles amb parasòmnia en ${paras} nits.`,`Cal descriure bé els episodis i, segons el cas, valorar-los en una unitat del son; l’app no pot classificar el tipus de parasòmnia.`,{compatibilityScore:Math.min(78,42+paras*8)}));
  if(fragmented>=4 && fatigue>=4) out.push(possibility('sleep-disordered-breathing','Trastorns respiratoris del son (p. ex. apnea del son)',`El son fragmentat i la fatiga matinal són recurrents.`,`Són símptomes inespecífics. Roncs, pauses respiratòries, somnolència diürna i un estudi del son són dades molt més orientatives.`,{compatibilityScore:Math.min(62,36+Math.min(fragmented,fatigue)*4)}));
  return rankedPossibilities(out).slice(0,4);
}

function cyclePossibilities(cycleHypothesis){
  if(!cycleHypothesis) return [];
  const out=[];
  const label=(cycleHypothesis.windowLabel||'').toLowerCase();
  const neuro=/vert|cef|head|neuro|migra/i.test((cycleHypothesis.key||'')+' '+(cycleHypothesis.title||''));
  const pain=/dolor|pain|muscul/i.test((cycleHypothesis.key||'')+' '+(cycleHypothesis.title||''));
  const digestive=/digest|intestin/i.test((cycleHypothesis.key||'')+' '+(cycleHypothesis.title||''));
  out.push(possibility('cycle-hormonal-modulation','Modulació dels símptomes relacionada amb el cicle hormonal',cycleHypothesis.text,`${cycleHypothesis.sourceNote} La repetició temporal no identifica quin mecanisme hormonal hi ha al darrere.`));
  if(neuro) out.push(possibility('menstrual-migraine','Migranya relacionada amb la menstruació / el cicle',`La cefalea o els símptomes vestibulars mostren concentració ${cycleHypothesis.windowLabel}.`,`Per parlar de migranya relacionada amb la menstruació cal confirmar el patró en diversos cicles i valorar criteris de migranya.`));
  if(label.includes('lút')||label.includes('lute')) out.push(possibility('pms-pmdd','Síndrome premenstrual (SPM) / trastorn disfòric premenstrual (TDPM), si hi ha símptomes compatibles',`El patró es concentra durant la fase lútia.`,`SPM i TDPM requereixen un conjunt específic de símptomes, especialment afectius en el TDPM, i seguiment prospectiu; l’app no els pot inferir només per la fase.`));
  if(pain||digestive) out.push(possibility('endometriosis-context','Endometriosi, si el dolor o els símptomes digestius són clarament cíclics',`Hi ha un patró temporal repetit relacionat amb el cicle.`,`L’endometriosi no es pot suggerir només per dolor o símptomes digestius cíclics; la localització, característiques del dolor i valoració ginecològica són essencials.`));
  return out.slice(0,4);
}

export function buildClinicalHypotheses(matrix={}) {
  const entries=Object.entries(matrix).sort(([a],[b])=>a.localeCompare(b));
  const days=entries.map(([date,d])=>({date,...(d||{})}));
  const totalDays=days.length;
  if(totalDays<10) return [];
  const out=[];
  const cycleAnalysis=analyzeCyclePatterns(matrix);

  // ---------- Fenotip/mecanisme de dolor: inferència transversal ----------
  // Aquesta capa no busca primer un diagnòstic concret: puntua propietats del patró
  // (recurrència, extensió anatòmica, son/fatiga, rigidesa i solapament neurològic)
  // i només després proposa famílies clíniques a comentar.
  const painAssessment=painMechanismAssessment(days);
  if(painAssessment.level){
    const evidence=[];
    evidence.push(`Dolor rellevant: ${painAssessment.significant.length} de ${totalDays} dies (${pct(painAssessment.significant.length,totalDays)}%).`);
    if(painAssessment.distinctRegions>=2) evidence.push(`Distribució: dolor registrat en ${painAssessment.distinctRegions} de 5 regions corporals àmplies durant el període.`);
    if(painAssessment.multiRegion.length) evidence.push(`Dolor en 2 o més regions el mateix dia: ${painAssessment.multiRegion.length} dies.`);
    if(painAssessment.sleepOverlap) evidence.push(`Dolor rellevant + mal descans/fatiga el mateix dia: ${painAssessment.sleepOverlap} dies.`);
    if(painAssessment.rigidDays) evidence.push(`Rigidesa registrada: ${painAssessment.rigidDays} dies.`);
    if(painAssessment.neuroOverlap) evidence.push(`Dolor rellevant + cefalea/vertigen: ${painAssessment.neuroOverlap} dies.`);
    out.push(hypothesis({
      id:'pain-phenotype-profile',
      title:'Fenotip de dolor a explorar',
      summary:'El motor ha detectat un patró de dolor recurrent i l’ha classificat pel seu comportament —distribució, recurrència i factors que l’acompanyen— abans de comparar-lo amb possibles explicacions clíniques.',
      evidence,
      denominator:`Període analitzat: ${totalDays} dies amb dades · puntuació interna de patró ${painAssessment.score}/10+ (compatibilitat ${painAssessment.level}).`,
      limits:'Aquest patró no determina l’origen del dolor. L’app no pot veure exploracions, ressonàncies, analítiques ni aplicar criteris diagnòstics complets; tampoc pot concloure que no hi hagi una causa estructural, inflamatòria, neurològica o metabòlica.',
      action:'Utilitza aquesta lectura com a resum per al professional i observa si la distribució, el son/fatiga i la recurrència es mantenen a mesura que s’acumulen setmanes i mesos de dades.',
      possibilities:painPhenotypePossibilities(days,painAssessment)
    }));
  }

  // ---------- Digestiu: SII / SIBO / patrons funcionals ----------
  const digestive = d => n(d.digestiu_general)>=2 || n(d.digestiu_inflor)>=2 || n(d.digestiu_dolorAbdominal)>=2 || n(d.digestiu_gasos)>=2 || n(d.digestiu_retortijons)>=2 || d.digestiu_urgencia || d.digestiu_bristol_anormal || d.digestiu_diarrea || d.digestiu_estrenyiment;
  const digestiveDays=days.filter(digestive);
  const ev={
    inflor:count(days,d=>n(d.digestiu_inflor)>=3),
    gasos:count(days,d=>n(d.digestiu_gasos)>=3),
    dolor:count(days,d=>n(d.digestiu_dolorAbdominal)>=3 || n(d.digestiu_general)>=4),
    deposicions:count(days,d=>d.digestiu_bristol_anormal || d.digestiu_diarrea || d.digestiu_estrenyiment || d.digestiu_urgencia),
    diarrea:count(days,d=>d.digestiu_diarrea),
    estrenyiment:count(days,d=>d.digestiu_estrenyiment),
    urgencia:count(days,d=>d.digestiu_urgencia),
  };
  const recurringFamilies=[ev.inflor,ev.gasos,ev.dolor,ev.deposicions].filter(x=>x>=2).length;
  if(digestiveDays.length>=3 && recurringFamilies>=2){
    const evidence=[];
    if(ev.inflor) evidence.push(`Inflor rellevant: ${ev.inflor} de ${totalDays} dies (${pct(ev.inflor,totalDays)}%).`);
    if(ev.gasos) evidence.push(`Gasos rellevants: ${ev.gasos} de ${totalDays} dies (${pct(ev.gasos,totalDays)}%).`);
    if(ev.dolor) evidence.push(`Dolor/malestar abdominal rellevant: ${ev.dolor} de ${totalDays} dies (${pct(ev.dolor,totalDays)}%).`);
    if(ev.deposicions) evidence.push(`Canvi de deposició o urgència: ${ev.deposicions} de ${totalDays} dies (${pct(ev.deposicions,totalDays)}%).`);
    const sii = recurring(ev.dolor) && recurring(ev.deposicions);
    const sibo = (recurring(ev.inflor)||recurring(ev.gasos)) && (recurring(ev.deposicions)||recurring(ev.dolor));
    const constipation = ev.estrenyiment>=3 && ev.diarrea===0;
    const diarrhea = ev.diarrea>=3 && ev.estrenyiment===0;
    const named=[];
    if(sii) named.push('SII');
    if(sibo) named.push('SIBO');
    if(constipation) named.push('patró de restrenyiment funcional');
    if(diarrhea) named.push('patró de diarrea funcional');
    out.push(hypothesis({
      id:'digestive-functional-profile',
      title:named.length?`Perfil digestiu a explorar (${named.join(' / ')})`:'Perfil digestiu recurrent a explorar',
      summary:named.length?`La combinació registrada pot aparèixer en perfils com ${named.join(', ')}, però també en moltes altres causes. L'app no pot confirmar ni diferenciar aquests diagnòstics.`:'Hi ha una combinació recurrent de símptomes digestius que pot ser útil revisar amb digestiu.',
      evidence,
      denominator:`Període: ${totalDays} dies amb dades · ${digestiveDays.length} amb algun símptoma digestiu (${pct(digestiveDays.length,totalDays)}%).`,
      limits:'L’autoregistre no permet aplicar criteris diagnòstics complets, descartar causes orgàniques ni substituir proves específiques.',
      action:'Comenta amb digestiu la combinació de dolor, inflor/gasos, urgència i forma de les deposicions, juntament amb la seva evolució temporal.',
      possibilities:digestivePossibilities(days,ev,cycleAnalysis)
    }));
  }

  // ---------- Vestibular + cefalea ----------
  const vertigoHead=overlap(days,d=>d.vertigen_ocorregut||n(d.vertigen_intensitat)>=2,d=>d.mal_de_cap_ocorregut||n(d.mal_de_cap_intensitat)>=2);
  const vertigoOcc=overlap(days,d=>d.vertigen_ocorregut||n(d.vertigen_intensitat)>=2,d=>n(d.dolor_darrere_cap_intensitat)>=2);
  if(vertigoHead.base>=5 && vertigoHead.both/vertigoHead.base>=0.5){
    const evidence=[`Vertigen/boira mental: ${vertigoHead.base} dies; en ${vertigoHead.both} també hi havia mal de cap (${pct(vertigoHead.both,vertigoHead.base)}%).`];
    if(vertigoOcc.both>=2) evidence.push(`Dolor darrere del cap en ${vertigoOcc.both} de ${vertigoOcc.base} dies amb vertigen (${pct(vertigoOcc.both,vertigoOcc.base)}%).`);
    out.push(hypothesis({
      id:'vestibular-headache-profile',
      title:'Perfil vestibular + cefalea a explorar',
      summary:'La coincidència repetida de símptomes vestibulars i cefalea fa raonable comentar amb neurologia si hi ha un patró migranyós/vestibular, inclosa la migranya vestibular entre els possibles diferencials.',
      evidence,
      denominator:`Comparació sobre ${totalDays} dies amb dades.`,
      limits:'Per valorar migranya vestibular cal informació que l’app pot no tenir: durada i intensitat dels episodis, antecedents de migranya i trets migranyosos com fotofòbia/fonofòbia o aura, a més de descartar altres causes vestibulars.',
      action:'Continua registrant durada, tipus de vertigen i relació temporal amb el mal de cap; porta els episodis coincidents a neurologia.',
      possibilities:vestibularPossibilities(days,cycleAnalysis)
    }));
  }

  // ---------- Occipital/cervical + cefalea ----------
  const occDays=days.filter(d=>n(d.dolor_darrere_cap_intensitat)>=2);
  const occHead=overlap(days,d=>n(d.dolor_darrere_cap_intensitat)>=2,d=>d.mal_de_cap_ocorregut||n(d.mal_de_cap_intensitat)>=2);
  const occBack=overlap(days,d=>n(d.dolor_darrere_cap_intensitat)>=2,d=>n(d.dolor_esquena_intensitat)>=2);
  if(occDays.length>=3 && (occHead.both>=2 || occBack.both>=2)){
    const evidence=[`Dolor darrere del cap: ${occDays.length} dies.`];
    if(occHead.both) evidence.push(`Coincideix amb mal de cap en ${occHead.both} de ${occHead.base} episodis (${pct(occHead.both,occHead.base)}%).`);
    if(occBack.both) evidence.push(`Coincideix amb dolor d’esquena/cervical en ${occBack.both} de ${occBack.base} episodis (${pct(occBack.both,occBack.base)}%).`);
    out.push(hypothesis({
      id:'occipital-cervical-headache-profile',
      title:'Perfil occipital / cervical a explorar',
      summary:'El dolor posterior del cap que coincideix amb cefalea o dolor cervical pot justificar valorar un possible component cervical o tensional, entre altres causes.',
      evidence,
      denominator:`Comparació sobre ${totalDays} dies amb dades.`,
      limits:'L’app no pot demostrar que el coll sigui la causa del mal de cap. La cefalea cervicogènica requereix evidència clínica de causalitat i pot solapar-se amb altres cefalees.',
      action:'Comenta la relació entre dolor occipital, mobilitat cervical, postures i cefalea amb fisioteràpia o el professional mèdic.',
      possibilities:occipitalPossibilities(days)
    }));
  }

  // ---------- Son fragmentat / parasòmnies ----------
  const sleepLogged=days.filter(d=>d.son_registrat);
  const badSleep=count(sleepLogged,d=>n(d.son_qualitat)>=5 || n(d.son_despertars)>=3 || n(d.son_fatiga_mati)>=5);
  const paras=count(sleepLogged,d=>d.son_parasomnia);
  if(sleepLogged.length>=7 && (paras>=2 || badSleep>=4)){
    const evidence=[];
    if(badSleep) evidence.push(`Son fragmentat/mal descans: ${badSleep} de ${sleepLogged.length} nits registrades (${pct(badSleep,sleepLogged.length)}%).`);
    if(paras) evidence.push(`Fenòmens compatibles amb parasòmnia registrats en ${paras} de ${sleepLogged.length} nits (${pct(paras,sleepLogged.length)}%).`);
    out.push(hypothesis({
      id:'sleep-fragmentation-profile',
      title:paras>=2?'Perfil de son fragmentat + parasòmnies a explorar':'Perfil de son fragmentat a explorar',
      summary:'La repetició de despertares, mal descans o conductes durant el son pot ser útil per orientar una valoració específica del son.',
      evidence,
      denominator:`${sleepLogged.length} nits amb registre de son dins de ${totalDays} dies amb dades.`,
      limits:'L’autoregistre no determina el tipus de trastorn del son ni substitueix una història clínica o un estudi de son.',
      action:'Registra hora, durada, record de l’episodi, possibles desencadenants i si algú l’ha observat; porta el resum a la consulta de son si es manté.',
      possibilities:sleepPossibilities(days)
    }));
  }

  // ---------- Brots multisimptomàtics (hipòtesi transversal, no diagnòstica) ----------
  const multiDays=days.filter(d=>{
    const domains=[n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5, n(d.digestiu_general)>=4||n(d.digestiu_inflor)>=4||d.digestiu_bristol_anormal, n(d.son_qualitat)>=5||n(d.son_fatiga_mati)>=5, d.pell_brot, d.vertigen_ocorregut||d.mal_de_cap_ocorregut];
    return domains.filter(Boolean).length>=3;
  });
  if(multiDays.length>=3){
    const possibilities=multisystemPossibilities(days,cycleAnalysis);
    out.push(hypothesis({
      id:'multisystem-flare-profile',
      title:'Brots multisimptomàtics a explorar',
      summary:'Hi ha dies en què empitjoren alhora diversos àmbits (dolor, digestiu, son, pell o cefalea/vertigen). L’app utilitza les combinacions registrades per proposar famílies d’explicacions que pot tenir sentit comentar amb un professional, sense convertir-les en diagnòstics.',
      evidence:[`S’han detectat ${multiDays.length} dies amb empitjorament simultani d’almenys 3 àmbits (${pct(multiDays.length,totalDays)}% dels dies amb dades).`],
      denominator:`Període analitzat: ${totalDays} dies amb dades.`,
      limits:'La coincidència sistèmica pot tenir moltes explicacions i no identifica una causa.',
      action:'Mira si aquests brots comparteixen fase del cicle, infecció, estrès, son, activitat, medicació o altres canvis previs registrats.',
      possibilities
    }));
  }


  const cycleMulti=(cycleAnalysis.hypotheses||[]).find(h=>h.key==='multisystem') || (cycleAnalysis.hypotheses||[])[0];
  if(cycleMulti){
    out.push(hypothesis({
      id:'cycle-related-profile',
      title:'Possible patró relacionat amb el cicle',
      summary:cycleMulti.key==='multisystem'
        ? `Els brots multisímptoma tendeixen a concentrar-se ${cycleMulti.windowLabel}.`
        : `${cycleMulti.title} mostra una concentració temporal que convé seguir en els pròxims cicles.`,
      evidence:[cycleMulti.text, cycleMulti.sourceNote],
      denominator:`${cycleMulti.cyclesObserved} cicle${cycleMulti.cyclesObserved===1?'':'s'} comparable${cycleMulti.cyclesObserved===1?'':'s'} · confiança ${cycleMulti.confidence}.`,
      limits:'Una relació temporal amb una fase del cicle no permet determinar la causa ni diagnosticar un trastorn hormonal.',
      action:'Observa si es repeteix els pròxims cicles. Si disposes de Clue, test LH o temperatura basal, introdueix la dada per situar millor l’ovulació.',
      confidenceStatus:cycleMulti.status,
      possibilities:cyclePossibilities(cycleMulti)
    }));
  }

  return out.slice(0,8);
}

function hypothesis(x){ return {badge:'Hipòtesi a explorar · no diagnòstica',...x}; }


export async function loadHypothesisFollowups() {
  const repo = new Repository("hypotheses");
  const rows = await repo.getAll();
  return Object.fromEntries((rows || []).filter(r => r?.possibilityId).map(r => [r.possibilityId, r]));
}

function followupStatusLabel(status) {
  return status === "confirmed" ? "Confirmat per un professional"
    : status === "discarded" ? "Descartat per un professional"
    : "Sense valorar";
}

function followupStatusColor(status) {
  return status === "confirmed" ? "var(--sage)"
    : status === "discarded" ? "var(--clay)"
    : "var(--ink-faint)";
}



function followupReadonlyHtml(followup = {}) {
  const status = followup.status || "pending";
  const files = followup.attachments || [];
  const states = [
    ["pending","◷","Sense valorar","#f2eadb","#725a2c"],
    ["confirmed","✓","Confirmat per un professional","#e4efe8","#315f45"],
    ["discarded","×","Descartat per un professional","#f3e3e0","#7a433d"]
  ];

  return `<div style="margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--paper);">
    <div style="font-size:var(--fs-xs);font-weight:700;margin-bottom:8px;">Seguiment amb el professional</div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:${followup.date || followup.note || files.length ? "10px" : "0"};">
      ${states.map(([value,icon,label,bg,fg]) => {
        const active = status === value;
        return `<div aria-current="${active ? "true" : "false"}"
          style="flex:1;min-width:150px;border:1px solid ${active ? fg : "var(--line)"};border-radius:12px;padding:11px 12px;background:${active ? bg : "var(--paper-alt)"};color:${active ? fg : "var(--ink-faint)"};font-weight:${active ? "750" : "600"};">
          <span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;margin-right:6px;background:${active ? fg : "var(--paper)"};color:${active ? "white" : "var(--ink-faint)"};">${icon}</span>${label}
        </div>`;
      }).join("")}
    </div>

    ${followup.date ? `<div style="font-size:var(--fs-xs);margin-top:4px;"><strong>Data:</strong> ${escapeHtml(followup.date)}</div>` : ""}
    ${followup.note ? `<div style="font-size:var(--fs-xs);margin-top:6px;"><strong>Nota del professional:</strong><div style="margin-top:3px;color:var(--ink-soft);">${escapeHtml(followup.note)}</div></div>` : ""}

    ${files.length ? `<div style="margin-top:10px;">
      <div style="font-size:var(--fs-xs);font-weight:700;margin-bottom:6px;">Documents adjunts</div>
      <div style="display:grid;gap:6px;">
        ${files.map((f,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;background:var(--paper-alt);border-radius:var(--radius-sm);font-size:var(--fs-xs);">
          <div style="min-width:0;">
            <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${escapeHtml(f.label || f.name || `Document ${i+1}`)}</div>
            ${f.label && f.name && f.label !== f.name ? `<div style="margin-top:2px;color:var(--ink-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.name)}</div>` : ""}
          </div>
          ${f.dataUrl ? `<a class="btn btn-ghost" href="${escapeHtml(f.dataUrl)}" download="${escapeHtml(f.name || "document")}" style="padding:4px 8px;flex-shrink:0;">Descarrega</a>` : `<span style="color:var(--ink-faint);font-size:11px;">No disponible</span>`}
        </div>`).join("")}
      </div>
    </div>` : ""}
  </div>`;
}

function followupEditorHtml(p, followup = {}) {
  const status = followup.status || "pending";
  const files = followup.attachments || [];
  return `<div class="hypothesis-followup" data-hypothesis-followup="${escapeHtml(p.id)}" style="margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--paper);">
    <div style="font-size:var(--fs-xs);font-weight:700;margin-bottom:8px;">Seguiment amb el professional</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px;">
      ${[
        ["pending","◷","Sense valorar","#f2eadb","#725a2c"],
        ["confirmed","✓","Confirmat","#e4efe8","#315f45"],
        ["discarded","×","Descartat","#f3e3e0","#7a433d"]
      ].map(([value,icon,label,bg,fg]) => {
        const active = status === value;
        return `<button type="button" class="hypothesis-status-btn" data-status="${value}" aria-pressed="${active}"
          style="flex:1;min-width:150px;border:1px solid ${active ? fg : "var(--line)"};border-radius:12px;padding:11px 12px;background:${active ? bg : "var(--paper)"};color:${active ? fg : "var(--ink-soft)"};font-weight:${active ? "750" : "600"};cursor:pointer;transition:.15s;box-shadow:${active ? `inset 0 0 0 1px ${fg}` : "none"};">
          <span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;margin-right:6px;background:${active ? fg : "var(--paper-alt)"};color:${active ? "white" : "var(--ink-faint)"};">${icon}</span>${label}
        </button>`;
      }).join("")}
    </div>
    <label style="display:block;font-size:var(--fs-xs);color:var(--ink-soft);margin-bottom:8px;">
      Data de la valoració
      <input type="date" class="input hypothesis-date" value="${escapeHtml(followup.date || "")}" style="margin-top:4px;width:100%;">
    </label>
    <label style="display:block;font-size:var(--fs-xs);color:var(--ink-soft);margin-bottom:8px;">
      Nota
      <textarea class="input hypothesis-note" rows="3" placeholder="" style="margin-top:4px;width:100%;resize:vertical;">${escapeHtml(followup.note || "")}</textarea>
    </label>
    <div style="display:grid;gap:8px;">
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;">
        <label style="display:block;font-size:var(--fs-xs);color:var(--ink-soft);">
          Nom del document
          <input type="text" class="input hypothesis-file-label" placeholder="" style="margin-top:4px;width:100%;">
        </label>
        <label class="btn btn-ghost" style="cursor:pointer;white-space:nowrap;">
          Selecciona fitxer
          <input type="file" class="hypothesis-file-input" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" style="display:none;">
        </label>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button type="button" class="btn btn-primary hypothesis-save-btn">Desa seguiment</button>
        <span class="hypothesis-save-state" style="font-size:var(--fs-xs);color:var(--ink-faint);"></span>
      </div>
    </div>
    <div class="hypothesis-files" style="display:grid;gap:6px;margin-top:9px;">
      ${files.map((f, i) => `<div class="hypothesis-file-row" data-file-index="${i}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;background:var(--paper-alt);border-radius:var(--radius-sm);font-size:var(--fs-xs);">
        <div style="min-width:0;">
          <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${escapeHtml(f.label || f.name || `Document ${i+1}`)}</div>
          ${f.label && f.name && f.label !== f.name ? `<div style="margin-top:2px;color:var(--ink-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.name)}</div>` : ""}
        </div>
        <span style="display:flex;gap:6px;flex-shrink:0;">
          <a class="btn btn-ghost hypothesis-download-file" href="${escapeHtml(f.dataUrl || "#")}" download="${escapeHtml(f.name || "document")}" style="padding:4px 8px;">Descarrega</a>
          <button type="button" class="btn btn-ghost hypothesis-remove-file" data-file-index="${i}" style="padding:4px 8px;">Elimina</button>
        </span>
      </div>`).join("")}
    </div>
  </div>`;
}

export function clinicalHypothesesHtml(hypotheses=[], { compact=false, interactive=false, followups={} }={}) {
  if(!hypotheses.length) return compact ? '' : `<p class="ledger-empty">Encara no hi ha prou combinacions repetides per proposar cap hipòtesi clínica amb evidència explícita.</p>`;
  return `<div class="clinical-hypotheses-list">${hypotheses.map(h=>`<div class="card" style="border-left:3px solid var(--ink-soft);${compact?'padding:12px;':''}">
    <span class="badge" style="background:transparent;color:var(--ink-soft);padding-left:0;">${h.badge}</span>
    <p style="margin:var(--sp-1) 0 0;font-size:var(--fs-md);font-weight:600;">${h.title}</p>
    <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${h.summary}</p>
    <div style="margin-top:var(--sp-3);font-size:var(--fs-sm);"><strong>Per què apareix</strong><ul style="margin:6px 0 0 18px;">${h.evidence.map(x=>`<li>${x}</li>`).join('')}</ul><p style="margin:8px 0 0;color:var(--ink-faint);">${h.denominator}</p></div>
    ${h.possibilities?.length?(()=>{const ps=rankedPossibilities(h.possibilities);const clinical=ps.find(p=>p.clinicalSummary)?.clinicalSummary;return `<div style="margin-top:var(--sp-3);font-size:var(--fs-sm);"><strong>Possibilitats a valorar amb el professional</strong>${clinical?`<div style="margin-top:8px;padding:10px 12px;border-left:3px solid var(--ink-soft);background:var(--paper-alt);border-radius:0 var(--radius-md) var(--radius-md) 0;font-weight:650;">${clinical}</div>`:''}<div style="display:grid;gap:8px;margin-top:8px;">${ps.map(p=>`<div style="padding:10px 12px;background:var(--paper-alt);border-radius:var(--radius-md);">${compatibilityScaleHtml(p)}<strong>${p.title}</strong><div style="margin-top:3px;">${p.why}</div><div style="margin-top:3px;color:var(--ink-faint);font-size:var(--fs-xs);">${p.limit}</div>${interactive && !isViewerMode() ? followupEditorHtml(p, followups[p.id] || {}) : (isViewerMode() ? followupReadonlyHtml(followups[p.id] || { status:"pending" }) : followupReadonlyHtml(followups[p.id]))}</div>`).join('')}</div><div style="margin-top:7px;color:var(--ink-faint);font-size:11px;">L’ordre indica compatibilitat amb els registres disponibles, no probabilitat diagnòstica. Verd = més compatible; groc = moderada; vermell = baixa/inicial.</div></div>`;})():''}
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-sm);"><strong>Què no sabem:</strong> ${h.limits}</p>
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-sm);">💡 ${h.action}</p>
  </div>`).join('')}</div>`;
}
