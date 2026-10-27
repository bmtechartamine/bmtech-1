import { describe, expect, it } from 'vitest';
import {
  clampOpeningOffset,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  projectOnSegment,
  snapAngle,
  uncoveredParts,
} from '../src/model/geometry';
import { History } from '../src/model/history';
import {
  addItem,
  addOpening,
  addRoom,
  apartmentTemplate,
  moveCorner,
  newProject,
  studioTemplate,
  validateProject,
  wallAt,
} from '../src/model/project';
import { decodeProject, encodeProject } from '../src/model/share';
import { MemoryProjectStore } from '../src/model/storage';
import { formatArea, formatLength, parseLength } from '../src/model/units';

const names = { living: 'Séjour', kitchen: 'Cuisine', bedroom: 'Chambre', bathroom: 'SdB', hall: 'Entrée', mainRoom: 'Pièce' };
const square = (s: number, x = 0, y = 0) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];

describe('geometry', () => {
  it('computes area and centroid of a rectangle', () => {
    expect(polygonArea(square(400))).toBe(160000);
    expect(polygonCentroid(square(400))).toEqual({ x: 200, y: 200 });
  });

  it('computes area of an L-shaped room regardless of winding', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 400 },
      { x: 0, y: 400 },
    ];
    expect(polygonArea(l)).toBe(120000);
    expect(polygonArea([...l].reverse())).toBe(120000);
    expect(pointInPolygon({ x: 300, y: 300 }, l)).toBe(false);
    expect(pointInPolygon({ x: 100, y: 300 }, l)).toBe(true);
  });

  it('projects onto a segment and clamps to its ends', () => {
    const r = projectOnSegment({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(r.point).toEqual({ x: 50, y: 0 });
    expect(r.distance).toBe(30);
    expect(projectOnSegment({ x: -20, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }).t).toBe(0);
  });

  it('snaps to 45 degree steps', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 4 });
    expect(Math.round(p.y)).toBe(0);
    expect(Math.round(p.x)).toBe(100);
  });

  it('keeps openings inside their wall', () => {
    expect(clampOpeningOffset(10, 80, 300)).toBe(45);
    expect(clampOpeningOffset(290, 80, 300)).toBe(255);
    expect(clampOpeningOffset(150, 400, 300)).toBe(150);
  });

  it('subtracts the parts of a wall already covered', () => {
    const parts = uncoveredParts({ x: 0, y: 0 }, { x: 600, y: 0 }, [
      [{ x: 0, y: 0 }, { x: 200, y: 0 }],
      [{ x: 400, y: 0 }, { x: 300, y: 0 }],
      [{ x: 0, y: 50 }, { x: 600, y: 50 }],
    ]);
    expect(parts).toEqual([
      [{ x: 200, y: 0 }, { x: 300, y: 0 }],
      [{ x: 400, y: 0 }, { x: 600, y: 0 }],
    ]);
  });
});

describe('project', () => {
  it('creates a room with four walls, and a neighbour shares the common wall', () => {
    const p = newProject('Test', 'RDC');
    const f = p.floors[0];
    addRoom(f, square(400), 'A');
    expect(f.walls).toHaveLength(4);
    addRoom(f, square(400, 400, 0), 'B');
    expect(f.rooms).toHaveLength(2);
    expect(f.walls).toHaveLength(7);
  });

  it('refuses degenerate rooms', () => {
    const f = newProject('T', 'RDC').floors[0];
    expect(addRoom(f, [{ x: 0, y: 0 }, { x: 100, y: 0 }], 'x')).toBeNull();
    expect(addRoom(f, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], 'x')).toBeNull();
  });

  it('keeps corners joined and openings in range when a corner moves', () => {
    const f = newProject('T', 'RDC').floors[0];
    addRoom(f, square(400), 'A');
    const hit = wallAt(f, { x: 350, y: 0 })!;
    const op = addOpening(f, hit.wall, 'door', hit.offset, 80, 204, 0);
    moveCorner(f, { x: 400, y: 0 }, { x: 200, y: 0 });
    const top = f.walls.find((w) => w.id === op.wallId)!;
    expect(top.b).toEqual({ x: 200, y: 0 });
    expect(f.walls.filter((w) => (w.a.x === 200 && w.a.y === 0) || (w.b.x === 200 && w.b.y === 0))).toHaveLength(2);
    expect(op.offset).toBeLessThanOrEqual(200 - 40 - 5);
  });

  it('builds both templates with walls, openings and furniture on valid walls', () => {
    for (const tpl of [studioTemplate, apartmentTemplate]) {
      const p = newProject('T', 'RDC');
      tpl(p, names);
      const f = p.floors[0];
      expect(f.rooms.length).toBeGreaterThan(2);
      expect(f.openings.length).toBeGreaterThan(4);
      expect(f.items.length).toBeGreaterThan(8);
      const ids = new Set(f.walls.map((w) => w.id));
      expect(f.openings.every((o) => ids.has(o.wallId))).toBe(true);
    }
  });

  it('validates imported data and rejects junk', () => {
    const p = newProject('T', 'RDC');
    addRoom(p.floors[0], square(300), 'A');
    addItem(p.floors[0], 'sofa-3', 100, 100);
    expect(validateProject(JSON.parse(JSON.stringify(p)))?.floors[0].walls).toHaveLength(4);
    expect(validateProject({ name: 'x' })).toBeNull();
    expect(validateProject({ name: 'x', floors: [{ name: 'a', height: 1, walls: [{}], rooms: [], openings: [], items: [] }] })).toBeNull();
    expect(validateProject('nope')).toBeNull();
  });
});

describe('units', () => {
  it('formats metric and imperial', () => {
    expect(formatLength(250, 'metric')).toBe('2.5 m');
    expect(formatLength(85, 'metric')).toBe('85 cm');
    expect(formatLength(304.8, 'imperial')).toBe('10′');
    expect(formatLength(320, 'imperial')).toBe('10′ 6″');
    expect(formatArea(120000, 'metric')).toBe('12.00 m²');
  });

  it('parses what people type', () => {
    expect(parseLength('250', 'metric')).toBe(250);
    expect(parseLength('2,5 m', 'metric')).toBe(250);
    expect(parseLength('2.5m', 'metric')).toBe(250);
    expect(parseLength('10\'', 'metric')).toBeCloseTo(304.8);
    expect(parseLength('8\' 6"', 'metric')).toBeCloseTo(259.08);
    expect(parseLength('12', 'imperial')).toBeCloseTo(30.48);
    expect(parseLength('abc', 'metric')).toBeNull();
    expect(parseLength('0', 'metric')).toBeNull();
    expect(parseLength('-3', 'metric')).toBeNull();
  });
});

describe('history', () => {
  it('undoes and redoes, and a new change clears redo', () => {
    const h = new History(3);
    h.push('a');
    h.push('b');
    expect(h.undo('c')).toBe('b');
    expect(h.redo('b')).toBe('c');
    h.push('c');
    expect(h.canRedo).toBe(false);
    h.push('d');
    h.push('e');
    expect(h.undo('f')).toBe('e');
    expect(h.undo('e')).toBe('d');
    expect(h.undo('d')).toBe('c');
    expect(h.undo('c')).toBeNull();
  });
});

describe('share and storage', () => {
  it('round-trips a project through a link payload', async () => {
    const p = newProject('Partage', 'RDC');
    apartmentTemplate(p, names);
    p.thumbnail = 'data:image/png;base64,AAAA';
    const payload = await encodeProject(p);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = await decodeProject(payload);
    expect(back?.name).toBe('Partage');
    expect(back?.thumbnail).toBeUndefined();
    expect(back?.floors[0].walls).toEqual(p.floors[0].walls);
    expect(await decodeProject('broken!!')).toBeNull();
  });

  it('stores, lists newest first, and removes', () => {
    const s = new MemoryProjectStore();
    const a = newProject('A', 'RDC');
    const b = newProject('B', 'RDC');
    a.updatedAt = 1;
    b.updatedAt = 2;
    s.save(a);
    s.save(b);
    expect(s.list().map((p) => p.name)).toEqual(['B', 'A']);
    s.remove(b.id);
    expect(s.list()).toHaveLength(1);
  });
});
