import { Repository } from "../db/repository.js";
import { buildDailyMatrix } from "./normalizer.js";
import { computeCorrelations, computeDayOfWeekPatterns, computeTrends, humanLagLabel } from "./correlation.js";
import { classifyConclusions } from "./conclusions.js";
import { detectFlares } from "./flares.js";
import { analyzeMedicationResponse } from "./medication-analysis.js";
import { analyzeCyclePatterns } from "./cycle-analysis.js";
import { analyzeTemporalPatterns } from "./temporal-analysis.js";

const painRepo = new Repository("pain_events");
const medicationRepo = new Repository("medications");

const PAIN_TYPE_LABELS = {
  punxant: "punxant / ganivet", cremor: "cremor", pressio: "pressió",
  contractura: "contractura", rigidesa: "rigidesa", descarrega: "descàrrega",
  difus: "dolor difús", tendo: "mal de tendó", tiba: "em tiba", altres: "altres"
};

function dateOnly(value) { return (value || "").slice(0,10); }
function inRange(date,start,end){ return (!start||date>=start)&&(!end||date<=end); }
function average(values){ return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; }
function topCount(map){ return [...map.entries()].sort((a,b)=>b[1]-a[1])[0]||null; }
function confidenceFromCount(n){ return n>=60?"alta":n>=30?"moderada":n>=14?"baixa":"insuficient"; }
function isSleepAffected(r){ return (r.impacteSon||[]).some(x=>x!=="no_afecta"&&x!=="no afecta"); }

function painSpecificInsights(records, matrix) {
  if (!records.length) return { summary:[], profile:null, recommendations:[], zones:[] };
  const intensities=records.map(r=>Number(r.intensitat||0));
  const zones=new Map(),types=new Map(),triggers=new Map(),moments=new Map();

  records.forEach(r=>{
    const zoneLabels=[];
    (r.entries||[]).forEach(e=>{
      const labels=e.zonaLabels || (e.zoneLabel?[e.zoneLabel]:e.zone?[e.zone]:[]);
      labels.forEach(label=>zoneLabels.push({label,types:e.tipus||[]}));
    });
    zoneLabels.forEach(({label,types:entryTypes})=>{
      if(!zones.has(label)) zones.set(label,{count:0,intensities:[],types:new Map(),sleepAffected:0,dates:new Set()});
      const z=zones.get(label); z.count++; z.intensities.push(Number(r.intensitat||0)); z.dates.add(dateOnly(r.timestamp));
      if(isSleepAffected(r))z.sleepAffected++;
      entryTypes.forEach(t=>z.types.set(PAIN_TYPE_LABELS[t]||t,(z.types.get(PAIN_TYPE_LABELS[t]||t)||0)+1));
    });
    (r.painDrawing||[]).forEach(s=>types.set(s.label||PAIN_TYPE_LABELS[s.type]||s.type,(types.get(s.label||PAIN_TYPE_LABELS[s.type]||s.type)||0)+1));
    (r.tipusDolor||[]).forEach(t=>types.set(PAIN_TYPE_LABELS[t]||t,(types.get(PAIN_TYPE_LABELS[t]||t)||0)+1));
    (r.empitjora||[]).forEach(t=>triggers.set(t,(triggers.get(t)||0)+1));
    const hour=new Date(r.timestamp).getHours();
    const moment=hour<11?"matí":hour<16?"migdia":hour<21?"tarda":"nit";
    moments.set(moment,(moments.get(moment)||0)+1);
  });

  const zoneProfiles=[...zones.entries()].map(([label,z])=>{
    const dateRows=[...z.dates].map(date=>({date,intensity:Math.max(...records.filter(r=>dateOnly(r.timestamp)===date&&(r.entries||[]).some(e=>(e.zonaLabels||[e.zoneLabel,e.zone]).filter(Boolean).includes(label))).map(r=>Number(r.intensitat||0)))}));
    function compare(predicateA,predicateB,labelA,labelB){
      const a=dateRows.filter(x=>predicateA(matrix[x.date]||{})).map(x=>x.intensity);
      const b=dateRows.filter(x=>predicateB(matrix[x.date]||{})).map(x=>x.intensity);
      if(a.length<3||b.length<3)return null;
      const meanA=average(a),meanB=average(b),diff=meanA-meanB;
      if(Math.abs(diff)<0.8)return null;
      return {labelA,labelB,nA:a.length,nB:b.length,meanA,meanB,diff};
    }
    const associations=[
      compare(d=>Number(d.son_qualitat)>=7,d=>Number(d.son_qualitat)<=3,"son dolent","son bo"),
      compare(d=>d.cicle_premenstrual===true,d=>d.cicle_premenstrual!==true,"fase premenstrual","resta de dies"),
      compare(d=>d.exercici_fet===true,d=>d.exercici_fet!==true,"dies amb exercici","dies sense exercici"),
      compare(d=>Number(d.digestiu_general)>=6||Number(d.digestiu_inflor)>=6,d=>Number(d.digestiu_general)<=3&&Number(d.digestiu_inflor)<=3,"malestar digestiu alt","malestar digestiu baix"),
    ].filter(Boolean);
    return {
      label,count:z.count,percent:Math.round(z.count/records.length*100),avg:average(z.intensities),max:Math.max(...z.intensities),
      sleepAffected:z.sleepAffected,topType:topCount(z.types),associations
    };
  }).sort((a,b)=>b.count-a.count||b.avg-a.avg);

  const avg=average(intensities),max=Math.max(...intensities),topZone=zoneProfiles[0]?[zoneProfiles[0].label,zoneProfiles[0].count]:null;
  const topType=topCount(types),topTrigger=topCount(triggers),topMoment=topCount(moments);
  const sleepAffected=records.filter(isSleepAffected).length;
  const summary=[
    `Intensitat mitjana ${avg.toFixed(1)}/10 i pic màxim ${max}/10 en ${records.length} registres.`,
    topZone?`La zona més repetida és ${topZone[0]} (${topZone[1]} registres; ${zoneProfiles[0].percent}% dels episodis).`:"Encara no hi ha prou zones seleccionades per identificar-ne una de predominant.",
    topType?`El tipus de dolor més repetit és ${topType[0]} (${topType[1]} registres o traços).`:null,
    topTrigger?`El context que coincideix més sovint amb l'empitjorament és ${topTrigger[0]} (${topTrigger[1]} registres).`:null,
    topMoment?`El moment amb més registres és el ${topMoment[0]} (${topMoment[1]} registres).`:null,
    sleepAffected?`El dolor afecta el son en ${sleepAffected} de ${records.length} registres (${Math.round(sleepAffected/records.length*100)}%).`:null,
  ].filter(Boolean);
  const recommendations=[];
  if(records.length<14)recommendations.push("Registra el dolor de manera constant durant almenys 14 dies abans d'interpretar relacions.");
  if(topTrigger)recommendations.push(`Continua marcant “${topTrigger[0]}” de manera sistemàtica per comprovar si la coincidència es manté.`);
  if(sleepAffected/records.length>=0.3)recommendations.push("Comenta amb el professional sanitari que el dolor interfereix amb el son i porta l'informe amb les dates i intensitats.");
  if(topZone)recommendations.push(`Continua registrant amb precisió “${topZone[0]}” per veure si es relaciona amb son, cicle, exercici o digestió.`);
  return { summary,recommendations,zones:zoneProfiles.slice(0,8),profile:{count:records.length,avg,max,topZone,topType,topTrigger,topMoment,sleepAffected,confidence:confidenceFromCount(records.length)} };
}

function patternText(p){
  const predictor=p.predictorType==="boolean"
    ? p.predictorLabel.toLowerCase()
    : p.predictorKey==="exercici_passos" && p.thresholds
      ? `${p.predictorLabel.toLowerCase()} ${p.thresholds.labelHigh}`
      : `${p.predictorLabel.toLowerCase()} alt`;
  const rateA=Math.round((p.effect.rateA||0)*100);
  const rateB=Math.round((p.effect.rateB||0)*100);
  const evidence=`episodis alts: ${rateA}% vs ${rateB}% (${p.nA} vs ${p.nB} dies comparables)`;
  if (p.lag === 0) {
    return `${p.predictorLabel} i ${p.outcomeLabel.toLowerCase()} tendeixen a coincidir el mateix dia; ${evidence}.`;
  }
  return `Després de ${predictor}, ${p.lag===1?"l'endemà":`al cap de ${p.lag} dies`} ${p.outcomeLabel.toLowerCase()} és més diferent del nivell de comparació; ${evidence}.`;
}

export async function generateIntelligence({start=null,end=null}={}){
  const [fullMatrix,pains,medications]=await Promise.all([buildDailyMatrix(),painRepo.getAll(),medicationRepo.getAll()]);
  const matrix=Object.fromEntries(Object.entries(fullMatrix).filter(([d])=>inRange(d,start,end)));
  const painRecords=pains.filter(p=>inRange(dateOnly(p.timestamp),start,end)).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  const medRecords=medications.filter(m=>inRange(dateOnly(m.timestamp),start,end));
  const dates=Object.keys(matrix).sort();
  const correlations=computeCorrelations(matrix),weekly=computeDayOfWeekPatterns(matrix),trends=computeTrends(matrix);
  const {triggers,protectors}=classifyConclusions(correlations);
  const pain=painSpecificInsights(painRecords,matrix);
  const flares=detectFlares(matrix);
  const medication=analyzeMedicationResponse(medRecords,painRecords);
  const cycle=analyzeCyclePatterns(matrix);
  const temporal=analyzeTemporalPatterns(matrix);
  const strongest=correlations.slice(0,5).map(p=>({...p,text:patternText(p)}));
  const conclusions=[
    ...triggers.slice(0,4).map(p=>({kind:"trigger",text:patternText(p),confidence:p.confidence.label,recommendation:p.recommendation})),
    ...protectors.slice(0,4).map(p=>({kind:"protector",text:patternText(p),confidence:p.confidence.label,recommendation:p.recommendation})),
  ];
  const recommendations=[...new Set([
    ...cycle.tracking.slice(0,3).map(item=>item.trackingText),
    ...pain.recommendations,
    ...conclusions.map(c=>c.recommendation).filter(Boolean),
    flares.length?"Quan aparegui un brot, registra son, digestió, dolor, energia i medicació el mateix dia per poder comparar-lo amb brots anteriors.":null,
    dates.length<14?"Completa el check-in, el son i el dolor el mateix dia; no es mostraran hipòtesis fins que hi hagi almenys 14 dies.":null,
    "Interpreta aquests resultats com associacions observades, no com causes demostrades ni diagnòstics."
  ].filter(Boolean))].slice(0,10);
  return {
    period:{start:start||dates[0]||null,end:end||dates.at(-1)||null,days:dates.length},
    dataQuality:{level:confidenceFromCount(dates.length),days:dates.length,painRecords:painRecords.length,minimumReached:dates.length>=14},
    pain,patterns:strongest,weekly:weekly.slice(0,5),trends:trends.slice(0,5),conclusions,recommendations,correlations,triggers,protectors,
    flares:flares.slice(0,8),medication,cycle,temporal
  };
}
