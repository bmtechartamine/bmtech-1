import { CATALOG, CATEGORIES, getFurniture, type CategoryId } from '../catalog/catalog';
import { catLabel, count, getLang, t, type Key } from '../i18n';
import { polygonArea, wallLength } from '../model/geometry';
import { duplicateItem, fixOpenings, moveCorner, removeRoom, removeWall, roomWalls } from '../model/project';
import { MAX_FLOORS, type Item, type Opening, type Units } from '../model/types';
import { fieldUnit, formatArea, formatLength, parseLength, toField } from '../model/units';
import { clear, h } from '../ui/dom';
import { icon } from '../ui/icons';
import { confirmDialog } from '../ui/overlay';
import { drawCatalogThumb } from './render2d';
import type { EditorState } from './state';

// ---------- catalogue ----------

export class CatalogPanel {
  readonly el = h('div', { class: 'panel', role: 'tabpanel', id: 'panel-catalog' });
  private query = '';
  private cat: CategoryId | 'all' = 'all';
  private list = h('div', { class: 'items' });
  private chips = h('div', { class: 'cats', role: 'group' });

  constructor(private state: EditorState) {
    const input = h('input', {
      class: 'input',
      type: 'search',
      placeholder: t('search'),
      'aria-label': t('search'),
      on: {
        input: () => {
          this.query = input.value;
          this.renderList();
        },
      },
    });
    this.el.append(h('div', { class: 'search' }, icon('search', 18), input), this.chips, this.list);
    this.renderChips();
    this.renderList();
    state.on((w) => {
      if (w.has('tool')) this.markActive();
    });
  }

  private renderChips() {
    clear(this.chips);
    const chip = (id: CategoryId | 'all', label: string) =>
      h(
        'button',
        {
          class: 'chip',
          'aria-pressed': String(this.cat === id),
          on: {
            click: () => {
              this.cat = id;
              this.renderChips();
              this.renderList();
            },
          },
        },
        label,
      );
    this.chips.append(chip('all', getLang() === 'en' ? 'All' : 'Tout'));
    for (const c of CATEGORIES) this.chips.append(chip(c.id, `${c.icon} ${catLabel(c.id)}`));
  }

  private renderList() {
    clear(this.list);
    const q = norm(this.query);
    const lang = getLang();
    const items = CATALOG.filter(
      (e) => (this.cat === 'all' || e.category === this.cat) && (!q || norm(e.name[lang]).includes(q) || norm(e.name.fr).includes(q) || norm(e.name.en).includes(q)),
    );
    if (!items.length) {
      this.list.append(h('p', { class: 'muted', style: 'grid-column: 1 / -1' }, t('noResults')));
      return;
    }
    for (const e of items) {
      const canvas = h('canvas', { width: 72, height: 56 });
      const dims = e.category === 'openings' ? `${e.width} × ${e.height}` : `${e.w} × ${e.d}`;
      const btn = h(
        'button',
        {
          class: 'item',
          draggable: 'true',
          'data-id': e.id,
          'aria-pressed': 'false',
          'aria-label': e.name[lang],
          title: e.name[lang],
          on: {
            click: () => {
              const same = this.state.tool === 'place' && this.state.placing?.id === e.id;
              this.state.setTool(same ? 'select' : 'place', same ? null : e);
            },
            dragstart: (ev) => {
              ev.dataTransfer?.setData('text/bmt-catalog', e.id);
              if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
            },
          },
        },
        canvas,
        h('span', {}, e.name[lang]),
        h('small', {}, dims),
      );
      this.list.append(btn);
      drawCatalogThumb(canvas, e.id);
    }
    this.markActive();
  }

  private markActive() {
    for (const b of this.list.querySelectorAll<HTMLElement>('.item')) {
      b.setAttribute('aria-pressed', String(this.state.tool === 'place' && this.state.placing?.id === b.dataset.id));
    }
  }

  refreshLanguage() {
    this.renderChips();
    this.renderList();
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ---------- properties ----------

export class PropertiesPanel {
  readonly el = h('div', { class: 'panel props', role: 'tabpanel', id: 'panel-props' });

  constructor(
    private state: EditorState,
    private onFloorsChanged: () => void,
  ) {
    state.on((w) => {
      if (w.has('selection') || w.has('model') || w.has('floor') || w.has('meta')) this.render();
    });
    this.render();
  }

  render() {
    // keep the field being typed in when re-rendering after its own change
    const active = document.activeElement as HTMLElement | null;
    const activeKey = active && this.el.contains(active) ? active.dataset.key : undefined;
    clear(this.el);
    const s = this.state;
    const sel = s.selection;
    const obj = sel ? s.find(sel) : undefined;
    if (!sel || !obj) this.renderFloor();
    else if (sel.kind === 'wall') this.renderWall(sel.id);
    else if (sel.kind === 'room') this.renderRoom(sel.id);
    else if (sel.kind === 'opening') this.renderOpening(sel.id);
    else this.renderItem(sel.id);
    if (activeKey) {
      const again = this.el.querySelector<HTMLElement>(`[data-key="${activeKey}"]`);
      again?.focus();
    }
  }

  private append(...nodes: (Node | null)[]) {
    this.el.append(...nodes.filter((n): n is Node => !!n));
  }

  private get units(): Units {
    return this.state.project.units;
  }

  /** A length field: shows cm or inches, accepts "2.5 m", "8'6"" and so on. */
  private lengthField(key: string, label: Key, cm: number, apply: (v: number) => void, min = 1, max = 5000) {
    const input = h('input', {
      class: 'input',
      inputmode: 'decimal',
      value: String(toField(cm, this.units)),
      'data-key': key,
      'aria-label': t(label),
    });
    const commit = () => {
      const v = min === 0 && /^\s*0+([.,]0*)?\s*(cm|m|in|mm)?\s*$/i.test(input.value) ? 0 : parseLength(input.value, this.units);
      if (v === null || v < min || v > max) {
        input.setAttribute('aria-invalid', 'true');
        input.title = t('invalidLength');
        return;
      }
      input.removeAttribute('aria-invalid');
      if (Math.abs(v - cm) > 0.05) apply(v);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commit();
        input.blur();
      }
    });
    return h('label', { class: 'field' }, h('span', {}, t(label)), h('div', { class: 'unit-input', 'data-unit': fieldUnit(this.units) }, input));
  }

  private numberField(key: string, label: Key, value: number, unit: string, apply: (v: number) => void) {
    const input = h('input', { class: 'input', type: 'number', value: String(value), step: '1', 'data-key': key, 'aria-label': t(label) });
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) apply(v);
    });
    return h('label', { class: 'field' }, h('span', {}, t(label)), h('div', { class: 'unit-input', 'data-unit': unit }, input));
  }

  private colorField(key: string, label: Key, value: string, apply: (v: string) => void) {
    const input = h('input', { class: 'swatch', type: 'color', value, 'data-key': key, 'aria-label': t(label) });
    input.addEventListener('change', () => apply(input.value));
    return h('label', { class: 'field' }, h('span', {}, t(label)), input);
  }

  private deleteButton(onClick: () => void) {
    return h('button', { class: 'btn btn-secondary', on: { click: onClick } }, icon('trash', 18), t('delete'));
  }

  private head(kind: string, title: string) {
    return h('div', {}, h('div', { class: 'badge' }, kind), h('h3', {}, title));
  }

  private renderFloor() {
    const s = this.state;
    const f = s.floor;
    const area = f.rooms.reduce((a, r) => a + polygonArea(r.points), 0);
    const nameInput = h('input', { class: 'input', value: f.name, maxlength: 60, 'data-key': 'floor-name', 'aria-label': t('name') });
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim();
      if (v) {
        s.commit((fl) => (fl.name = v));
        this.onFloorsChanged();
      }
    });
    this.append(
      h('div', { class: 'empty-props' }, h('strong', {}, t('nothingSelected')), t('nothingSelectedHint')),
      this.head(t('floors'), f.name),
      h('label', { class: 'field' }, h('span', {}, t('name')), nameInput),
      this.lengthField('floor-h', 'height', f.height, (v) =>
        s.commit((fl) => {
          fl.height = v;
          for (const w of fl.walls) w.height = v;
          for (const o of fl.openings) o.height = Math.min(o.height, v - o.sill - 5);
        }),
        180,
        600,
      ),
      h('div', { class: 'readout' }, h('span', {}, t('area')), h('strong', {}, formatArea(area, this.units))),
      h(
        'div',
        { class: 'readout' },
        h('span', {}, `${count(f.walls.length, 'wall1', 'walls')} · ${count(f.rooms.length, 'room1', 'rooms')}`),
        h('span', {}, count(f.items.length, 'object1', 'objects')),
      ),
      s.project.floors.length > 1
        ? h(
            'div',
            { class: 'actions' },
            h(
              'button',
              {
                class: 'btn btn-secondary',
                on: {
                  click: async () => {
                    if (!(await confirmDialog(t('confirmDeleteFloor', { name: f.name }), t('delete')))) return;
                    const idx = s.floorIndex;
                    s.commit((_, p) => p.floors.splice(idx, 1));
                    s.setFloor(Math.max(0, idx - 1));
                    this.onFloorsChanged();
                  },
                },
              },
              icon('trash', 18),
              t('deleteFloor'),
            ),
          )
        : null,
    );
  }

  private renderWall(id: string) {
    const s = this.state;
    const w = s.floor.walls.find((x) => x.id === id)!;
    const len = wallLength(w);
    this.el.append(
      this.head(t('wall'), formatLength(len, this.units)),
      this.lengthField('w-len', 'length', len, (v) =>
        s.commit((f) => {
          const wall = f.walls.find((x) => x.id === id)!;
          const l = wallLength(wall);
          const to = { x: wall.a.x + ((wall.b.x - wall.a.x) / l) * v, y: wall.a.y + ((wall.b.y - wall.a.y) / l) * v };
          moveCorner(f, { ...wall.b }, to);
        }),
      ),
      h(
        'div',
        { class: 'field-row' },
        this.lengthField('w-th', 'thickness', w.thickness, (v) => s.commit((f) => (f.walls.find((x) => x.id === id)!.thickness = v)), 2, 100),
        this.lengthField('w-h', 'height', w.height, (v) => s.commit((f) => {
          f.walls.find((x) => x.id === id)!.height = v;
          fixOpenings(f);
        }), 50, 1000),
      ),
      this.colorField('w-col', 'color', w.color, (v) => s.commit((f) => (f.walls.find((x) => x.id === id)!.color = v))),
      h('div', { class: 'actions' }, this.deleteButton(() => {
        s.commit((f) => removeWall(f, id));
        s.select(null);
      })),
    );
  }

  private renderRoom(id: string) {
    const s = this.state;
    const r = s.floor.rooms.find((x) => x.id === id)!;
    const walls = roomWalls(s.floor, r);
    const perim = r.points.reduce((a, p, i) => a + Math.hypot(r.points[(i + 1) % r.points.length].x - p.x, r.points[(i + 1) % r.points.length].y - p.y), 0);
    const nameInput = h('input', { class: 'input', value: r.name, maxlength: 60, 'data-key': 'r-name', 'aria-label': t('name') });
    nameInput.addEventListener('change', () => s.commit((f) => (f.rooms.find((x) => x.id === id)!.name = nameInput.value.trim())));
    this.el.append(
      this.head(t('room'), r.name || t('room')),
      h('label', { class: 'field' }, h('span', {}, t('name')), nameInput),
      h('div', { class: 'readout' }, h('span', {}, t('area')), h('strong', {}, formatArea(polygonArea(r.points), this.units))),
      h('div', { class: 'readout' }, h('span', {}, t('perimeter')), h('strong', {}, formatLength(perim, this.units))),
      h(
        'div',
        { class: 'field-row' },
        this.colorField('r-floor', 'floorColor', r.floor, (v) => s.commit((f) => (f.rooms.find((x) => x.id === id)!.floor = v))),
        this.colorField('r-walls', 'wallColor', walls[0]?.color ?? '#f2efe9', (v) =>
          s.commit((f) => {
            const room = f.rooms.find((x) => x.id === id)!;
            for (const w of roomWalls(f, room)) w.color = v;
          }),
        ),
      ),
      h('div', { class: 'actions' }, this.deleteButton(() => {
        s.commit((f) => removeRoom(f, id));
        s.select(null);
      })),
    );
  }

  private renderOpening(id: string) {
    const s = this.state;
    const o = s.floor.openings.find((x) => x.id === id)!;
    const w = s.floor.walls.find((x) => x.id === o.wallId)!;
    const len = wallLength(w);
    const upd = (fn: (op: Opening) => void) =>
      s.commit((f) => {
        const op = f.openings.find((x) => x.id === id);
        if (op) fn(op);
        fixOpenings(f);
      });
    this.el.append(
      this.head(o.kind === 'door' ? t('door') : t('window'), formatLength(o.width, this.units)),
      h(
        'div',
        { class: 'field-row' },
        this.lengthField('o-w', 'width', o.width, (v) => upd((op) => (op.width = v)), 20, len),
        this.lengthField('o-h', 'height', o.height, (v) => upd((op) => (op.height = Math.min(v, w.height - op.sill - 2))), 20, w.height),
      ),
      h(
        'div',
        { class: 'field-row' },
        o.kind === 'window' ? this.lengthField('o-sill', 'sill', o.sill, (v) => upd((op) => (op.sill = Math.min(v, w.height - op.height - 2))), 0, w.height) : null,
        this.lengthField('o-pos', 'position', o.offset - o.width / 2, (v) => upd((op) => (op.offset = v + op.width / 2)), 0, len),
      ),
      h(
        'div',
        { class: 'actions' },
        o.kind === 'door'
          ? h('button', { class: 'btn btn-secondary', on: { click: () => upd((op) => (op.flip = !op.flip)) } }, icon('flip', 18), t('flip'))
          : null,
        this.deleteButton(() => {
          s.commit((f) => (f.openings = f.openings.filter((x) => x.id !== id)));
          s.select(null);
        }),
      ),
    );
  }

  private renderItem(id: string) {
    const s = this.state;
    const it = s.floor.items.find((x) => x.id === id)!;
    const def = getFurniture(it.catalogId);
    const lang = getLang();
    const upd = (fn: (i: Item) => void) =>
      s.commit((f) => {
        const x = f.items.find((i) => i.id === id);
        if (x) fn(x);
      });
    this.el.append(
      this.head(def ? catLabel(def.category) : '', def?.name[lang] ?? it.catalogId),
      h(
        'div',
        { class: 'field-row' },
        this.lengthField('i-w', 'width', it.w, (v) => upd((i) => (i.w = v)), 1, 2000),
        this.lengthField('i-d', 'depth', it.d, (v) => upd((i) => (i.d = v)), 1, 2000),
      ),
      h(
        'div',
        { class: 'field-row' },
        this.lengthField('i-h', 'height', it.h, (v) => upd((i) => (i.h = v)), 1, 1000),
        this.lengthField('i-e', 'elevation', it.elevation, (v) => upd((i) => (i.elevation = v)), 0, 1000),
      ),
      h(
        'div',
        { class: 'field-row' },
        this.numberField('i-rot', 'rotation', it.rotation, '°', (v) => upd((i) => (i.rotation = ((Math.round(v) % 360) + 360) % 360))),
        this.colorField('i-col', 'color', it.color, (v) => upd((i) => (i.color = v))),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn-secondary', on: { click: () => upd((i) => (i.rotation = (i.rotation + 90) % 360)) } }, icon('rotate', 18), t('rotate90')),
        h(
          'button',
          {
            class: 'btn btn-secondary',
            on: {
              click: () => {
                let copyId = '';
                s.commit((f) => {
                  const src = f.items.find((i) => i.id === id);
                  if (src) copyId = duplicateItem(f, src).id;
                });
                if (copyId) s.select({ kind: 'item', id: copyId });
              },
            },
          },
          icon('copy', 18),
          t('duplicate'),
        ),
        this.deleteButton(() => {
          s.commit((f) => (f.items = f.items.filter((i) => i.id !== id)));
          s.select(null);
        }),
      ),
    );
  }
}

// ---------- floors ----------

export function renderFloors(host: HTMLElement, state: EditorState, onAdd: () => void) {
  clear(host);
  host.append(h('span', { class: 'sr-only' }, t('floors')), icon('layers', 18));
  state.project.floors.forEach((f, i) => {
    host.append(
      h(
        'button',
        { class: 'btn btn-sm btn-ghost', 'aria-pressed': String(i === state.floorIndex), on: { click: () => state.setFloor(i) } },
        f.name,
      ),
    );
  });
  if (!state.readOnly) {
    const full = state.project.floors.length >= MAX_FLOORS;
    host.append(
      h(
        'button',
        { class: 'btn btn-sm btn-icon btn-ghost', disabled: full, title: full ? t('maxFloors') : t('addFloor'), 'aria-label': t('addFloor'), on: { click: onAdd } },
        icon('plus', 18),
      ),
    );
  }
}

