/**
 * Zones predefinides del mapa corporal, en lloc de coordenades lliures:
 * més robust per poder-les creuar estadísticament al motor de patrons.
 * Coordenades dins un viewBox comú de 240x480.
 */
export const ZONES_FRONT = [
  { id: "coll", label: "Coll", x: 103, y: 50, w: 34, h: 16 },
  { id: "espatlla_esquerra", label: "Espatlla esquerra", x: 40, y: 66, w: 35, h: 25 },
  { id: "espatlla_dreta", label: "Espatlla dreta", x: 165, y: 66, w: 35, h: 25 },
  { id: "brac_esquerre", label: "Braç esquerre", x: 30, y: 95, w: 28, h: 70 },
  { id: "brac_dret", label: "Braç dret", x: 182, y: 95, w: 28, h: 70 },
  { id: "avantbrac_esquerre", label: "Avantbraç esquerre", x: 25, y: 168, w: 26, h: 65 },
  { id: "avantbrac_dret", label: "Avantbraç dret", x: 189, y: 168, w: 26, h: 65 },
  { id: "maluc_esquerre", label: "Maluc esquerre", x: 75, y: 206, w: 44, h: 30 },
  { id: "maluc_dret", label: "Maluc dret", x: 121, y: 206, w: 44, h: 30 },
  { id: "cuixa_esquerra", label: "Cuixa esquerra", x: 75, y: 236, w: 42, h: 90 },
  { id: "cuixa_dreta", label: "Cuixa dreta", x: 123, y: 236, w: 42, h: 90 },
  { id: "genoll_esquerre", label: "Genoll esquerre", x: 78, y: 326, w: 36, h: 20 },
  { id: "genoll_dret", label: "Genoll dret", x: 126, y: 326, w: 36, h: 20 },
  { id: "cama_esquerra", label: "Cama esquerra", x: 78, y: 346, w: 36, h: 80 },
  { id: "cama_dreta", label: "Cama dreta", x: 126, y: 346, w: 36, h: 80 },
  { id: "peu_esquerre", label: "Peu esquerre", x: 70, y: 426, w: 44, h: 20 },
  { id: "peu_dret", label: "Peu dret", x: 126, y: 426, w: 44, h: 20 },
];

export const ZONES_BACK = [
  { id: "cervical", label: "Cervical", x: 103, y: 50, w: 34, h: 20 },
  { id: "espatlla_esquerra_post", label: "Espatlla esquerra", x: 40, y: 66, w: 35, h: 25 },
  { id: "espatlla_dreta_post", label: "Espatlla dreta", x: 165, y: 66, w: 35, h: 25 },
  { id: "brac_esquerre_post", label: "Braç esquerre", x: 30, y: 95, w: 28, h: 70 },
  { id: "brac_dret_post", label: "Braç dret", x: 182, y: 95, w: 28, h: 70 },
  { id: "dorsal", label: "Dorsal", x: 80, y: 90, w: 80, h: 55 },
  { id: "avantbrac_esquerre_post", label: "Avantbraç esquerre", x: 25, y: 168, w: 26, h: 65 },
  { id: "avantbrac_dret_post", label: "Avantbraç dret", x: 189, y: 168, w: 26, h: 65 },
  { id: "lumbar", label: "Lumbar", x: 83, y: 145, w: 74, h: 45 },
  { id: "natja_esquerra", label: "Natja / maluc esquerre (ciàtica)", x: 75, y: 190, w: 44, h: 35 },
  { id: "natja_dreta", label: "Natja / maluc dret (ciàtica)", x: 121, y: 190, w: 44, h: 35 },
  { id: "cuixa_esquerra_post", label: "Cuixa esquerra", x: 75, y: 236, w: 42, h: 90 },
  { id: "cuixa_dreta_post", label: "Cuixa dreta", x: 123, y: 236, w: 42, h: 90 },
  { id: "cama_esquerra_post", label: "Cama esquerra", x: 78, y: 346, w: 36, h: 80 },
  { id: "cama_dreta_post", label: "Cama dreta", x: 126, y: 346, w: 36, h: 80 },
];

const ALL_ZONES = [...ZONES_FRONT, ...ZONES_BACK];
export function zoneLabel(id) {
  return ALL_ZONES.find(z => z.id === id)?.label || id;
}

function outlineSvg() {
  // Silueta esquemàtica de referència (no clicable): cap + tronc.
  return `
    <circle class="bodymap-outline" cx="120" cy="30" r="22" />
    <rect class="bodymap-outline" x="70" y="66" width="100" height="140" rx="10" />
  `;
}

export function renderBodyMapSvg(view, activeZones = [], pickingZones = []) {
  const zones = view === "back" ? ZONES_BACK : ZONES_FRONT;
  const shapes = zones.map(z => {
    const cls = pickingZones.includes(z.id) ? "zone-picking" : (activeZones.includes(z.id) ? "zone-active" : "");
    return `
    <rect class="zone-shape ${cls}"
          data-zone-id="${z.id}"
          x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="6">
      <title>${z.label}</title>
    </rect>
  `;
  }).join("");
  return `
    <svg viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg">
      ${outlineSvg()}
      ${shapes}
    </svg>
  `;
}
