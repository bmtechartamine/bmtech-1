import type { Vec2, Wall } from './types';

export const dist = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

export const wallLength = (w: Wall) => dist(w.a, w.b);

/** Shoelace area, always positive, in cm². */
export function polygonArea(points: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/** Area centroid; falls back to the vertex average for degenerate polygons. */
export function polygonCentroid(points: Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = points.length || 1;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Closest point on segment ab to p, with t in [0, 1]. */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, distance: dist(p, point) };
}

export const snapToGrid = (v: number, step: number) => Math.round(v / step) * step;

export function snapPoint(p: Vec2, step: number): Vec2 {
  return { x: snapToGrid(p.x, step), y: snapToGrid(p.y, step) };
}

/** Snap the segment from `from` to `to` onto the nearest 45° direction. */
export function snapAngle(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
}

/** True when both walls cover the same segment, in either direction. */
export function sameSegment(a1: Vec2, b1: Vec2, a2: Vec2, b2: Vec2, tol = 1): boolean {
  return (
    (dist(a1, a2) <= tol && dist(b1, b2) <= tol) || (dist(a1, b2) <= tol && dist(b1, a2) <= tol)
  );
}

/**
 * The parts of segment a-b not already covered by collinear segments in `existing`,
 * as [start, end] pairs. Lets adjoining rooms share one wall instead of stacking two.
 */
export function uncoveredParts(a: Vec2, b: Vec2, existing: [Vec2, Vec2][], tol = 1): [Vec2, Vec2][] {
  const len = dist(a, b);
  if (len < tol) return [];
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const along = (p: Vec2) => (p.x - a.x) * ux + (p.y - a.y) * uy;
  const off = (p: Vec2) => Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
  const covered: [number, number][] = [];
  for (const [p, q] of existing) {
    if (off(p) > tol || off(q) > tol) continue;
    const s = Math.max(0, Math.min(along(p), along(q)));
    const e = Math.min(len, Math.max(along(p), along(q)));
    if (e - s > tol) covered.push([s, e]);
  }
  covered.sort((m, n) => m[0] - n[0]);
  const parts: [number, number][] = [];
  let cursor = 0;
  for (const [s, e] of covered) {
    if (s - cursor > tol) parts.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (len - cursor > tol) parts.push([cursor, len]);
  const at = (d: number): Vec2 => ({ x: a.x + ux * d, y: a.y + uy * d });
  return parts.map(([s, e]) => [at(s), at(e)]);
}

/** Keep an opening of `width` inside a wall of `length`, with a small margin. */
export function clampOpeningOffset(offset: number, width: number, length: number, margin = 5): number {
  const min = width / 2 + margin;
  const max = length - width / 2 - margin;
  if (min > max) return length / 2;
  return Math.max(min, Math.min(max, offset));
}

/** Corners of a rotated rectangle centred on (x, y). */
export function rectCorners(x: number, y: number, w: number, d: number, rotationDeg: number): Vec2[] {
  const r = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([u, v]) => ({ x: x + u * c - v * s, y: y + u * s + v * c }));
}

export function boundsOf(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Drop a repeated closing vertex and consecutive duplicates. */
export function cleanPolygon(points: Vec2[], tol = 0.5): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    if (!out.length || dist(out[out.length - 1], p) > tol) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= tol) out.pop();
  return out;
}
