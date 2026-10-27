import { svg } from './dom';

// Line icons drawn for this app (24px grid, stroke = currentColor).
const P: Record<string, string> = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>',
  room: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4"/>',
  wall: '<path d="M3 18L12 6l9 12"/><circle cx="3" cy="18" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="21" cy="18" r="1.5"/>',
  pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  rotate: '<path d="M20 12a8 8 0 11-2.3-5.7"/><path d="M20 4v5h-5"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  plan: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h8v9M11 3v5M15 12h6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  flip: '<path d="M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
};

export function icon(name: keyof typeof P | string, size = 20): SVGElement {
  return svg(
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`,
  );
}

/** BMT Plan mark: a navy tile, an amber roof line, and the BMT monogram. */
export const LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BMT Plan">
  <rect width="64" height="64" rx="14" fill="#14284b"/>
  <path d="M11 27L32 11l21 16" fill="none" stroke="#f28c28" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="32" y="50" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="0.5" fill="#ffffff">BMT</text>
</svg>`;

export function logo(size = 36): SVGElement {
  const el = svg(LOGO_SVG);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  return el;
}
