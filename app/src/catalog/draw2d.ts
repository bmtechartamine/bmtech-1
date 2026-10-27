import type { Shape } from './catalog';

/**
 * Top view of a piece of furniture, centred on (0, 0), in centimetres.
 * The front of the piece faces +y. `px` is one screen pixel in cm, for line widths.
 */
export function drawTopView(ctx: CanvasRenderingContext2D, shape: Shape, w: number, d: number, color: string, px: number) {
  const x0 = -w / 2;
  const y0 = -d / 2;
  const line = '#3b4556';
  ctx.lineWidth = 1.2 * px;
  ctx.strokeStyle = line;
  ctx.fillStyle = color;

  const box = (x: number, y: number, bw: number, bd: number, fill = color, r = 0) => {
    ctx.beginPath();
    if (r > 0 && 'roundRect' in ctx) ctx.roundRect(x, y, bw, bd, Math.min(r, bw / 2, bd / 2));
    else ctx.rect(x, y, bw, bd);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  const circle = (cx: number, cy: number, r: number, fill = color) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  const lighter = shade(color, 0.25);
  const darker = shade(color, -0.18);

  switch (shape) {
    case 'sofa':
    case 'armchair': {
      const arm = Math.min(18, w * 0.15);
      box(x0, y0, w, d, darker, 6);
      box(x0 + arm, y0 + d * 0.28, w - arm * 2, d * 0.72 - 4, lighter, 4);
      const seats = shape === 'sofa' ? Math.max(2, Math.round((w - arm * 2) / 70)) : 1;
      const sw = (w - arm * 2) / seats;
      for (let i = 1; i < seats; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + arm + sw * i, y0 + d * 0.3);
        ctx.lineTo(x0 + arm + sw * i, y0 + d - 6);
        ctx.stroke();
      }
      break;
    }
    case 'bed': {
      box(x0, y0, w, d, darker, 4);
      box(x0 + 4, y0 + 4, w - 8, d - 8, '#fbfaf7', 3);
      const pillows = w > 120 ? 2 : 1;
      const pw = (w - 8 - 6 * (pillows + 1)) / pillows;
      for (let i = 0; i < pillows; i++) box(x0 + 10 + i * (pw + 6), y0 + 10, pw, 32, lighter, 8);
      box(x0 + 4, y0 + d * 0.42, w - 8, d * 0.58 - 4, color, 3);
      break;
    }
    case 'table':
    case 'desk':
    case 'coffee-table':
    case 'nightstand':
    case 'dresser':
    case 'tv-unit':
    case 'counter':
    case 'kitchen-island':
      box(x0, y0, w, d, color, shape === 'coffee-table' ? 6 : 2);
      if (shape === 'dresser' || shape === 'tv-unit') {
        ctx.beginPath();
        ctx.moveTo(x0, y0 + d - 4);
        ctx.lineTo(x0 + w, y0 + d - 4);
        ctx.stroke();
      }
      if (shape === 'counter' || shape === 'kitchen-island') {
        ctx.beginPath();
        ctx.moveTo(x0 + 3, y0 + 3);
        ctx.lineTo(x0 + w - 3, y0 + 3);
        ctx.stroke();
      }
      break;
    case 'round-table':
      circle(0, 0, Math.min(w, d) / 2);
      break;
    case 'chair':
    case 'office-chair':
      if (shape === 'office-chair') circle(0, 0, Math.min(w, d) / 2, darker);
      box(x0 + 3, y0 + 3, w - 6, d - 6, lighter, 6);
      box(x0 + 3, y0, w - 6, 8, color, 3);
      break;
    case 'bookshelf':
    case 'wardrobe':
      box(x0, y0, w, d, color);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w, y0 + d);
      ctx.moveTo(x0 + w, y0);
      ctx.lineTo(x0, y0 + d);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'sink-counter':
      box(x0, y0, w, d, color, 2);
      box(x0 + w * 0.18, y0 + d * 0.2, w * 0.64, d * 0.6, '#d5dde3', 6);
      circle(0, y0 + d * 0.3, 2.5, '#8a96a3');
      break;
    case 'stove':
      box(x0, y0, w, d, color, 2);
      for (const [cx, cy] of [
        [-0.25, -0.25],
        [0.25, -0.25],
        [-0.25, 0.25],
        [0.25, 0.25],
      ]) {
        circle(cx * w, cy * d, Math.min(w, d) * 0.14, '#2b2f36');
      }
      break;
    case 'fridge':
    case 'washing-machine':
      box(x0, y0, w, d, color, 3);
      if (shape === 'washing-machine') circle(0, 0, Math.min(w, d) * 0.3, '#c5ced6');
      else {
        ctx.beginPath();
        ctx.moveTo(x0, y0 + d - 6);
        ctx.lineTo(x0 + w, y0 + d - 6);
        ctx.stroke();
      }
      break;
    case 'toilet':
      box(x0 + 2, y0, w - 4, d * 0.3, color, 3);
      ctx.beginPath();
      ctx.ellipse(0, y0 + d * 0.62, w / 2 - 1, d * 0.36, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
      break;
    case 'bathtub':
      box(x0, y0, w, d, color, 8);
      box(x0 + 8, y0 + 8, w - 16, d - 16, '#dbe7ef', 20);
      circle(x0 + 20, 0, 3, '#8a96a3');
      break;
    case 'shower':
      box(x0, y0, w, d, '#e7eef3', 2);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w, y0 + d);
      ctx.moveTo(x0 + w, y0);
      ctx.lineTo(x0, y0 + d);
      ctx.stroke();
      circle(0, 0, 3, '#8a96a3');
      break;
    case 'washbasin':
      box(x0, y0, w, d, color, 4);
      ctx.beginPath();
      ctx.ellipse(0, d * 0.05, w * 0.32, d * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#dbe7ef';
      ctx.fill();
      ctx.stroke();
      break;
    case 'plant': {
      const r = Math.min(w, d) / 2;
      ctx.fillStyle = color;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.5, r * 0.28, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      circle(0, 0, r * 0.3, darker);
      break;
    }
    case 'floor-lamp':
      circle(0, 0, Math.min(w, d) / 2, color);
      circle(0, 0, Math.min(w, d) / 6, darker);
      break;
    case 'rug':
      box(x0, y0, w, d, color, 2);
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.strokeRect(x0 + 8, y0 + 8, w - 16, d - 16);
      ctx.setLineDash([]);
      break;
    case 'tv':
      box(x0, y0, w, Math.max(d, 4), '#1a1a1a');
      break;
    case 'stairs': {
      box(x0, y0, w, d, color);
      const steps = Math.max(4, Math.round(d / 28));
      ctx.beginPath();
      for (let i = 1; i < steps; i++) {
        ctx.moveTo(x0, y0 + (d / steps) * i);
        ctx.lineTo(x0 + w, y0 + (d / steps) * i);
      }
      ctx.moveTo(0, y0 + d - 10);
      ctx.lineTo(0, y0 + 10);
      ctx.lineTo(-8, y0 + 22);
      ctx.moveTo(0, y0 + 10);
      ctx.lineTo(8, y0 + 22);
      ctx.stroke();
      break;
    }
    default:
      box(x0, y0, w, d, color);
  }
}

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
