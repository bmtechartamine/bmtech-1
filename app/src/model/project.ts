import { getFurniture } from '../catalog/catalog';
import {
  cleanPolygon,
  clampOpeningOffset,
  polygonArea,
  projectOnSegment,
  sameSegment,
  uncoveredParts,
  wallLength,
} from './geometry';
import { uid } from './ids';
import {
  DEFAULT_FLOOR_COLOR,
  DEFAULT_WALL_COLOR,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  type Floor,
  type Item,
  type Opening,
  type OpeningKind,
  type Project,
  type Room,
  type Units,
  type Vec2,
  type Wall,
} from './types';

export function newFloor(name: string, height = DEFAULT_WALL_HEIGHT): Floor {
  return { id: uid('f'), name, height, walls: [], rooms: [], openings: [], items: [] };
}

export function newProject(name: string, floorName: string, units: Units = 'metric'): Project {
  const now = Date.now();
  return { id: uid('p'), name, units, createdAt: now, updatedAt: now, floors: [newFloor(floorName)] };
}

export function addWall(floor: Floor, a: Vec2, b: Vec2, opts: Partial<Wall> = {}): Wall | null {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return null;
  if (floor.walls.some((w) => sameSegment(w.a, w.b, a, b))) return null;
  const wall: Wall = {
    id: uid('w'),
    a: { ...a },
    b: { ...b },
    thickness: DEFAULT_WALL_THICKNESS,
    height: floor.height,
    color: DEFAULT_WALL_COLOR,
    ...opts,
  };
  floor.walls.push(wall);
  return wall;
}

/** A room and its walls. Edges that already have a wall do not get a second one. */
export function addRoom(floor: Floor, points: Vec2[], name: string, floorColor = DEFAULT_FLOOR_COLOR): Room | null {
  const pts = cleanPolygon(points);
  if (pts.length < 3 || polygonArea(pts) < 100) return null;
  const room: Room = { id: uid('r'), name, points: pts.map((p) => ({ ...p })), floor: floorColor };
  floor.rooms.push(room);
  for (let i = 0; i < pts.length; i++) {
    const existing = floor.walls.map((w) => [w.a, w.b] as [Vec2, Vec2]);
    for (const [p, q] of uncoveredParts(pts[i], pts[(i + 1) % pts.length], existing)) addWall(floor, p, q);
  }
  return room;
}

export function addOpening(
  floor: Floor,
  wall: Wall,
  kind: OpeningKind,
  offset: number,
  width: number,
  height: number,
  sill: number,
): Opening {
  const len = wallLength(wall);
  const w = Math.min(width, Math.max(20, len - 10));
  const op: Opening = {
    id: uid('o'),
    wallId: wall.id,
    kind,
    offset: clampOpeningOffset(offset, w, len),
    width: w,
    height: Math.min(height, wall.height - sill - 5),
    sill,
  };
  floor.openings.push(op);
  return op;
}

export function addItem(floor: Floor, catalogId: string, x: number, y: number, rotation = 0): Item | null {
  const def = getFurniture(catalogId);
  if (!def) return null;
  const item: Item = {
    id: uid('i'),
    catalogId,
    x,
    y,
    rotation,
    w: def.w,
    d: def.d,
    h: def.h,
    elevation: def.elevation ?? 0,
    color: def.color,
  };
  floor.items.push(item);
  return item;
}

export function removeWall(floor: Floor, wallId: string) {
  floor.walls = floor.walls.filter((w) => w.id !== wallId);
  floor.openings = floor.openings.filter((o) => o.wallId !== wallId);
}

/** Re-clamp every opening after walls moved or changed length. */
export function fixOpenings(floor: Floor) {
  const walls = new Map(floor.walls.map((w) => [w.id, w]));
  floor.openings = floor.openings.filter((o) => walls.has(o.wallId));
  for (const o of floor.openings) {
    const len = wallLength(walls.get(o.wallId)!);
    o.width = Math.min(o.width, Math.max(20, len - 10));
    o.offset = clampOpeningOffset(o.offset, o.width, len);
  }
}

/** Move every wall endpoint that sits on `from` to `to` (keeps corners joined). */
export function moveCorner(floor: Floor, from: Vec2, to: Vec2, tol = 1) {
  for (const w of floor.walls) {
    if (Math.hypot(w.a.x - from.x, w.a.y - from.y) <= tol) w.a = { ...to };
    if (Math.hypot(w.b.x - from.x, w.b.y - from.y) <= tol) w.b = { ...to };
  }
  for (const r of floor.rooms) {
    r.points = r.points.map((p) => (Math.hypot(p.x - from.x, p.y - from.y) <= tol ? { ...to } : p));
  }
  fixOpenings(floor);
}

/** True when the whole wall lies on one edge of the polygon. */
function wallOnEdges(w: Wall, pts: Vec2[], tol = 1): boolean {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (projectOnSegment(w.a, a, b).distance <= tol && projectOnSegment(w.b, a, b).distance <= tol) return true;
  }
  return false;
}

/** The walls that run along a room's outline. */
export function roomWalls(floor: Floor, room: Room): Wall[] {
  return floor.walls.filter((w) => wallOnEdges(w, room.points));
}

/** Remove a room and the walls only it uses; walls shared with another room stay. */
export function removeRoom(floor: Floor, roomId: string) {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room) return;
  floor.rooms = floor.rooms.filter((r) => r.id !== roomId);
  for (const w of roomWalls(floor, room)) {
    if (!floor.rooms.some((r) => wallOnEdges(w, r.points))) removeWall(floor, w.id);
  }
}

/** Shift a set of corner points by (dx, dy), dragging the walls and rooms joined to them. */
export function moveCorners(floor: Floor, corners: Vec2[], dx: number, dy: number) {
  const unique: Vec2[] = [];
  for (const c of corners) if (!unique.some((u) => Math.hypot(u.x - c.x, u.y - c.y) < 1)) unique.push({ ...c });
  // Move to a temporary far-away spot first so corners never merge mid-way.
  const parked = unique.map((_, i) => ({ x: 1e7 + i * 1000, y: 1e7 }));
  unique.forEach((c, i) => moveCorner(floor, c, parked[i]));
  unique.forEach((c, i) => moveCorner(floor, parked[i], { x: c.x + dx, y: c.y + dy }));
}

export function duplicateItem(floor: Floor, item: Item): Item {
  const copy: Item = { ...item, id: uid('i'), x: item.x + 30, y: item.y + 30 };
  floor.items.push(copy);
  return copy;
}

export function cloneProject(p: Project, name: string): Project {
  const copy: Project = JSON.parse(JSON.stringify(p));
  const now = Date.now();
  copy.id = uid('p');
  copy.name = name;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Vec2 => !!v && isNum((v as Vec2).x) && isNum((v as Vec2).y);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Check a project read from a file or a link. Returns null when it is not one. */
export function validateProject(data: unknown): Project | null {
  if (!data || typeof data !== 'object') return null;
  const p = data as Project;
  if (!isStr(p.name) || !Array.isArray(p.floors) || !p.floors.length) return null;
  for (const f of p.floors) {
    if (!f || !isStr(f.name) || !isNum(f.height)) return null;
    if (![f.walls, f.rooms, f.openings, f.items].every(Array.isArray)) return null;
    if (!f.walls.every((w) => isStr(w.id) && isPt(w.a) && isPt(w.b) && isNum(w.thickness) && isNum(w.height))) return null;
    if (!f.rooms.every((r) => isStr(r.id) && Array.isArray(r.points) && r.points.every(isPt))) return null;
    if (!f.openings.every((o) => isStr(o.wallId) && (o.kind === 'door' || o.kind === 'window') && isNum(o.offset) && isNum(o.width))) return null;
    if (!f.items.every((i) => isStr(i.catalogId) && isNum(i.x) && isNum(i.y) && isNum(i.w) && isNum(i.d) && isNum(i.h))) return null;
  }
  const now = Date.now();
  return {
    id: isStr(p.id) ? p.id : uid('p'),
    name: p.name.slice(0, 120),
    units: p.units === 'imperial' ? 'imperial' : 'metric',
    createdAt: isNum(p.createdAt) ? p.createdAt : now,
    updatedAt: isNum(p.updatedAt) ? p.updatedAt : now,
    thumbnail: isStr(p.thumbnail) && p.thumbnail.startsWith('data:image/') ? p.thumbnail : undefined,
    floors: p.floors.map((f) => ({
      ...f,
      id: isStr(f.id) ? f.id : uid('f'),
      walls: f.walls.map((w) => ({ ...w, color: isStr(w.color) ? w.color : DEFAULT_WALL_COLOR })),
      rooms: f.rooms.map((r) => ({ ...r, name: isStr(r.name) ? r.name : '', floor: isStr(r.floor) ? r.floor : DEFAULT_FLOOR_COLOR })),
      openings: f.openings.map((o) => ({ ...o, id: isStr(o.id) ? o.id : uid('o'), height: isNum(o.height) ? o.height : 200, sill: isNum(o.sill) ? o.sill : 0 })),
      items: f.items.map((i) => ({ ...i, id: isStr(i.id) ? i.id : uid('i'), rotation: isNum(i.rotation) ? i.rotation : 0, elevation: isNum(i.elevation) ? i.elevation : 0, color: isStr(i.color) ? i.color : '#999999' })),
    })),
  };
}

const rect = (x: number, y: number, w: number, h: number): Vec2[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** The wall under point p (within 1 cm), and how far along it p sits. */
export function wallAt(floor: Floor, p: Vec2): { wall: Wall; offset: number } | null {
  for (const wall of floor.walls) {
    const hit = projectOnSegment(p, wall.a, wall.b);
    if (hit.distance < 1) return { wall, offset: hit.t * wallLength(wall) };
  }
  return null;
}

/** Put an opening on whichever wall lies under segment a-b, `at` cm from a. */
function openingAt(floor: Floor, a: Vec2, b: Vec2, at: number, kind: OpeningKind, width: number, height: number, sill: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const p = { x: a.x + ((b.x - a.x) / len) * at, y: a.y + ((b.y - a.y) / len) * at };
  const hit = wallAt(floor, p);
  if (hit) addOpening(floor, hit.wall, kind, hit.offset, width, height, sill);
}

type Names = { living: string; kitchen: string; bedroom: string; bathroom: string; hall: string; mainRoom: string };

export function studioTemplate(p: Project, n: Names) {
  const f = p.floors[0];
  addRoom(f, rect(0, 0, 600, 450), n.mainRoom, '#d9c3a3');
  addRoom(f, [{ x: 600, y: 0 }, { x: 830, y: 0 }, { x: 830, y: 230 }, { x: 600, y: 230 }], n.bathroom, '#cfd8dc');
  addRoom(f, [{ x: 600, y: 230 }, { x: 830, y: 230 }, { x: 830, y: 450 }, { x: 600, y: 450 }], n.hall, '#bcaaa4');
  openingAt(f, { x: 0, y: 450 }, { x: 600, y: 450 }, 300, 'window', 240, 215, 5);
  openingAt(f, { x: 0, y: 0 }, { x: 0, y: 450 }, 225, 'window', 100, 125, 90);
  openingAt(f, { x: 600, y: 230 }, { x: 600, y: 450 }, 110, 'door', 83, 204, 0);
  openingAt(f, { x: 600, y: 230 }, { x: 830, y: 230 }, 115, 'door', 73, 204, 0);
  openingAt(f, { x: 830, y: 230 }, { x: 830, y: 450 }, 110, 'door', 93, 204, 0);
  addItem(f, 'sofa-2', 360, 380, 180);
  addItem(f, 'coffee-table', 360, 280);
  addItem(f, 'tv-unit', 360, 30);
  addItem(f, 'bed-double', 110, 130, 270);
  addItem(f, 'nightstand', 30, 245, 270);
  addItem(f, 'counter-120', 480, 38);
  addItem(f, 'stove', 570, 38);
  addItem(f, 'plant', 560, 410);
  addItem(f, 'shower', 785, 45);
  addItem(f, 'toilet', 640, 40);
  addItem(f, 'washbasin', 700, 205, 180);
}

export function apartmentTemplate(p: Project, n: Names) {
  const f = p.floors[0];
  addRoom(f, rect(0, 0, 620, 480), n.living, '#d9c3a3');
  addRoom(f, rect(620, 0, 320, 300), n.kitchen, '#e0e0e0');
  addRoom(f, rect(620, 300, 320, 180), n.hall, '#bcaaa4');
  addRoom(f, rect(0, 480, 380, 360), n.bedroom, '#c8b29a');
  addRoom(f, rect(380, 480, 280, 360), n.bedroom + ' 2', '#c8b29a');
  addRoom(f, rect(660, 480, 280, 360), n.bathroom, '#cfd8dc');
  openingAt(f, { x: 0, y: 0 }, { x: 620, y: 0 }, 310, 'window', 240, 215, 5);
  openingAt(f, { x: 620, y: 0 }, { x: 940, y: 0 }, 160, 'window', 120, 125, 95);
  openingAt(f, { x: 0, y: 840 }, { x: 380, y: 840 }, 190, 'window', 140, 135, 85);
  openingAt(f, { x: 380, y: 840 }, { x: 660, y: 840 }, 140, 'window', 120, 135, 85);
  openingAt(f, { x: 940, y: 480 }, { x: 940, y: 840 }, 180, 'window', 60, 75, 120);
  openingAt(f, { x: 940, y: 300 }, { x: 940, y: 480 }, 90, 'door', 93, 204, 0);
  openingAt(f, { x: 620, y: 300 }, { x: 620, y: 480 }, 90, 'door', 146, 204, 0);
  openingAt(f, { x: 620, y: 300 }, { x: 940, y: 300 }, 160, 'door', 83, 204, 0);
  openingAt(f, { x: 0, y: 480 }, { x: 380, y: 480 }, 320, 'door', 83, 204, 0);
  openingAt(f, { x: 380, y: 480 }, { x: 660, y: 480 }, 200, 'door', 83, 204, 0);
  openingAt(f, { x: 660, y: 480 }, { x: 940, y: 480 }, 60, 'door', 73, 204, 0);
  // living room: TV on the left wall, sofa facing it, dining table by the kitchen
  addItem(f, 'tv-unit', 25, 240, 270);
  addItem(f, 'rug', 185, 240, 90);
  addItem(f, 'coffee-table', 175, 240, 90);
  addItem(f, 'sofa-3', 300, 240, 90);
  addItem(f, 'armchair', 175, 395, 180);
  addItem(f, 'plant', 35, 440);
  addItem(f, 'bookshelf', 25, 70, 270);
  addItem(f, 'floor-lamp', 300, 90);
  addItem(f, 'table-6', 495, 150, 90);
  addItem(f, 'chair', 425, 105, 270);
  addItem(f, 'chair', 425, 195, 270);
  addItem(f, 'chair', 565, 105, 90);
  addItem(f, 'chair', 565, 195, 90);
  // kitchen
  addItem(f, 'counter-120', 700, 32);
  addItem(f, 'sink-counter', 800, 32);
  addItem(f, 'stove', 870, 32);
  addItem(f, 'fridge', 900, 245, 90);
  addItem(f, 'kitchen-island', 760, 170);
  // bedrooms
  addItem(f, 'bed-double', 190, 720, 180);
  addItem(f, 'nightstand', 85, 805, 180);
  addItem(f, 'nightstand', 295, 805, 180);
  addItem(f, 'wardrobe', 120, 520);
  addItem(f, 'bed-single', 470, 730, 180);
  addItem(f, 'desk', 620, 700, 90);
  addItem(f, 'office-chair', 570, 700, 270);
  // bathroom
  addItem(f, 'bathtub', 845, 800);
  addItem(f, 'toilet', 905, 620, 90);
  addItem(f, 'washbasin', 690, 640, 270);
  addItem(f, 'washing-machine', 695, 735, 270);
}

export function projectStats(p: Project) {
  let walls = 0;
  let items = 0;
  let area = 0;
  for (const f of p.floors) {
    walls += f.walls.length;
    items += f.items.length;
    for (const r of f.rooms) area += polygonArea(r.points);
  }
  return { walls, items, area, floors: p.floors.length };
}
