import { VARIABLE_META } from "./normalizer.js";

const EXCLUDED_KEYS = new Set([
  "dolor_registrat", "digestiu_deposicio_registrada", "son_registrat",
  "cicle_regla", "cicle_premenstrual", "cicle_postmenstrual", "cicle_ovulacio_finestra", "cicle_ovulacio_registrada",
  "medicacio_presa",
]);

const EPISODE_KEYS = [
  "dolor_intensitat_max", "dolor_esquena_intensitat", "dolor_darrere_cap_intensitat",
  "mal_de_cap_ocorregut", "vertigen_ocorregut",
  "digestiu_general", "digestiu_inflor", "digestiu_dolorAbdominal", "digestiu_diarrea", "digestiu_urgencia",
  "son_qualitat", "son_parasomnia", "son_mocs_matinals",
  "energia_fisica", "pell_brot",
];

const DOMAIN_ORDER = ["Dolor", "Digestiu", "Son", "Vertígens i boira mental", "Energia", "Pell"];

function utcDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
function dateStr(date) { return date.toISOString().slice(0,10); }
function addDays(date, n) { const d = utcDate(date); d.setUTCDate(d.getUTCDate() + n); return dateStr(d); }
function diffDays(a,b) { return Math.round((utcDate(b)-utcDate(a))/86400000); }
function mean(values) { return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null; }
function std(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum,v)=>sum+(v-m)**2,0)/values.length);
}
function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 4) return null;
  const mx=mean(xs), my=mean(ys);
  let num=0, dx=0, dy=0;
  for(let i=0;i<xs.length;i++) { const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  if (!dx || !dy) return null;
  return num / Math.sqrt(dx*dy);
}
function isActive(meta, value) {
  if (!meta || value == null) return false;
  if (meta.type === "boolean") return value === true && meta.valence !== "positive";
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (meta.valence === "positive") return n <= 3;
  if (meta.valence === "negative") return n >= 6;
  return false;
}
function observed(day, key) { return day && day[key] !== undefined && day[key] !== null; }
function mondayKey(dateStrValue) {
  const d = utcDate(dateStrValue);
  const dow = d.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate()+shift);
  return dateStr(d);
}
function monthKey(date) { return date.slice(0,7); }
function groupRuns(activeDates) {
  const dates=[...activeDates].sort();
  if (!dates.length) return [];
  const groups=[]; let current=[dates[0]];
  for(let i=1;i<dates.length;i++) {
    if (dates[i] === addDays(dates[i-1],1)) current.push(dates[i]);
    else { groups.push(current); current=[dates[i]]; }
  }
  groups.push(current);
  return groups;
}

function detectEpisodes(matrix) {
  const results=[];
  for (const key of EPISODE_KEYS) {
    const meta=VARIABLE_META[key];
    if (!meta) continue;
    const activeDates=Object.keys(matrix).filter(date=>isActive(meta,matrix[date]?.[key])).sort();
    if (activeDates.length < 2) continue;
    const groups=groupRuns(activeDates);
    const episodes=groups.map(group=>({
      start:group[0], end:group.at(-1), days:group.length,
      peak: meta.type === "numeric" ? Math.max(...group.map(d=>Number(matrix[d]?.[key])).filter(Number.isFinite)) : null,
    }));
    const gaps=[];
    for(let i=1;i<episodes.length;i++) gaps.push(diffDays(episodes[i-1].start,episodes[i].start));
    const avgGap=mean(gaps);
    const gapCv=gaps.length>=2 && avgGap ? std(gaps)/avgGap : null;
    results.push({
      key,label:meta.label,category:meta.category,type:meta.type,totalActiveDays:activeDates.length,
      episodeCount:episodes.length,episodes,avgDuration:mean(episodes.map(e=>e.days)),maxDuration:Math.max(...episodes.map(e=>e.days)),
      avgGap,minGap:gaps.length?Math.min(...gaps):null,maxGap:gaps.length?Math.max(...gaps):null,gapCv,
    });
  }
  return results.sort((a,b)=>b.totalActiveDays-a.totalActiveDays || b.maxDuration-a.maxDuration);
}

function periodicRhythms(episodes) {
  return episodes.filter(item => item.episodeCount >= 3 && item.avgGap >= 5 && item.avgGap <= 90 && item.gapCv != null && item.gapCv <= 0.5)
    .map(item => ({
      key:item.key,label:item.label,episodeCount:item.episodeCount,avgGap:item.avgGap,minGap:item.minGap,maxGap:item.maxGap,gapCv:item.gapCv,
      confidence: item.episodeCount>=5 && item.gapCv<=0.3 ? "moderada" : "preliminar",
      text:`${item.label} ha format ${item.episodeCount} episodis, separats de mitjana ${Math.round(item.avgGap)} dies (rang ${item.minGap}–${item.maxGap}).`,
    })).sort((a,b)=>a.gapCv-b.gapCv || b.episodeCount-a.episodeCount);
}

function dayDomainFlags(day={}) {
  const flags={};
  for (const [key,value] of Object.entries(day)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    const meta=VARIABLE_META[key];
    if (!meta || !meta.valence || !isActive(meta,value)) continue;
    const domain=meta.category || "Altres";
    flags[domain]=true;
  }
  return flags;
}

function weeklyAggregates(matrix) {
  const weeks=new Map();
  for (const [date,day] of Object.entries(matrix)) {
    const key=mondayKey(date);
    if(!weeks.has(key)) weeks.set(key,{week:key,days:0,burden:0,domains:new Map()});
    const w=weeks.get(key); w.days++;
    const flags=dayDomainFlags(day);
    const domains=Object.keys(flags);
    w.burden += domains.length;
    for (const domain of domains) w.domains.set(domain,(w.domains.get(domain)||0)+1);
  }
  return [...weeks.values()].filter(w=>w.days>=3).sort((a,b)=>a.week.localeCompare(b.week)).map(w=>({
    week:w.week,days:w.days,avgBurden:w.burden/w.days,
    domainRates:Object.fromEntries(DOMAIN_ORDER.map(domain=>[domain,(w.domains.get(domain)||0)/w.days])),
  }));
}

function weeklySignals(weeks) {
  if (weeks.length < 3) return [];
  const latest=weeks.at(-1), prior=weeks.slice(0,-1);
  const baseline=mean(prior.map(w=>w.avgBurden));
  if (baseline == null) return [];
  const delta=latest.avgBurden-baseline;
  const signals=[];
  if (Math.abs(delta)>=0.6) signals.push({
    type:"global",direction:delta>0?"més carregada":"més estable",week:latest.week,latest:latest.avgBurden,baseline,delta,
    text:`L’última setmana té ${latest.avgBurden.toFixed(1)} àmbits alterats per dia de mitjana, comparat amb ${baseline.toFixed(1)} a les setmanes anteriors.`,
  });
  for (const domain of DOMAIN_ORDER) {
    const base=mean(prior.map(w=>w.domainRates[domain]||0));
    const now=latest.domainRates[domain]||0;
    if (Math.abs(now-base)>=0.35 && Math.max(now,base)>=0.4) signals.push({
      type:"domain",domain,direction:now>base?"ha augmentat":"ha disminuït",week:latest.week,latest:now,baseline:base,delta:now-base,
      text:`${domain}: present en ${Math.round(now*100)}% dels dies de l’última setmana vs ${Math.round(base*100)}% de mitjana a les anteriors.`,
    });
  }
  return signals.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,6);
}

function coEvolution(weeks) {
  if (weeks.length < 4) return [];
  const pairs=[];
  for(let i=0;i<DOMAIN_ORDER.length;i++) for(let j=i+1;j<DOMAIN_ORDER.length;j++) {
    const a=DOMAIN_ORDER[i],b=DOMAIN_ORDER[j];
    const xs=weeks.map(w=>w.domainRates[a]||0),ys=weeks.map(w=>w.domainRates[b]||0);
    if (std(xs)<0.12 || std(ys)<0.12) continue;
    const r=pearson(xs,ys);
    if (r == null || r < 0.7) continue;
    pairs.push({a,b,r,weeks:weeks.length,text:`${a} i ${b} han tendit a pujar i baixar juntes entre setmanes (associació setmanal r=${r.toFixed(2)}; ${weeks.length} setmanes comparables).`});
  }
  return pairs.sort((a,b)=>b.r-a.r).slice(0,5);
}

function monthlyAggregates(matrix) {
  const months=new Map();
  for(const [date,day] of Object.entries(matrix)) {
    const key=monthKey(date);
    if(!months.has(key)) months.set(key,{month:key,days:0,domains:new Map(),burden:0});
    const m=months.get(key); m.days++;
    const flags=dayDomainFlags(day); const domains=Object.keys(flags); m.burden+=domains.length;
    domains.forEach(domain=>m.domains.set(domain,(m.domains.get(domain)||0)+1));
  }
  return [...months.values()].filter(m=>m.days>=5).sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({
    month:m.month,days:m.days,avgBurden:m.burden/m.days,
    domainRates:Object.fromEntries(DOMAIN_ORDER.map(domain=>[domain,(m.domains.get(domain)||0)/m.days])),
  }));
}

function longTermTrends(months,weeks) {
  const out=[];
  if (months.length>=3) {
    const first=months[0], last=months.at(-1), delta=last.avgBurden-first.avgBurden;
    if (Math.abs(delta)>=0.5) out.push({
      scale:"monthly",label:"Càrrega global de símptomes",direction:delta>0?"ha augmentat":"ha disminuït",delta,
      text:`La càrrega global ha passat de ${first.avgBurden.toFixed(1)} àmbits alterats/dia a ${last.avgBurden.toFixed(1)} entre ${first.month} i ${last.month}.`,
    });
    for (const domain of DOMAIN_ORDER) {
      const d=(last.domainRates[domain]||0)-(first.domainRates[domain]||0);
      if(Math.abs(d)>=0.3 && Math.max(last.domainRates[domain]||0,first.domainRates[domain]||0)>=0.35) out.push({
        scale:"monthly",label:domain,direction:d>0?"ha augmentat":"ha disminuït",delta:d,
        text:`${domain}: ${Math.round((first.domainRates[domain]||0)*100)}% dels dies al primer mes comparable → ${Math.round((last.domainRates[domain]||0)*100)}% a l’últim.`,
      });
    }
  } else if (weeks.length>=6) {
    const half=Math.floor(weeks.length/2), first=weeks.slice(0,half), second=weeks.slice(half);
    const a=mean(first.map(w=>w.avgBurden)),b=mean(second.map(w=>w.avgBurden)),delta=b-a;
    if(Math.abs(delta)>=0.5) out.push({scale:"weeks",label:"Càrrega global de símptomes",direction:delta>0?"ha augmentat":"ha disminuït",delta,text:`La càrrega mitjana ha passat de ${a.toFixed(1)} a ${b.toFixed(1)} àmbits alterats/dia entre la primera i la segona meitat de les ${weeks.length} setmanes analitzades.`});
  }
  return out.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,6);
}

export function analyzeTemporalPatterns(matrix) {
  const episodes=detectEpisodes(matrix);
  const weeks=weeklyAggregates(matrix);
  const months=monthlyAggregates(matrix);
  return {
    episodes,
    recurrentEpisodes:episodes.filter(e=>e.maxDuration>=2 || e.episodeCount>=2).slice(0,8),
    rhythms:periodicRhythms(episodes),
    weeks,
    weeklySignals:weeklySignals(weeks),
    coEvolution:coEvolution(weeks),
    months,
    longTermTrends:longTermTrends(months,weeks),
  };
}
