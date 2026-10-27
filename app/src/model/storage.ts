import { validateProject } from './project';
import type { Project } from './types';

/** Where projects live. v1 is the browser; a server-backed store can replace it later. */
export interface ProjectStore {
  list(): Project[];
  get(id: string): Project | null;
  save(p: Project): void;
  remove(id: string): void;
}

export class StorageFullError extends Error {}

const INDEX_KEY = 'bmtplan.index';
const PROJECT_KEY = (id: string) => `bmtplan.project.${id}`;

export class LocalProjectStore implements ProjectStore {
  constructor(private storage: Storage = localStorage) {}

  private ids(): string[] {
    try {
      const raw = this.storage.getItem(INDEX_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private writeIds(ids: string[]) {
    this.storage.setItem(INDEX_KEY, JSON.stringify(ids));
  }

  list(): Project[] {
    return this.ids()
      .map((id) => this.get(id))
      .filter((p): p is Project => !!p)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): Project | null {
    try {
      const raw = this.storage.getItem(PROJECT_KEY(id));
      return raw ? validateProject(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  save(p: Project) {
    try {
      this.storage.setItem(PROJECT_KEY(p.id), JSON.stringify(p));
      const ids = this.ids();
      if (!ids.includes(p.id)) this.writeIds([p.id, ...ids]);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        throw new StorageFullError();
      }
      throw e;
    }
  }

  remove(id: string) {
    try {
      this.storage.removeItem(PROJECT_KEY(id));
      this.writeIds(this.ids().filter((x) => x !== id));
    } catch {
      /* nothing to do */
    }
  }
}

/** In-memory store, for when the browser blocks storage (private mode, tests). */
export class MemoryProjectStore implements ProjectStore {
  private map = new Map<string, Project>();
  list() {
    return [...this.map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  get(id: string) {
    const p = this.map.get(id);
    return p ? (JSON.parse(JSON.stringify(p)) as Project) : null;
  }
  save(p: Project) {
    this.map.set(p.id, JSON.parse(JSON.stringify(p)));
  }
  remove(id: string) {
    this.map.delete(id);
  }
}

export function createStore(): ProjectStore {
  try {
    const k = 'bmtplan.probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return new LocalProjectStore();
  } catch {
    return new MemoryProjectStore();
  }
}
