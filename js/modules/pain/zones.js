/**
 * Mapa corporal detallat per al registre de dolor.
 * Les zones continuen sent predefinides per poder-les analitzar estadísticament.
 * ViewBox compartit: 240 × 480.
 */
export const ZONES_FRONT = [
  { id: "cap_front", label: "Cap", shape: "ellipse", cx: 120, cy: 31, rx: 22, ry: 27 },
  { id: "coll_front", label: "Coll (davant)", x: 106, y: 56, w: 28, h: 22, rx: 8 },
  { id: "pit_centre", label: "Pit / estèrnum", x: 94, y: 83, w: 52, h: 64, rx: 18 },
  { id: "costat_esquerre_front", label: "Costat esquerre / costelles", x: 69, y: 96, w: 27, h: 82, rx: 12 },
  { id: "costat_dret_front", label: "Costat dret / costelles", x: 144, y: 96, w: 27, h: 82, rx: 12 },
  { id: "abdomen", label: "Abdomen", x: 94, y: 148, w: 52, h: 58, rx: 16 },
  { id: "espatlla_esquerra", label: "Espatlla esquerra", x: 55, y: 72, w: 42, h: 27, rx: 13 },
  { id: "espatlla_dreta", label: "Espatlla dreta", x: 143, y: 72, w: 42, h: 27, rx: 13 },
  { id: "brac_esquerre", label: "Braç esquerre", x: 38, y: 96, w: 27, h: 77, rx: 13 },
  { id: "brac_dret", label: "Braç dret", x: 175, y: 96, w: 27, h: 77, rx: 13 },
  { id: "avantbrac_esquerre", label: "Avantbraç esquerre", x: 27, y: 166, w: 25, h: 72, rx: 12 },
  { id: "avantbrac_dret", label: "Avantbraç dret", x: 188, y: 166, w: 25, h: 72, rx: 12 },
  { id: "ma_esquerra", label: "Mà esquerra", x: 16, y: 229, w: 38, h: 31, rx: 13 },
  { id: "ma_dreta", label: "Mà dreta", x: 186, y: 229, w: 38, h: 31, rx: 13 },
  { id: "maluc_esquerre", label: "Maluc esquerre", x: 75, y: 199, w: 44, h: 38, rx: 16 },
  { id: "maluc_dret", label: "Maluc dret", x: 121, y: 199, w: 44, h: 38, rx: 16 },
  { id: "cuixa_esquerra", label: "Cuixa esquerra", x: 78, y: 232, w: 38, h: 92, rx: 18 },
  { id: "cuixa_dreta", label: "Cuixa dreta", x: 124, y: 232, w: 38, h: 92, rx: 18 },
  { id: "genoll_esquerre", label: "Genoll esquerre", shape: "ellipse", cx: 97, cy: 330, rx: 19, ry: 16 },
  { id: "genoll_dret", label: "Genoll dret", shape: "ellipse", cx: 143, cy: 330, rx: 19, ry: 16 },
  { id: "cama_esquerra", label: "Cama esquerra", x: 82, y: 343, w: 31, h: 78, rx: 14 },
  { id: "cama_dreta", label: "Cama dreta", x: 127, y: 343, w: 31, h: 78, rx: 14 },
  { id: "turmell_esquerre", label: "Turmell esquerre", x: 82, y: 412, w: 31, h: 23, rx: 10 },
  { id: "turmell_dret", label: "Turmell dret", x: 127, y: 412, w: 31, h: 23, rx: 10 },
  { id: "peu_esquerre", label: "Peu esquerre", x: 74, y: 430, w: 42, h: 24, rx: 10 },
  { id: "peu_dret", label: "Peu dret", x: 124, y: 430, w: 42, h: 24, rx: 10 },
];

export const ZONES_BACK = [
  { id: "cap_post", label: "Cap (darrere)", shape: "ellipse", cx: 120, cy: 31, rx: 22, ry: 27 },
  { id: "cervical", label: "Cervicals", x: 104, y: 55, w: 32, h: 28, rx: 10 },
  { id: "trapezi_esquerre", label: "Trapezi esquerre", x: 66, y: 72, w: 43, h: 31, rx: 13 },
  { id: "trapezi_dret", label: "Trapezi dret", x: 131, y: 72, w: 43, h: 31, rx: 13 },
  { id: "omoplat_esquerre", label: "Omòplat esquerre", x: 72, y: 98, w: 39, h: 58, rx: 15 },
  { id: "omoplat_dret", label: "Omòplat dret", x: 129, y: 98, w: 39, h: 58, rx: 15 },
  { id: "columna_dorsal_alta", label: "Columna dorsal alta", x: 109, y: 83, w: 22, h: 48, rx: 10 },
  { id: "columna_dorsal_mitjana", label: "Columna dorsal mitjana", x: 109, y: 128, w: 22, h: 48, rx: 10 },
  { id: "columna_dorsal_baixa", label: "Columna dorsal baixa", x: 109, y: 173, w: 22, h: 39, rx: 10 },
  { id: "costat_esquerre_post", label: "Costat esquerre / costelles (darrere)", x: 72, y: 150, w: 37, h: 60, rx: 14 },
  { id: "costat_dret_post", label: "Costat dret / costelles (darrere)", x: 131, y: 150, w: 37, h: 60, rx: 14 },
  { id: "lumbar", label: "Zona lumbar", x: 91, y: 205, w: 58, h: 42, rx: 15 },
  { id: "espatlla_esquerra_post", label: "Espatlla esquerra", x: 55, y: 75, w: 38, h: 27, rx: 13 },
  { id: "espatlla_dreta_post", label: "Espatlla dreta", x: 147, y: 75, w: 38, h: 27, rx: 13 },
  { id: "brac_esquerre_post", label: "Braç esquerre", x: 38, y: 99, w: 27, h: 74, rx: 13 },
  { id: "brac_dret_post", label: "Braç dret", x: 175, y: 99, w: 27, h: 74, rx: 13 },
  { id: "avantbrac_esquerre_post", label: "Avantbraç esquerre", x: 27, y: 166, w: 25, h: 72, rx: 12 },
  { id: "avantbrac_dret_post", label: "Avantbraç dret", x: 188, y: 166, w: 25, h: 72, rx: 12 },
  { id: "ma_esquerra_post", label: "Mà esquerra", x: 16, y: 229, w: 38, h: 31, rx: 13 },
  { id: "ma_dreta_post", label: "Mà dreta", x: 186, y: 229, w: 38, h: 31, rx: 13 },
  { id: "natja_esquerra", label: "Natja / maluc esquerre", x: 75, y: 235, w: 44, h: 42, rx: 18 },
  { id: "natja_dreta", label: "Natja / maluc dret", x: 121, y: 235, w: 44, h: 42, rx: 18 },
  { id: "cuixa_esquerra_post", label: "Cuixa esquerra (darrere)", x: 78, y: 275, w: 38, h: 72, rx: 18 },
  { id: "cuixa_dreta_post", label: "Cuixa dreta (darrere)", x: 124, y: 275, w: 38, h: 72, rx: 18 },
  { id: "bessons_esquerre", label: "Bessó / tendó esquerre", x: 82, y: 348, w: 31, h: 76, rx: 14 },
  { id: "bessons_dret", label: "Bessó / tendó dret", x: 127, y: 348, w: 31, h: 76, rx: 14 },
  { id: "taló_esquerre", label: "Taló / peu esquerre", x: 76, y: 420, w: 39, h: 32, rx: 12 },
  { id: "taló_dret", label: "Taló / peu dret", x: 125, y: 420, w: 39, h: 32, rx: 12 },
];

const ALL_ZONES = [...ZONES_FRONT, ...ZONES_BACK];
export function zoneLabel(id) {
  return ALL_ZONES.find(z => z.id === id)?.label || id;
}

function outlineSvg(view) {
  const head = `<ellipse class="bodymap-person" cx="120" cy="31" rx="22" ry="27"/>`;
  const neck = `<path class="bodymap-person" d="M106 55 L104 72 Q120 82 136 72 L134 55"/>`;
  const torso = view === "back"
    ? `<path class="bodymap-person" d="M104 70 Q82 70 64 86 Q55 108 63 145 Q72 181 82 220 Q94 239 120 239 Q146 239 158 220 Q168 181 177 145 Q185 108 176 86 Q158 70 136 70 Z"/>`
    : `<path class="bodymap-person" d="M104 70 Q82 70 64 86 Q58 112 66 149 Q74 184 82 220 Q95 239 120 239 Q145 239 158 220 Q166 184 174 149 Q182 112 176 86 Q158 70 136 70 Z"/>`;
  const arms = `<path class="bodymap-person" d="M66 88 Q48 91 40 113 L27 186 L15 238 Q14 251 26 258 Q40 260 50 244 L58 181 L70 113"/>
    <path class="bodymap-person" d="M174 88 Q192 91 200 113 L213 186 L225 238 Q226 251 214 258 Q200 260 190 244 L182 181 L170 113"/>`;
  const legs = `<path class="bodymap-person" d="M82 220 Q75 250 78 296 L82 375 L76 438 Q75 454 91 457 Q108 457 113 441 L116 348 L118 245"/>
    <path class="bodymap-person" d="M158 220 Q165 250 162 296 L158 375 L164 438 Q165 454 149 457 Q132 457 127 441 L124 348 L122 245"/>`;
  return `${head}${neck}${torso}${arms}${legs}<path class="bodymap-spine" d="M120 78 L120 226"/>`;
}

function shapeForZone(z, cls) {
  const common = `class="zone-shape ${cls}" data-zone-id="${z.id}"`;
  if (z.shape === "ellipse") {
    return `<ellipse ${common} cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}"><title>${z.label}</title></ellipse>`;
  }
  return `<rect ${common} x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${z.rx ?? 6}"><title>${z.label}</title></rect>`;
}

export function renderBodyMapSvg(view, activeZones = [], pickingZones = [], drawingStrokes = []) {
  const zones = view === "back" ? ZONES_BACK : ZONES_FRONT;
  const shapes = zones.map(z => {
    const cls = pickingZones.includes(z.id) ? "zone-picking" : (activeZones.includes(z.id) ? "zone-active" : "");
    return shapeForZone(z, cls);
  }).join("");
  const strokes = drawingStrokes
    .filter(stroke => stroke.view === view && Array.isArray(stroke.points) && stroke.points.length > 0)
    .map(stroke => {
      const points = stroke.points.map(p => `${Number(p.x).toFixed(1)},${Number(p.y).toFixed(1)}`).join(" ");
      return `<polyline class="pain-stroke" points="${points}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round" opacity="0.72" data-stroke-id="${stroke.id}"/>`;
    }).join("");
  return `<svg class="bodymap-detailed" viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg" aria-label="Mapa corporal ${view === "back" ? "posterior" : "frontal"}">
    ${outlineSvg(view)}
    ${shapes}
    <g class="pain-drawing-layer">${strokes}</g>
  </svg>`;
}
