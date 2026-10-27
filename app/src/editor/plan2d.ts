import { getEntry, isOpening, type CatalogEntry } from '../catalog/catalog';
import { drawTopView } from '../catalog/draw2d';
import {
  clampOpeningOffset,
  dist,
  pointInPolygon,
  polygonArea,
  projectOnSegment,
  snapAngle,
  snapToGrid,
  wallLength,
} from '../model/geometry';
import { t } from '../i18n';
import { addItem, addOpening, addRoom, addWall, moveCorner, moveCorners } from '../model/project';
import type { Item, Vec2, Wall } from '../model/types';
import { formatLength } from '../model/units';
import { COLORS, drawPlan, fitView, openingGeom, toWorld, type View } from './render2d';
import type { EditorState, Selection } from './state';

const GRID = 5; // cm
const SNAP_PX = 12;
const MOVE_THRESHOLD = 4;

type Drag =
  | { kind: 'pan'; startX: number; startY: number; ox: number; oy: number }
  | { kind: 'item'; id: string; dx: number; dy: number }
  | { kind: 'rotate'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'corner'; at: Vec2 }
  | { kind: 'shift'; corners: Vec2[]; start: Vec2; applied: Vec2 }
  | { kind: 'rect'; start: Vec2 };

interface Pending {
  sx: number;
  sy: number;
  started: boolean;
  drag: Drag | null;
  select: Selection | null;
}

export class PlanCanvas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  view: View = { scale: 1, ox: 0, oy: 0 };
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frame = 0;
  private fitted = false;

  private draft: Vec2[] = [];
  private cursor: Vec2 | null = null;
  private snapMark: Vec2 | null = null;
  private hover: Selection | null = null;
  private rectEnd: Vec2 | null = null;
  private pending: Pending | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; mx: number; my: number } | null = null;
  private shift = false;
  private ro: ResizeObserver;

  constructor(
    private host: HTMLElement,
    private state: EditorState,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Plan 2D');
    this.canvas.tabIndex = 0;
    this.ctx = this.canvas.getContext('2d')!;
    host.append(this.canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('pointerleave', () => {
      this.cursor = null;
      this.hover = null;
      this.render();
    });
    c.addEventListener('dblclick', this.onDblClick);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('text/bmt-catalog')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    c.addEventListener('drop', this.onDrop);
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.frame);
    this.canvas.remove();
  }

  resetDraft() {
    this.draft = [];
    this.rectEnd = null;
    this.pending = null;
    this.render();
  }

  setShift(v: boolean) {
    this.shift = v;
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = window.devicePixelRatio || 1;
    this.width = r.width;
    this.height = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    if (!this.fitted) {
      this.fit();
      this.fitted = true;
    }
    this.renderNow();
  }

  fit() {
    if (!this.width) return;
    this.view = fitView(this.state.floor, this.width, this.height, 70, 1.5);
    this.render();
  }

  zoomBy(factor: number, cx = this.width / 2, cy = this.height / 2) {
    const s = Math.max(0.05, Math.min(8, this.view.scale * factor));
    const w = toWorld(this.view, { x: cx, y: cy });
    this.view = { scale: s, ox: cx - w.x * s, oy: cy - w.y * s };
    this.render();
  }

  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderNow();
    });
  }

  renderNow() {
    const { ctx } = this;
    if (!this.width) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const s = this.state;
    drawPlan(ctx, this.width, this.height, this.view, {
      floor: s.floor,
      below: s.floorIndex > 0 ? s.project.floors[s.floorIndex - 1] : undefined,
      units: s.project.units,
      selection: s.selection,
      hover: s.tool === 'select' ? this.hover : null,
    });
    this.drawOverlay();
  }

  private drawOverlay() {
    const { ctx } = this;
    const v = this.view;
    const px = 1 / v.scale;
    const s = this.state;
    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);

    const pts = [...this.draft];
    if ((s.tool === 'room' || s.tool === 'wall') && this.cursor && pts.length) pts.push(this.cursor);
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = COLORS.wallSelected;
      ctx.lineWidth = 15;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = 1;
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      this.lengthTag(a, b, px);
    }
    if (s.tool === 'room' && this.rectEnd && this.pending?.drag?.kind === 'rect') {
      const a = this.pending.drag.start;
      const b = this.rectEnd;
      ctx.fillStyle = 'rgba(242,140,40,0.15)';
      ctx.strokeStyle = COLORS.wallSelected;
      ctx.lineWidth = 15;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.globalAlpha = 1;
      this.lengthTag({ x: a.x, y: Math.min(a.y, b.y) }, { x: b.x, y: Math.min(a.y, b.y) }, px);
      this.lengthTag({ x: Math.max(a.x, b.x), y: a.y }, { x: Math.max(a.x, b.x), y: b.y }, px);
    }
    for (const p of this.draft) this.dot(p, px, '#ffffff');
    if (this.draft.length >= 3 && s.tool === 'room') this.dot(this.draft[0], px, COLORS.wallSelected, 8);

    if (this.snapMark && (s.tool === 'room' || s.tool === 'wall' || this.pending?.drag?.kind === 'corner')) {
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(this.snapMark.x, this.snapMark.y, 9 * px, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.tool === 'place' && s.placing && this.cursor) this.drawGhost(s.placing, this.cursor, px);
    ctx.restore();
  }

  private drawGhost(entry: CatalogEntry, p: Vec2, px: number) {
    const { ctx } = this;
    if (isOpening(entry)) {
      const hit = this.nearestWall(p, 40);
      if (!hit) return;
      const len = wallLength(hit.wall);
      const width = Math.min(entry.width, len - 10);
      const off = clampOpeningOffset(hit.t * len, width, len);
      const g = openingGeom(hit.wall, { id: '', wallId: hit.wall.id, kind: entry.kind, offset: off, width, height: entry.height, sill: entry.sill });
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = hit.wall.thickness + 4;
      ctx.globalAlpha = 0.55;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(g.p1.x, g.p1.y);
      ctx.lineTo(g.p2.x, g.p2.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.translate(snapToGrid(p.x, GRID), snapToGrid(p.y, GRID));
    drawTopView(ctx, entry.shape, entry.w, entry.d, entry.color, px);
    ctx.restore();
  }

  private dot(p: Vec2, px: number, fill: string, r = 5) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * px, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = COLORS.wallSelected;
    ctx.stroke();
  }

  private lengthTag(a: Vec2, b: Vec2, px: number) {
    const len = dist(a, b);
    if (len < 1) return;
    const { ctx } = this;
    const text = formatLength(len, this.state.project.units);
    ctx.font = `600 ${12 * px}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 20 * px;
    const w = ctx.measureText(text).width + 10 * px;
    ctx.fillStyle = COLORS.wallSelected;
    ctx.fillRect(mx - w / 2, my - 9 * px, w, 18 * px);
    ctx.fillStyle = '#1b1206';
    ctx.fillText(text, mx, my + 0.5 * px);
  }

  // ---------- geometry helpers ----------

  private eventPoint(e: { clientX: number; clientY: number }): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private corners(): Vec2[] {
    const out: Vec2[] = [];
    for (const w of this.state.floor.walls) out.push(w.a, w.b);
    for (const r of this.state.floor.rooms) out.push(...r.points);
    return out;
  }

  /** Snap a world point: corners first, then along walls, then right angles, then the grid. */
  private snap(p: Vec2, from?: Vec2, exclude?: Vec2): Vec2 {
    const tol = SNAP_PX / this.view.scale;
    this.snapMark = null;
    let best: Vec2 | null = null;
    let bestD = tol;
    for (const c of this.corners()) {
      if (exclude && dist(c, exclude) < 0.5) continue;
      const d = dist(c, p);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (from && this.draft.length >= 3 && dist(this.draft[0], p) < tol) best = this.draft[0];
    if (best) {
      this.snapMark = best;
      return { ...best };
    }
    let q = { ...p };
    if (from) {
      if (this.shift) q = snapAngle(from, q);
      else {
        // pull nearly straight lines onto the axis
        const dx = q.x - from.x;
        const dy = q.y - from.y;
        if (Math.abs(dy) < Math.abs(dx) * 0.12) q.y = from.y;
        else if (Math.abs(dx) < Math.abs(dy) * 0.12) q.x = from.x;
      }
    }
    for (const w of this.state.floor.walls) {
      const hit = projectOnSegment(q, w.a, w.b);
      if (hit.distance < tol * 0.75 && hit.t > 0.001 && hit.t < 0.999) {
        this.snapMark = hit.point;
        return { x: Math.round(hit.point.x * 10) / 10, y: Math.round(hit.point.y * 10) / 10 };
      }
    }
    return {
      x: from && q.x === from.x ? q.x : snapToGrid(q.x, GRID),
      y: from && q.y === from.y ? q.y : snapToGrid(q.y, GRID),
    };
  }

  private nearestWall(p: Vec2, tolPx: number): { wall: Wall; t: number; distance: number } | null {
    let best: { wall: Wall; t: number; distance: number } | null = null;
    for (const w of this.state.floor.walls) {
      const h = projectOnSegment(p, w.a, w.b);
      const limit = w.thickness / 2 + tolPx / this.view.scale;
      if (h.distance <= limit && (!best || h.distance < best.distance)) best = { wall: w, t: h.t, distance: h.distance };
    }
    return best;
  }

  private itemContains(it: Item, p: Vec2, margin: number) {
    const r = (-it.rotation * Math.PI) / 180;
    const dx = p.x - it.x;
    const dy = p.y - it.y;
    const u = dx * Math.cos(r) - dy * Math.sin(r);
    const v = dx * Math.sin(r) + dy * Math.cos(r);
    return Math.abs(u) <= it.w / 2 + margin && Math.abs(v) <= it.d / 2 + margin;
  }

  private rotateHandle(it: Item): Vec2 {
    const px = 1 / this.view.scale;
    const r = (it.rotation * Math.PI) / 180;
    const off = -it.d / 2 - 28 * px;
    return { x: it.x - Math.sin(r) * off, y: it.y + Math.cos(r) * off };
  }

  private hitTest(p: Vec2): { sel: Selection; drag: Drag | null } | null {
    const f = this.state.floor;
    const tol = 8 / this.view.scale;
    const sel = this.state.selection;
    if (sel?.kind === 'item') {
      const it = f.items.find((i) => i.id === sel.id);
      if (it && dist(this.rotateHandle(it), p) < tol * 1.4) return { sel, drag: { kind: 'rotate', id: it.id } };
    }
    if (sel?.kind === 'wall') {
      const w = f.walls.find((x) => x.id === sel.id);
      if (w) for (const c of [w.a, w.b]) if (dist(c, p) < tol * 1.4) return { sel, drag: { kind: 'corner', at: { ...c } } };
    }
    const walls = new Map(f.walls.map((w) => [w.id, w]));
    for (const o of f.openings) {
      const w = walls.get(o.wallId);
      if (!w) continue;
      const g = openingGeom(w, o);
      if (projectOnSegment(p, g.p1, g.p2).distance < w.thickness / 2 + tol) {
        return { sel: { kind: 'opening', id: o.id }, drag: { kind: 'opening', id: o.id } };
      }
    }
    for (let i = f.items.length - 1; i >= 0; i--) {
      const it = f.items[i];
      if (this.itemContains(it, p, tol * 0.5)) {
        return { sel: { kind: 'item', id: it.id }, drag: { kind: 'item', id: it.id, dx: p.x - it.x, dy: p.y - it.y } };
      }
    }
    for (const w of f.walls) {
      if (projectOnSegment(p, w.a, w.b).distance < w.thickness / 2 + tol * 0.6) {
        return { sel: { kind: 'wall', id: w.id }, drag: { kind: 'shift', corners: [w.a, w.b], start: p, applied: { x: 0, y: 0 } } };
      }
    }
    const rooms = f.rooms.filter((r) => pointInPolygon(p, r.points)).sort((a, b) => polygonArea(a.points) - polygonArea(b.points));
    if (rooms[0]) {
      return { sel: { kind: 'room', id: rooms[0].id }, drag: { kind: 'shift', corners: rooms[0].points, start: p, applied: { x: 0, y: 0 } } };
    }
    return null;
  }

  // ---------- pointer handling ----------

  private onDown = (e: PointerEvent) => {
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(e.pointerId);
    const sp = this.eventPoint(e);
    this.pointers.set(e.pointerId, sp);
    this.shift = e.shiftKey;
    if (this.pointers.size === 2) {
      // second finger: switch to pinch zoom, drop whatever the first finger started
      if (this.pending?.started) this.state.endGesture();
      this.pending = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: dist(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (this.pointers.size > 2) return;
    const s = this.state;
    const p = toWorld(this.view, sp);
    const panButton = e.button === 1 || e.button === 2 || s.tool === 'pan';
    if (panButton || s.readOnly) {
      this.pending = { sx: sp.x, sy: sp.y, started: false, drag: { kind: 'pan', startX: sp.x, startY: sp.y, ox: this.view.ox, oy: this.view.oy }, select: null };
      return;
    }
    if (s.tool === 'select') {
      const hit = this.hitTest(p);
      this.pending = {
        sx: sp.x,
        sy: sp.y,
        started: false,
        drag: hit ? hit.drag : { kind: 'pan', startX: sp.x, startY: sp.y, ox: this.view.ox, oy: this.view.oy },
        select: hit ? hit.sel : null,
      };
      if (hit && (s.selection?.kind !== hit.sel.kind || s.selection?.id !== hit.sel.id)) s.select(hit.sel);
      return;
    }
    if (s.tool === 'room' && this.draft.length === 0) {
      this.pending = { sx: sp.x, sy: sp.y, started: false, drag: { kind: 'rect', start: this.snap(p) }, select: null };
      return;
    }
    this.pending = { sx: sp.x, sy: sp.y, started: false, drag: null, select: null };
  };

  private onMove = (e: PointerEvent) => {
    const sp = this.eventPoint(e);
    this.shift = e.shiftKey;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, sp);
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = dist(a, b);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.view.ox += mx - this.pinch.mx;
      this.view.oy += my - this.pinch.my;
      this.zoomBy(d / (this.pinch.d || d), mx, my);
      this.pinch = { d, mx, my };
      return;
    }
    const s = this.state;
    const p = toWorld(this.view, sp);
    const pend = this.pending;
    if (pend && pend.drag) {
      if (!pend.started && Math.hypot(sp.x - pend.sx, sp.y - pend.sy) < MOVE_THRESHOLD) return;
      if (!pend.started) {
        pend.started = true;
        if (pend.drag.kind !== 'pan' && pend.drag.kind !== 'rect') s.beginGesture();
      }
      this.applyDrag(pend.drag, sp, p);
      return;
    }
    // hover and tool previews
    const from = this.draft[this.draft.length - 1];
    if (s.tool === 'room' || s.tool === 'wall') this.cursor = this.snap(p, from);
    else this.cursor = p;
    if (s.tool === 'select' && !s.readOnly) {
      const hit = this.hitTest(p);
      const next = hit?.sel ?? null;
      if (next?.id !== this.hover?.id) {
        this.hover = next;
        this.canvas.style.cursor = next ? (hit?.drag?.kind === 'rotate' ? 'grab' : 'move') : 'default';
      }
    } else {
      this.canvas.style.cursor = s.tool === 'pan' || s.readOnly ? 'grab' : 'crosshair';
    }
    this.render();
  };

  private applyDrag(drag: Drag, sp: Vec2, p: Vec2) {
    const s = this.state;
    switch (drag.kind) {
      case 'pan':
        this.view.ox = drag.ox + (sp.x - drag.startX);
        this.view.oy = drag.oy + (sp.y - drag.startY);
        this.canvas.style.cursor = 'grabbing';
        break;
      case 'rect':
        this.rectEnd = this.snap(p, drag.start);
        break;
      case 'item':
        s.commit((f) => {
          const it = f.items.find((i) => i.id === drag.id);
          if (it) {
            it.x = snapToGrid(p.x - drag.dx, GRID);
            it.y = snapToGrid(p.y - drag.dy, GRID);
          }
        });
        break;
      case 'rotate':
        s.commit((f) => {
          const it = f.items.find((i) => i.id === drag.id);
          if (!it) return;
          let deg = (Math.atan2(p.y - it.y, p.x - it.x) * 180) / Math.PI + 90;
          if (!this.shift) deg = Math.round(deg / 15) * 15;
          it.rotation = ((Math.round(deg) % 360) + 360) % 360;
        });
        break;
      case 'opening':
        s.commit((f) => {
          const o = f.openings.find((x) => x.id === drag.id);
          const w = o && f.walls.find((x) => x.id === o.wallId);
          if (!o || !w) return;
          const len = wallLength(w);
          o.offset = clampOpeningOffset(snapToGrid(projectOnSegment(p, w.a, w.b).t * len, 1), o.width, len);
        });
        break;
      case 'corner': {
        const to = this.snap(p, undefined, drag.at);
        if (dist(to, drag.at) < 0.1) break;
        s.commit((f) => moveCorner(f, drag.at, to));
        drag.at = to;
        break;
      }
      case 'shift': {
        const dx = snapToGrid(p.x - drag.start.x, GRID);
        const dy = snapToGrid(p.y - drag.start.y, GRID);
        if (dx === drag.applied.x && dy === drag.applied.y) break;
        const ddx = dx - drag.applied.x;
        const ddy = dy - drag.applied.y;
        s.commit((f) => moveCorners(f, drag.corners, ddx, ddy));
        // the corners we hold were copied by moveCorners; track where they are now
        drag.corners = drag.corners.map((c) => ({ x: c.x + ddx, y: c.y + ddy }));
        drag.applied = { x: dx, y: dy };
        break;
      }
    }
    this.render();
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const pend = this.pending;
    this.pending = null;
    const s = this.state;
    const sp = this.eventPoint(e);
    const p = toWorld(this.view, sp);
    if (pend?.started) {
      if (pend.drag?.kind === 'rect' && this.rectEnd) {
        const a = pend.drag.start;
        const b = this.rectEnd;
        this.rectEnd = null;
        if (Math.abs(b.x - a.x) >= 30 && Math.abs(b.y - a.y) >= 30) {
          this.createRoom([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
        }
      } else if (pend.drag && pend.drag.kind !== 'pan') {
        s.endGesture();
      }
      this.canvas.style.cursor = '';
      this.render();
      return;
    }
    if (s.readOnly) return;
    // a click
    switch (s.tool) {
      case 'select':
        if (!pend?.select) s.select(null);
        break;
      case 'room': {
        const pt = this.snap(p, this.draft[this.draft.length - 1]);
        if (this.draft.length >= 3 && dist(pt, this.draft[0]) < 0.5) {
          this.createRoom(this.draft);
          this.draft = [];
        } else if (!this.draft.length || dist(pt, this.draft[this.draft.length - 1]) > 0.5) {
          this.draft.push(pt);
        }
        break;
      }
      case 'wall': {
        const last = this.draft[this.draft.length - 1];
        const pt = this.snap(p, last);
        if (last && dist(pt, last) > 0.5) s.commit((f) => addWall(f, last, pt));
        if (this.draft.length >= 2 && dist(pt, this.draft[0]) < 0.5) this.draft = [];
        else if (!last || dist(pt, last) > 0.5) this.draft.push(pt);
        break;
      }
      case 'place':
        if (s.placing) this.place(s.placing, p);
        break;
    }
    this.render();
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.pending?.started && this.pending.drag?.kind !== 'pan') this.state.endGesture();
    this.pending = null;
  };

  private onDblClick = () => {
    const s = this.state;
    if (s.tool === 'room' && this.draft.length >= 3) {
      this.createRoom(this.draft);
      this.draft = [];
    } else if (s.tool === 'wall') {
      this.draft = [];
    }
    this.render();
  };

  /** Enter in the room tool closes the outline; returns true when it did something. */
  finishDraft(): boolean {
    if (this.state.tool === 'room' && this.draft.length >= 3) {
      this.createRoom(this.draft);
      this.draft = [];
      this.render();
      return true;
    }
    if (this.draft.length) {
      this.draft = [];
      this.render();
      return true;
    }
    return false;
  }

  hasDraft() {
    return this.draft.length > 0;
  }

  private createRoom(points: Vec2[]) {
    const s = this.state;
    let made: string | null = null;
    s.commit((f) => {
      const r = addRoom(f, points, `${t('roomDefault')} ${f.rooms.length + 1}`);
      made = r?.id ?? null;
    });
    if (made) {
      s.setTool('select');
      s.select({ kind: 'room', id: made });
    }
  }

  /** Put a catalogue entry at a plan point (furniture) or on the nearest wall (openings). */
  place(entry: CatalogEntry, p: Vec2) {
    const s = this.state;
    let made: Selection | null = null;
    if (isOpening(entry)) {
      const hit = this.nearestWall(p, 40);
      if (!hit) return;
      s.commit((f) => {
        const o = addOpening(f, hit.wall, entry.kind, hit.t * wallLength(hit.wall), entry.width, entry.height, entry.sill);
        made = { kind: 'opening', id: o.id };
      });
    } else {
      s.commit((f) => {
        const it = addItem(f, entry.id, snapToGrid(p.x, GRID), snapToGrid(p.y, GRID));
        if (it) made = { kind: 'item', id: it.id };
      });
    }
    s.setTool('select');
    if (made) s.select(made);
  }

  private onDrop = (e: DragEvent) => {
    const id = e.dataTransfer?.getData('text/bmt-catalog');
    const entry = id ? getEntry(id) : undefined;
    if (!entry || this.state.readOnly) return;
    e.preventDefault();
    this.place(entry, toWorld(this.view, this.eventPoint(e)));
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const sp = this.eventPoint(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(-delta * 0.0015), sp.x, sp.y);
  };

  /** Nudge the selected item with the arrow keys. */
  nudge(dx: number, dy: number) {
    const sel = this.state.selection;
    if (sel?.kind !== 'item') return false;
    this.state.commit((f) => {
      const it = f.items.find((i) => i.id === sel.id);
      if (it) {
        it.x += dx;
        it.y += dy;
      }
    });
    return true;
  }

  /** Render the floor to a data URL, fitted, for thumbnails and PNG export. */
  static snapshot(state: EditorState, width: number, height: number, floorIndex = state.floorIndex, scale = 1): string {
    const c = document.createElement('canvas');
    c.width = width * scale;
    c.height = height * scale;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    const floor = state.project.floors[floorIndex];
    const view = fitView(floor, width, height, Math.min(width, height) * 0.08, 3);
    drawPlan(ctx, width, height, view, { floor, units: state.project.units, grid: false, background: '#ffffff', dims: width > 400 });
    return c.toDataURL('image/png');
  }
}
