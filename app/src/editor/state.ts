import type { CatalogEntry } from '../catalog/catalog';
import { History } from '../model/history';
import type { Floor, Project } from '../model/types';

export type Tool = 'select' | 'room' | 'wall' | 'pan' | 'place';
export type SelectionKind = 'wall' | 'room' | 'opening' | 'item';
export interface Selection {
  kind: SelectionKind;
  id: string;
}
export type ViewMode = '2d' | '3d';

type Listener = (what: Set<'model' | 'selection' | 'tool' | 'view' | 'floor' | 'meta'>) => void;

/**
 * Everything the editor screens share. Changes to the model go through `commit`,
 * which records undo history and schedules a save.
 */
export class EditorState {
  floorIndex = 0;
  selection: Selection | null = null;
  tool: Tool = 'select';
  placing: CatalogEntry | null = null;
  view: ViewMode = '2d';
  readonly history = new History(100);
  private listeners = new Set<Listener>();
  private pending = new Set<'model' | 'selection' | 'tool' | 'view' | 'floor' | 'meta'>();
  private scheduled = false;
  private gestureOpen = false;

  constructor(
    public project: Project,
    public readonly readOnly = false,
  ) {}

  get floor(): Floor {
    return this.project.floors[this.floorIndex];
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(...what: ('model' | 'selection' | 'tool' | 'view' | 'floor' | 'meta')[]) {
    for (const w of what) this.pending.add(w);
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const set = new Set(this.pending);
      this.pending.clear();
      for (const fn of this.listeners) fn(set);
    });
  }

  private snapshot() {
    return JSON.stringify({ floors: this.project.floors, name: this.project.name, units: this.project.units });
  }

  /** Apply one change to the project as a single undo step. */
  commit(fn: (floor: Floor, project: Project) => void) {
    if (this.readOnly) return;
    if (!this.gestureOpen) this.history.push(this.snapshot());
    fn(this.floor, this.project);
    this.project.updatedAt = Date.now();
    this.notify('model');
  }

  /**
   * For drags: the first `commit` records history, later ones in the same gesture
   * do not, so a whole drag undoes in one step.
   */
  beginGesture() {
    if (this.readOnly) return;
    this.history.push(this.snapshot());
    this.gestureOpen = true;
  }

  endGesture() {
    this.gestureOpen = false;
  }

  private restore(json: string) {
    const s = JSON.parse(json);
    this.project.floors = s.floors;
    this.project.name = s.name;
    this.project.units = s.units;
    this.project.updatedAt = Date.now();
    this.floorIndex = Math.min(this.floorIndex, this.project.floors.length - 1);
    if (this.selection && !this.find(this.selection)) this.selection = null;
    this.notify('model', 'selection', 'floor', 'meta');
  }

  undo() {
    const prev = this.history.undo(this.snapshot());
    if (prev) this.restore(prev);
  }

  redo() {
    const next = this.history.redo(this.snapshot());
    if (next) this.restore(next);
  }

  select(sel: Selection | null) {
    this.selection = sel;
    this.notify('selection');
  }

  setTool(tool: Tool, placing: CatalogEntry | null = null) {
    this.tool = tool;
    this.placing = placing;
    if (tool !== 'select') this.selection = null;
    this.notify('tool', 'selection');
  }

  setFloor(i: number) {
    this.floorIndex = Math.max(0, Math.min(this.project.floors.length - 1, i));
    this.selection = null;
    this.notify('floor', 'selection', 'model');
  }

  setView(v: ViewMode) {
    this.view = v;
    this.notify('view');
  }

  find(sel: Selection) {
    const f = this.floor;
    switch (sel.kind) {
      case 'wall':
        return f.walls.find((x) => x.id === sel.id);
      case 'room':
        return f.rooms.find((x) => x.id === sel.id);
      case 'opening':
        return f.openings.find((x) => x.id === sel.id);
      case 'item':
        return f.items.find((x) => x.id === sel.id);
    }
  }
}
