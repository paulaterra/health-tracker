import { VARIABLE_META } from "./normalizer.js";

/**
 * Normalitza una variable a un valor 0-1 on 1 = bé i 0 = malament,
 * segons el seu tipus i valència (si alt és bo o dolent).
 */
function normalize(key, value) {
  const meta = VARIABLE_META[key];
  if (!meta?.valence) return null;
  if (meta.type === "boolean") {
    // Presència d'un símptoma negatiu = dolent; no hi ha variables booleanes positives encara.
    return value ? 0 : 1;
  }
  // numèric 0-10
  const norm = value / 10;
  return meta.valence === "positive" ? norm : 1 - norm;
}

/** Calcula l'índex de benestar (0-100) per a cada dia amb prou dades. */
export function computeWellbeingByDay(matrix) {
  const result = {};
  for (const date of Object.keys(matrix)) {
    const day = matrix[date];
    const scores = [];
    for (const key of Object.keys(day)) {
      const n = normalize(key, day[key]);
      if (n != null) scores.push(n);
    }
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    result[date] = Math.round(avg * 100);
  }
  return result;
}

/** Mitjana de l'índex de benestar en els últims N dies amb dades (no calendaris buits). */
export function averageWellbeing(byDay, dates) {
  const vals = dates.map(d => byDay[d]).filter(v => v != null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function wellbeingColor(score) {
  if (score == null) return "var(--line-strong)";
  if (score >= 70) return "var(--sage)";
  if (score >= 45) return "var(--amber)";
  return "var(--clay)";
}
