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
export function buildClinicalHypotheses(matrix={}) {
  const entries=Object.entries(matrix).sort(([a],[b])=>a.localeCompare(b));
  const days=entries.map(([date,d])=>({date,...(d||{})}));
  const totalDays=days.length;
  if(totalDays<10) return [];
  const out=[];

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
      action:'Comenta amb digestiu la combinació de dolor, inflor/gasos, urgència i forma de les deposicions, juntament amb la seva evolució temporal.'
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
      action:'Continua registrant durada, tipus de vertigen i relació temporal amb el mal de cap; porta els episodis coincidents a neurologia.'
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
      action:'Comenta la relació entre dolor occipital, mobilitat cervical, postures i cefalea amb fisioteràpia o el professional mèdic.'
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
      action:'Registra hora, durada, record de l’episodi, possibles desencadenants i si algú l’ha observat; porta el resum a la consulta de son si es manté.'
    }));
  }

  // ---------- Brots multisimptomàtics (hipòtesi transversal, no diagnòstica) ----------
  const multiDays=days.filter(d=>{
    const domains=[n(d.dolor_general)>=5||n(d.dolor_intensitat_max)>=5, n(d.digestiu_general)>=4||n(d.digestiu_inflor)>=4||d.digestiu_bristol_anormal, n(d.son_qualitat)>=5||n(d.son_fatiga_mati)>=5, d.pell_brot, d.vertigen_ocorregut||d.mal_de_cap_ocorregut];
    return domains.filter(Boolean).length>=3;
  });
  if(multiDays.length>=3){
    out.push(hypothesis({
      id:'multisystem-flare-profile',
      title:'Brots multisimptomàtics a explorar',
      summary:'Hi ha dies en què empitjoren alhora diversos àmbits (dolor, digestiu, son, pell o cefalea/vertigen). Això és un patró transversal útil per buscar un context comú, sense apuntar per si sol a una malaltia concreta.',
      evidence:[`S’han detectat ${multiDays.length} dies amb empitjorament simultani d’almenys 3 àmbits (${pct(multiDays.length,totalDays)}% dels dies amb dades).`],
      denominator:`Període analitzat: ${totalDays} dies amb dades.`,
      limits:'La coincidència sistèmica pot tenir moltes explicacions i no identifica una causa.',
      action:'Mira si aquests brots comparteixen fase del cicle, infecció, estrès, son, activitat, medicació o altres canvis previs registrats.'
    }));
  }

  return out.slice(0,6);
}

function hypothesis(x){ return {badge:'Hipòtesi a explorar · no diagnòstica',...x}; }

export function clinicalHypothesesHtml(hypotheses=[], { compact=false }={}) {
  if(!hypotheses.length) return compact ? '' : `<p class="ledger-empty">Encara no hi ha prou combinacions repetides per proposar cap hipòtesi clínica amb evidència explícita.</p>`;
  return hypotheses.map(h=>`<div class="card" style="border-left:3px solid var(--ink-soft);${compact?'padding:12px;':''}">
    <span class="badge" style="background:transparent;color:var(--ink-soft);padding-left:0;">${h.badge}</span>
    <p style="margin:var(--sp-1) 0 0;font-size:var(--fs-md);font-weight:600;">${h.title}</p>
    <p style="margin:var(--sp-1) 0 0;color:var(--ink-soft);">${h.summary}</p>
    <div style="margin-top:var(--sp-3);font-size:var(--fs-sm);"><strong>Per què apareix</strong><ul style="margin:6px 0 0 18px;">${h.evidence.map(x=>`<li>${x}</li>`).join('')}</ul><p style="margin:8px 0 0;color:var(--ink-faint);">${h.denominator}</p></div>
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-sm);"><strong>Què no sabem:</strong> ${h.limits}</p>
    <p style="margin:var(--sp-3) 0 0;font-size:var(--fs-sm);">💡 ${h.action}</p>
  </div>`).join('');
}
