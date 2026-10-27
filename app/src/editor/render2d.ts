import { getEntry, getFurniture } from '../catalog/catalog';
import { drawTopView } from '../catalog/draw2d';
import { boundsOf, polygonArea, polygonCentroid, rectCorners, wallLength } from '../model/geometry';
import type { Floor, Opening, Units, Vec2, Wall } from '../model/types';
import { formatArea, formatLength } from '../model/units';
import type { Selection } from './state';

export interface View {
  scale: number; // screen px per cm
  ox: number;
  oy: number;
}

export const toScreen = (v: View, p: Vec2): Vec2 => ({ x: p.x * v.scale + v.ox, y: p.y * v.scale + v.oy });
export const toWorld = (v: View, p: Vec2): Vec2 => ({ x: (p.x - v.ox) / v.scale, y: (p.y - v.oy) / v.scale });

export const COLORS = {
  canvas: '#fbfbfa',
  gridMinor: '#eceef1',
  gridMajor: '#dde1e7',
  wall: '#2a3242',
  wallSelected: '#f28c28',
  roomText: '#1f2a3d',
  roomSub: '#5b6577',
  select: '#2f6fe0',
  dim: '#46526a',
  ghost: '#c6ccd6',
};

export function floorBounds(floor: Floor) {
  const pts: Vec2[] = [];
  for (const w of floor.walls) pts.push(w.a, w.b);
  for (const r of floor.rooms) pts.push(...r.points);
  for (const i of floor.items) pts.push(...rectCorners(i.x, i.y, i.w, i.d, i.rotation));
  return boundsOf(pts);
}

export function fitView(floor: Floor, width: number, height: number, padding = 60, maxScale = 2): View {
  const b = floorBounds(floor);
  if (!b) return { scale: 1, ox: width / 2 - 300, oy: height / 2 - 250 };
  const bw = Math.max(b.maxX - b.minX, 100);
  const bh = Math.max(b.maxY - b.minY, 100);
  const scale = Math.min((width - padding * 2) / bw, (height - padding * 2) / bh, maxScale);
  return {
    scale,
    ox: width / 2 - ((b.minX + b.maxX) / 2) * scale,
    oy: height / 2 - ((b.minY + b.maxY) / 2) * scale,
  };
}

export function openingGeom(wall: Wall, o: Opening) {
  const len = wallLength(wall) || 1;
  const ux = (wall.b.x - wall.a.x) / len;
  const uy = (wall.b.y - wall.a.y) / len;
  const c = { x: wall.a.x + ux * o.offset, y: wall.a.y + uy * o.offset };
  const p1 = { x: c.x - (ux * o.width) / 2, y: c.y - (uy * o.width) / 2 };
  const p2 = { x: c.x + (ux * o.width) / 2, y: c.y + (uy * o.width) / 2 };
  return { c, p1, p2, ux, uy, nx: -uy, ny: ux };
}

export interface DrawOptions {
  floor: Floor;
  below?: Floor;
  units: Units;
  selection?: Selection | null;
  hover?: Selection | null;
  grid?: boolean;
  dims?: boolean;
  background?: string;
}

export function drawPlan(ctx: CanvasRenderingContext2D, width: number, height: number, view: View, o: DrawOptions) {
  const { floor, units } = o;
  const px = 1 / view.scale;
  ctx.save();
  ctx.fillStyle = o.background ?? COLORS.canvas;
  ctx.fillRect(0, 0, width, height);
  if (o.grid !== false) drawGrid(ctx, width, height, view);

  ctx.translate(view.ox, view.oy);
  ctx.scale(view.scale, view.scale);
  ctx.lineJoin = 'miter';

  // floor below, as a ghost
  if (o.below) {
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineCap = 'square';
    for (const w of o.below.walls) {
      ctx.lineWidth = w.thickness;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(w.a.x, w.a.y);
      ctx.lineTo(w.b.x, w.b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // rooms
  for (const r of floor.rooms) {
    ctx.beginPath();
    r.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = r.floor;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    const sel = isSel(o.selection, 'room', r.id);
    const hov = isSel(o.hover, 'room', r.id);
    if (sel || hov) {
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = (sel ? 3 : 1.5) * px;
      ctx.setLineDash(sel ? [] : [6 * px, 4 * px]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // items
  for (const it of floor.items) {
    const def = getFurniture(it.catalogId);
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate((it.rotation * Math.PI) / 180);
    if (def) drawTopView(ctx, def.shape, it.w, it.d, it.color, px);
    else {
      ctx.fillStyle = it.color;
      ctx.fillRect(-it.w / 2, -it.d / 2, it.w, it.d);
    }
    if (isSel(o.selection, 'item', it.id) || isSel(o.hover, 'item', it.id)) {
      const sel = isSel(o.selection, 'item', it.id);
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = (sel ? 2 : 1.5) * px;
      ctx.setLineDash(sel ? [] : [5 * px, 3 * px]);
      ctx.strokeRect(-it.w / 2 - 3 * px, -it.d / 2 - 3 * px, it.w + 6 * px, it.d + 6 * px);
      ctx.setLineDash([]);
      if (sel) {
        // rotation handle
        ctx.beginPath();
        ctx.moveTo(0, -it.d / 2 - 3 * px);
        ctx.lineTo(0, -it.d / 2 - 22 * px);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -it.d / 2 - 28 * px, 6 * px, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // walls
  ctx.lineCap = 'square';
  for (const w of floor.walls) {
    const sel = isSel(o.selection, 'wall', w.id);
    const hov = isSel(o.hover, 'wall', w.id);
    ctx.strokeStyle = sel ? COLORS.wallSelected : hov ? '#3d4a63' : COLORS.wall;
    ctx.lineWidth = w.thickness;
    ctx.beginPath();
    ctx.moveTo(w.a.x, w.a.y);
    ctx.lineTo(w.b.x, w.b.y);
    ctx.stroke();
  }

  // openings
  const walls = new Map(floor.walls.map((w) => [w.id, w]));
  for (const op of floor.openings) {
    const w = walls.get(op.wallId);
    if (!w) continue;
    drawOpening(ctx, w, op, px, isSel(o.selection, 'opening', op.id) || isSel(o.hover, 'opening', op.id), o.background ?? COLORS.canvas);
  }

  // corner handles of the selected wall
  if (o.selection?.kind === 'wall') {
    const w = walls.get(o.selection.id);
    if (w) for (const p of [w.a, w.b]) handle(ctx, p, px);
  }

  // room labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of floor.rooms) {
    const c = polygonCentroid(r.points);
    const area = polygonArea(r.points);
    const size = Math.max(11, Math.min(16, 14 * Math.sqrt(view.scale)));
    if (area * view.scale * view.scale < 2500) continue;
    ctx.font = `600 ${size * px}px Inter, system-ui, sans-serif`;
    labelBox(ctx, r.name, c.x, c.y - size * 0.6 * px, px, COLORS.roomText);
    ctx.font = `500 ${(size - 2) * px}px Inter, system-ui, sans-serif`;
    labelBox(ctx, formatArea(area, units), c.x, c.y + size * 0.7 * px, px, COLORS.roomSub);
  }

  // wall lengths
  if (o.dims !== false && view.scale > 0.25) {
    ctx.font = `500 ${11 * px}px Inter, system-ui, sans-serif`;
    for (const w of floor.walls) {
      const len = wallLength(w);
      if (len * view.scale < 45) continue;
      const nx = -(w.b.y - w.a.y) / len;
      const ny = (w.b.x - w.a.x) / len;
      const off = w.thickness / 2 + 10 * px;
      const mx = (w.a.x + w.b.x) / 2 + nx * off;
      const my = (w.a.y + w.b.y) / 2 + ny * off;
      ctx.save();
      ctx.translate(mx, my);
      let ang = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.rotate(ang);
      labelBox(ctx, formatLength(len, units), 0, 0, px, isSel(o.selection, 'wall', w.id) ? COLORS.wallSelected : COLORS.dim, 0.85);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawOpening(ctx: CanvasRenderingContext2D, w: Wall, o: Opening, px: number, highlight: boolean, bg: string) {
  const g = openingGeom(w, o);
  const t = w.thickness;
  // cut the wall
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = bg;
  ctx.lineWidth = t + 1 * px;
  ctx.beginPath();
  ctx.moveTo(g.p1.x, g.p1.y);
  ctx.lineTo(g.p2.x, g.p2.y);
  ctx.stroke();
  const color = highlight ? COLORS.select : COLORS.wall;
  ctx.strokeStyle = color;
  ctx.lineWidth = (highlight ? 2.2 : 1.4) * px;
  // jambs
  for (const p of [g.p1, g.p2]) {
    ctx.beginPath();
    ctx.moveTo(p.x + (g.nx * t) / 2, p.y + (g.ny * t) / 2);
    ctx.lineTo(p.x - (g.nx * t) / 2, p.y - (g.ny * t) / 2);
    ctx.stroke();
  }
  if (o.kind === 'window') {
    for (const k of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(g.p1.x + g.nx * t * k, g.p1.y + g.ny * t * k);
      ctx.lineTo(g.p2.x + g.nx * t * k, g.p2.y + g.ny * t * k);
      ctx.stroke();
    }
  } else {
    const side = o.flip ? -1 : 1;
    const double = o.width > 120;
    const leaves = double ? [g.p1, g.p2] : [g.p1];
    const leafLen = double ? o.width / 2 : o.width;
    for (const hinge of leaves) {
      const dir = hinge === g.p1 ? 1 : -1;
      const base = Math.atan2(g.uy * dir, g.ux * dir);
      const open = base + (side * dir * Math.PI) / 2;
      const hx = hinge.x + (g.nx * side * t) / 2;
      const hy = hinge.y + (g.ny * side * t) / 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(open) * leafLen, hy + Math.sin(open) * leafLen);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.beginPath();
      ctx.arc(hx, hy, leafLen, base, open, side * dir < 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function handle(ctx: CanvasRenderingContext2D, p: Vec2, px: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6 * px, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2 * px;
  ctx.strokeStyle = COLORS.select;
  ctx.stroke();
}

function labelBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string, alpha = 0.75) {
  const m = ctx.measureText(text);
  const fontPx = parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] ?? '12');
  const padX = 4 * px;
  const hgt = fontPx * 1.35;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(x - m.width / 2 - padX, y - hgt / 2, m.width + padX * 2, hgt);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + px * 0.5);
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, v: View) {
  // minor every 10 cm when zoomed in, else 50 cm; major every metre
  const minor = v.scale > 1.2 ? 10 : 50;
  const major = 100;
  const step = (cm: number, color: string) => {
    const s = cm * v.scale;
    if (s < 6) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = ((v.ox % s) + s) % s;
    const startY = ((v.oy % s) + s) % s;
    for (let x = startX; x < width; x += s) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = startY; y < height; y += s) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
  };
  step(minor, COLORS.gridMinor);
  step(major, COLORS.gridMajor);
}

const isSel = (s: Selection | null | undefined, kind: Selection['kind'], id: string) => !!s && s.kind === kind && s.id === id;

/** A small preview image of a catalogue entry, for the catalogue grid. */
export function drawCatalogThumb(canvas: HTMLCanvasElement, entryId: string) {
  const e = getEntry(entryId);
  const dpr = window.devicePixelRatio || 1;
  const W = 72;
  const H = 56;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx || !e) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  if (e.category === 'openings') {
    const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: e.width + 40, y: 0 }, thickness: 15, height: 280, color: '#fff' };
    const op: Opening = { id: 'o', wallId: 'w', kind: e.kind, offset: (e.width + 40) / 2, width: e.width, height: e.height, sill: e.sill };
    const s = Math.min((W - 8) / (e.width + 40), 0.4);
    ctx.translate(W / 2 - ((e.width + 40) / 2) * s, e.kind === 'door' ? 14 : H / 2);
    ctx.scale(s, s);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(e.width + 40, 0);
    ctx.stroke();
    drawOpening(ctx, wall, op, 1 / s, false, '#ffffff');
    return;
  }
  const s = Math.min((W - 10) / e.w, (H - 10) / e.d, 0.6);
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  drawTopView(ctx, e.shape, e.w, e.d, e.color, 1 / s);
}
