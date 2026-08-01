/**
 * Icones esquemàtiques (no fotogràfiques) per a cada tipus de l'escala de
 * Bristol — igual que la Bristol Stool Chart mèdica original, que també és
 * un dibuix esquemàtic i no una fotografia.
 */
function icon(shapes) {
  return `<svg viewBox="0 0 64 32" xmlns="http://www.w3.org/2000/svg" class="bristol-icon-svg">${shapes}</svg>`;
}

const S = 'fill="var(--sage)" fill-opacity="0.28" stroke="var(--ink-soft)" stroke-width="1.4"';

const ICONS = {
  1: icon(`
    <circle cx="12" cy="16" r="7" ${S}/>
    <circle cx="29" cy="16" r="7" ${S}/>
    <circle cx="46" cy="16" r="7" ${S}/>
  `),
  2: icon(`
    <path d="M6,16 C6,8 58,8 58,16 C58,24 6,24 6,16 Z" ${S}/>
    <path d="M17,9 C15,13 15,19 17,23" fill="none" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
    <path d="M32,8 C30,13 30,19 32,24" fill="none" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
    <path d="M47,9 C45,13 45,19 47,23" fill="none" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
  `),
  3: icon(`
    <rect x="6" y="10" width="52" height="12" rx="6" ${S}/>
    <path d="M20,10 L18,22" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
    <path d="M34,10 L32,22" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
    <path d="M46,10 L44,22" stroke="var(--ink-soft)" stroke-width="1" opacity="0.5"/>
  `),
  4: icon(`
    <rect x="4" y="11" width="56" height="10" rx="5" ${S}/>
  `),
  5: icon(`
    <ellipse cx="14" cy="17" rx="9" ry="7" ${S}/>
    <ellipse cx="32" cy="15" rx="9" ry="7" ${S}/>
    <ellipse cx="50" cy="17" rx="9" ry="7" ${S}/>
  `),
  6: icon(`
    <path d="M4,18 C6,10 16,9 20,14 C24,8 34,9 36,15 C40,9 50,10 52,16 C58,14 60,20 56,23 C50,27 40,24 34,25 C28,27 18,26 12,24 C6,25 2,22 4,18 Z" ${S}/>
  `),
  7: icon(`
    <path d="M4,12 C10,18 14,8 20,14 C26,20 30,8 36,14 C42,20 46,8 52,14 C56,18 58,12 60,14"
          fill="none" stroke="var(--ink-soft)" stroke-width="2"/>
    <path d="M4,20 C10,26 14,16 20,22 C26,28 30,16 36,22 C42,28 46,16 52,22 C56,26 58,20 60,22"
          fill="none" stroke="var(--ink-soft)" stroke-width="2" opacity="0.6"/>
  `),
};

export function bristolIconSvg(type) {
  return ICONS[type] || "";
}
