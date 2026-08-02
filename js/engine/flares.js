import { VARIABLE_META } from "./normalizer.js";

const NEGATIVE_NUMERIC_THRESHOLD = 6;
const POSITIVE_NUMERIC_LOW = 3;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daySignals(day = {}) {
  const categories = new Map();
  for (const [key, value] of Object.entries(day)) {
    const meta = VARIABLE_META[key];
    if (!meta || value == null) continue;
    let active = false;
    if (meta.type === "boolean") active = value === true && meta.valence !== "positive";
    else if (meta.valence === "positive") active = Number(value) <= POSITIVE_NUMERIC_LOW;
    else if (meta.valence === "negative") active = Number(value) >= NEGATIVE_NUMERIC_THRESHOLD;
    if (!active) continue;
    const category = meta.category || "Altres";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(meta.label);
  }
  return categories;
}

/**
 * Detecta brots multisimptomàtics: almenys dos dominis alterats durant
 * dos dies consecutius. Un dia aïllat no es considera brot.
 */
export function detectFlares(matrix) {
  const dates = Object.keys(matrix).sort();
  if (!dates.length) return [];
  const active = dates.map(date => ({ date, categories: daySignals(matrix[date]) }))
    .filter(x => x.categories.size >= 2);

  const groups = [];
  let current = [];
  for (const item of active) {
    if (!current.length || item.date === addDays(current.at(-1).date, 1)) current.push(item);
    else {
      if (current.length >= 2) groups.push(current);
      current = [item];
    }
  }
  if (current.length >= 2) groups.push(current);

  return groups.map(group => {
    const categoryCounts = new Map();
    const signalCounts = new Map();
    group.forEach(day => day.categories.forEach((labels, category) => {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      labels.forEach(label => signalCounts.set(label, (signalCounts.get(label) || 0) + 1));
    }));
    const categories = [...categoryCounts.entries()].sort((a,b) => b[1]-a[1]);
    const signals = [...signalCounts.entries()].sort((a,b) => b[1]-a[1]);
    const maxDomains = Math.max(...group.map(x => x.categories.size));
    const severity = maxDomains >= 4 || group.length >= 5 ? "alta" : maxDomains >= 3 || group.length >= 3 ? "moderada" : "baixa";
    return {
      start: group[0].date,
      end: group.at(-1).date,
      days: group.length,
      maxDomains,
      severity,
      categories: categories.map(([label, count]) => ({ label, count })),
      signals: signals.slice(0, 6).map(([label, count]) => ({ label, count })),
    };
  }).sort((a,b) => b.start.localeCompare(a.start));
}
