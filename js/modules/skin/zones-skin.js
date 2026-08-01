import { ZONES_FRONT as PAIN_FRONT, ZONES_BACK as PAIN_BACK } from "../pain/zones.js";

const HEAD = { id: "cap_cara", label: "Cap / cara", x: 98, y: 8, w: 44, h: 44 };
const HAND_L_FRONT = { id: "ma_esquerra", label: "Mà esquerra", x: 20, y: 233, w: 22, h: 22 };
const HAND_R_FRONT = { id: "ma_dreta", label: "Mà dreta", x: 198, y: 233, w: 22, h: 22 };
const HAND_L_BACK = { id: "ma_esquerra_post", label: "Mà esquerra", x: 20, y: 233, w: 22, h: 22 };
const HAND_R_BACK = { id: "ma_dreta_post", label: "Mà dreta", x: 198, y: 233, w: 22, h: 22 };

export const SKIN_ZONES_FRONT = [HEAD, ...PAIN_FRONT, HAND_L_FRONT, HAND_R_FRONT];
export const SKIN_ZONES_BACK = [HEAD, ...PAIN_BACK, HAND_L_BACK, HAND_R_BACK];

const ALL = [...SKIN_ZONES_FRONT, ...SKIN_ZONES_BACK];
export function skinZoneLabel(id) {
  return ALL.find(z => z.id === id)?.label || id;
}

function outlineSvg() {
  return `<rect class="bodymap-outline" x="70" y="66" width="100" height="140" rx="10" />`;
}

export function renderSkinBodyMapSvg(view, selectedZones = []) {
  const zones = view === "back" ? SKIN_ZONES_BACK : SKIN_ZONES_FRONT;
  const shapes = zones.map(z => `
    <rect class="zone-shape ${selectedZones.includes(z.id) ? "zone-active" : ""}"
          data-zone-id="${z.id}"
          x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${z.id === "cap_cara" ? 22 : 6}">
      <title>${z.label}</title>
    </rect>
  `).join("");
  return `
    <svg viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg">
      ${outlineSvg()}
      ${shapes}
    </svg>
  `;
}
