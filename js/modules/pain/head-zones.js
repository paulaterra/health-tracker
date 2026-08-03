/**
 * Detall posterior del cap i la part alta del coll.
 * Les zones tenen identificadors estables per poder analitzar-les estadísticament.
 * ViewBox compartit amb el mapa corporal: 240 × 480.
 */
const HEAD_ZONE_LABELS = {
  occipital_superior: "Occipital superior",
  occipital_esquerre: "Occipital esquerre",
  occipital_dret: "Occipital dret",
  suboccipital_esquerre: "Suboccipital esquerre",
  suboccipital_dret: "Suboccipital dret",
  darrere_orella_esquerra: "Darrere de l’orella esquerra",
  darrere_orella_dreta: "Darrere de l’orella dreta",
  coll_superior_esquerre: "Coll superior esquerre",
  coll_superior_centre: "Coll superior central",
  coll_superior_dret: "Coll superior dret",
  // Etiquetes antigues, per conservar la lectura de registres previs.
  crown: "Part superior / coroneta",
  occipital: "Nuca / occipital",
  neck_left: "Coll esquerre",
  neck_right: "Coll dret",
};

export function headZoneLabel(id) {
  return HEAD_ZONE_LABELS[id] || id;
}

function zone(id, path, stateClass) {
  return `<path class="zone-shape${stateClass(id)}" data-zone-id="head_${id}" d="${path}"><title>${HEAD_ZONE_LABELS[id]}</title></path>`;
}

export function renderHeadMapSvg(view = "head_back", selected = [], picking = [], strokes = []) {
  const active = new Set(selected);
  const pending = new Set(picking);
  const stateClass = (id) => {
    const full = `head_${id}`;
    return active.has(full) || active.has(id) ? " zone-active" : pending.has(full) || pending.has(id) ? " zone-picking" : "";
  };

  const shapes = [
    zone("occipital_superior", "M55 112 Q120 55 185 112 L178 158 Q120 132 62 158 Z", stateClass),
    zone("occipital_esquerre", "M62 151 Q89 132 119 143 L119 223 Q88 229 67 204 Z", stateClass),
    zone("occipital_dret", "M121 143 Q151 132 178 151 L173 204 Q152 229 121 223 Z", stateClass),
    zone("suboccipital_esquerre", "M68 202 Q92 218 119 216 L119 266 Q92 268 73 246 Z", stateClass),
    zone("suboccipital_dret", "M121 216 Q148 218 172 202 L167 246 Q148 268 121 266 Z", stateClass),
    zone("darrere_orella_esquerra", "M48 164 Q61 160 69 180 L70 225 Q56 233 48 213 Z", stateClass),
    zone("darrere_orella_dreta", "M192 164 Q179 160 171 180 L170 225 Q184 233 192 213 Z", stateClass),
    zone("coll_superior_esquerre", "M74 245 Q93 263 112 267 L108 385 L69 385 Z", stateClass),
    zone("coll_superior_centre", "M112 263 Q120 270 128 263 L136 385 L104 385 Z", stateClass),
    zone("coll_superior_dret", "M128 267 Q147 263 166 245 L171 385 L132 385 Z", stateClass),
  ].join("");

  const viewStrokes = (strokes || [])
    .filter((stroke) => stroke.view === "head_back")
    .map((stroke) => `<polyline class="pain-stroke" data-stroke-id="${stroke.id}" points="${(stroke.points || []).map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${stroke.color || "#d84a42"}" stroke-width="${stroke.size || 12}" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/>`)
    .join("");

  return `<svg class="bodymap-svg headmap-svg headmap-back-detailed" viewBox="0 0 240 480" role="img" aria-label="Mapa posterior detallat del cap i el coll">
    <g class="body-base head-back-outline">
      <path d="M55 112 Q62 45 120 35 Q178 45 185 112 L180 210 Q171 251 145 273 L140 305 L100 305 L95 273 Q69 251 60 210 Z"/>
      <path d="M49 157 Q35 158 36 187 Q38 217 52 225"/>
      <path d="M191 157 Q205 158 204 187 Q202 217 188 225"/>
      <path d="M98 287 L70 415 M142 287 L170 415"/>
    </g>
    ${shapes}
    <g class="pain-drawing-layer">${viewStrokes}</g>
  </svg>`;
}
