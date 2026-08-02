function average(values) {
  return values.length ? values.reduce((a,b) => a+b,0) / values.length : null;
}

/**
 * Compara la intensitat de dolor registrada abans i després d'una presa.
 * Només mostra resultats amb almenys tres preses comparables.
 */
export function analyzeMedicationResponse(medications, painRecords) {
  const pains = painRecords
    .filter(p => p.timestamp && Number.isFinite(Number(p.intensitat)))
    .map(p => ({ time: new Date(p.timestamp).getTime(), value: Number(p.intensitat) }))
    .sort((a,b) => a.time-b.time);
  const groups = new Map();

  medications.forEach(m => {
    if (!m.timestamp || !m.nom) return;
    const time = new Date(m.timestamp).getTime();
    const before = pains.filter(p => p.time <= time && time - p.time <= 6 * 3600000).at(-1);
    const after = pains.find(p => p.time > time && p.time - time <= 8 * 3600000);
    if (!before || !after) return;
    const key = m.nom.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: m.nom.trim(), pairs: [] });
    groups.get(key).pairs.push({ before: before.value, after: after.value, change: after.value - before.value });
  });

  return [...groups.values()].filter(g => g.pairs.length >= 3).map(g => {
    const before = average(g.pairs.map(p => p.before));
    const after = average(g.pairs.map(p => p.after));
    const change = after - before;
    const improved = g.pairs.filter(p => p.change <= -2).length;
    const worsened = g.pairs.filter(p => p.change >= 2).length;
    const confidence = g.pairs.length >= 10 ? "moderada" : "preliminar";
    return { name: g.name, count: g.pairs.length, before, after, change, improved, worsened, confidence };
  }).sort((a,b) => Math.abs(b.change) - Math.abs(a.change));
}
