export const PAIN_DRAWING_COLORS = Object.freeze({
  punxant: "#C62828",
  cremor: "#EF7B45",
  pressio: "#7D6CCF",
  contractura: "#C94F72",
  rigidesa: "#6F8FAE",
  descarrega: "#D9A21B",
  difus: "#E78FB3",
});

const LABEL_TO_TYPE = Object.freeze({
  "punxant": "punxant",
  "punxant / ganivet": "punxant",
  "cremor": "cremor",
  "pressió / opressiu": "pressio",
  "pressio": "pressio",
  "contractura": "contractura",
  "rigidesa": "rigidesa",
  "descàrrega / elèctric": "descarrega",
  "elèctric / descàrrega": "descarrega",
  "descarrega": "descarrega",
  "dolor difús": "difus",
  "sord (mal difús)": "difus",
  "difus": "difus",
});

export function canonicalPainType(typeOrLabel) {
  const key = String(typeOrLabel || "").trim().toLowerCase();
  return PAIN_DRAWING_COLORS[key] ? key : (LABEL_TO_TYPE[key] || "");
}

export function painColorForStroke(stroke, fallback = "#777777") {
  const type = canonicalPainType(stroke?.type) || canonicalPainType(stroke?.label);
  return type ? PAIN_DRAWING_COLORS[type] : (stroke?.color || fallback);
}

export function normalizePainStroke(stroke) {
  const color = painColorForStroke(stroke);
  return color === stroke?.color ? stroke : { ...stroke, color };
}
