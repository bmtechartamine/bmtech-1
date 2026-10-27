import type { OpeningKind } from '../model/types';

export type CategoryId =
  | 'openings'
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'dining'
  | 'office'
  | 'decor';

/** How the item is drawn, in 2D and in 3D. Several catalogue entries can share a shape. */
export type Shape =
  | 'sofa'
  | 'armchair'
  | 'coffee-table'
  | 'tv-unit'
  | 'bookshelf'
  | 'bed'
  | 'nightstand'
  | 'wardrobe'
  | 'dresser'
  | 'counter'
  | 'sink-counter'
  | 'stove'
  | 'fridge'
  | 'kitchen-island'
  | 'table'
  | 'round-table'
  | 'chair'
  | 'desk'
  | 'office-chair'
  | 'toilet'
  | 'bathtub'
  | 'shower'
  | 'washbasin'
  | 'washing-machine'
  | 'plant'
  | 'floor-lamp'
  | 'rug'
  | 'tv'
  | 'stairs';

export interface Category {
  id: CategoryId;
  icon: string;
}

export interface FurnitureDef {
  id: string;
  category: Exclude<CategoryId, 'openings'>;
  shape: Shape;
  name: { fr: string; en: string };
  w: number;
  d: number;
  h: number;
  elevation?: number;
  color: string;
}

export interface OpeningDef {
  id: string;
  category: 'openings';
  kind: OpeningKind;
  name: { fr: string; en: string };
  width: number;
  height: number;
  sill: number;
}

export type CatalogEntry = FurnitureDef | OpeningDef;

export const CATEGORIES: Category[] = [
  { id: 'openings', icon: '🚪' },
  { id: 'living', icon: '🛋️' },
  { id: 'bedroom', icon: '🛏️' },
  { id: 'kitchen', icon: '🍳' },
  { id: 'bathroom', icon: '🛁' },
  { id: 'dining', icon: '🍽️' },
  { id: 'office', icon: '💼' },
  { id: 'decor', icon: '🪴' },
];

const OPENINGS: OpeningDef[] = [
  { id: 'door-single', category: 'openings', kind: 'door', name: { fr: 'Porte', en: 'Door' }, width: 83, height: 204, sill: 0 },
  { id: 'door-wide', category: 'openings', kind: 'door', name: { fr: 'Porte large', en: 'Wide door' }, width: 93, height: 204, sill: 0 },
  { id: 'door-double', category: 'openings', kind: 'door', name: { fr: 'Porte double', en: 'Double door' }, width: 146, height: 204, sill: 0 },
  { id: 'door-french', category: 'openings', kind: 'door', name: { fr: 'Porte-fenêtre', en: 'French door' }, width: 140, height: 215, sill: 0 },
  { id: 'window-small', category: 'openings', kind: 'window', name: { fr: 'Petite fenêtre', en: 'Small window' }, width: 60, height: 75, sill: 120 },
  { id: 'window', category: 'openings', kind: 'window', name: { fr: 'Fenêtre', en: 'Window' }, width: 100, height: 125, sill: 90 },
  { id: 'window-wide', category: 'openings', kind: 'window', name: { fr: 'Grande fenêtre', en: 'Wide window' }, width: 180, height: 135, sill: 85 },
  { id: 'window-bay', category: 'openings', kind: 'window', name: { fr: 'Baie vitrée', en: 'Picture window' }, width: 240, height: 215, sill: 5 },
];

const FURNITURE: FurnitureDef[] = [
  // living
  { id: 'sofa-3', category: 'living', shape: 'sofa', name: { fr: 'Canapé 3 places', en: '3-seat sofa' }, w: 220, d: 92, h: 85, color: '#6b7a8f' },
  { id: 'sofa-2', category: 'living', shape: 'sofa', name: { fr: 'Canapé 2 places', en: '2-seat sofa' }, w: 165, d: 90, h: 85, color: '#9a6b4f' },
  { id: 'armchair', category: 'living', shape: 'armchair', name: { fr: 'Fauteuil', en: 'Armchair' }, w: 85, d: 85, h: 90, color: '#c49a5a' },
  { id: 'coffee-table', category: 'living', shape: 'coffee-table', name: { fr: 'Table basse', en: 'Coffee table' }, w: 110, d: 60, h: 42, color: '#8b6a4a' },
  { id: 'tv-unit', category: 'living', shape: 'tv-unit', name: { fr: 'Meuble TV', en: 'TV unit' }, w: 180, d: 42, h: 50, color: '#3d3d3d' },
  { id: 'tv', category: 'living', shape: 'tv', name: { fr: 'Télévision', en: 'Television' }, w: 123, d: 8, h: 72, elevation: 52, color: '#111111' },
  { id: 'bookshelf', category: 'living', shape: 'bookshelf', name: { fr: 'Bibliothèque', en: 'Bookshelf' }, w: 100, d: 35, h: 200, color: '#b08d68' },
  // bedroom
  { id: 'bed-double', category: 'bedroom', shape: 'bed', name: { fr: 'Lit double', en: 'Double bed' }, w: 160, d: 210, h: 100, color: '#e8e1d5' },
  { id: 'bed-queen', category: 'bedroom', shape: 'bed', name: { fr: 'Grand lit', en: 'King bed' }, w: 180, d: 210, h: 100, color: '#dcd3c4' },
  { id: 'bed-single', category: 'bedroom', shape: 'bed', name: { fr: 'Lit simple', en: 'Single bed' }, w: 90, d: 200, h: 90, color: '#c9d6e3' },
  { id: 'nightstand', category: 'bedroom', shape: 'nightstand', name: { fr: 'Table de chevet', en: 'Nightstand' }, w: 45, d: 40, h: 50, color: '#a07f5d' },
  { id: 'wardrobe', category: 'bedroom', shape: 'wardrobe', name: { fr: 'Armoire', en: 'Wardrobe' }, w: 150, d: 60, h: 220, color: '#ece7df' },
  { id: 'dresser', category: 'bedroom', shape: 'dresser', name: { fr: 'Commode', en: 'Dresser' }, w: 100, d: 48, h: 85, color: '#b38b63' },
  // kitchen
  { id: 'counter', category: 'kitchen', shape: 'counter', name: { fr: 'Meuble bas', en: 'Base cabinet' }, w: 60, d: 60, h: 90, color: '#f4f4f2' },
  { id: 'counter-120', category: 'kitchen', shape: 'counter', name: { fr: 'Plan de travail 120', en: 'Counter 120' }, w: 120, d: 60, h: 90, color: '#f4f4f2' },
  { id: 'sink-counter', category: 'kitchen', shape: 'sink-counter', name: { fr: 'Évier', en: 'Kitchen sink' }, w: 80, d: 60, h: 90, color: '#f4f4f2' },
  { id: 'stove', category: 'kitchen', shape: 'stove', name: { fr: 'Cuisinière', en: 'Stove' }, w: 60, d: 60, h: 90, color: '#d8d8d8' },
  { id: 'fridge', category: 'kitchen', shape: 'fridge', name: { fr: 'Réfrigérateur', en: 'Fridge' }, w: 70, d: 70, h: 185, color: '#e6e8ea' },
  { id: 'kitchen-island', category: 'kitchen', shape: 'kitchen-island', name: { fr: 'Îlot central', en: 'Kitchen island' }, w: 180, d: 90, h: 92, color: '#2f4858' },
  // bathroom
  { id: 'toilet', category: 'bathroom', shape: 'toilet', name: { fr: 'WC', en: 'Toilet' }, w: 38, d: 65, h: 78, color: '#ffffff' },
  { id: 'bathtub', category: 'bathroom', shape: 'bathtub', name: { fr: 'Baignoire', en: 'Bathtub' }, w: 170, d: 75, h: 58, color: '#ffffff' },
  { id: 'shower', category: 'bathroom', shape: 'shower', name: { fr: 'Douche', en: 'Shower' }, w: 90, d: 90, h: 200, color: '#ffffff' },
  { id: 'washbasin', category: 'bathroom', shape: 'washbasin', name: { fr: 'Lavabo', en: 'Washbasin' }, w: 60, d: 46, h: 85, color: '#ffffff' },
  { id: 'washing-machine', category: 'bathroom', shape: 'washing-machine', name: { fr: 'Lave-linge', en: 'Washing machine' }, w: 60, d: 60, h: 85, color: '#f2f2f2' },
  // dining
  { id: 'table-6', category: 'dining', shape: 'table', name: { fr: 'Table 6 personnes', en: 'Table for 6' }, w: 180, d: 90, h: 75, color: '#8e6b4c' },
  { id: 'table-4', category: 'dining', shape: 'table', name: { fr: 'Table 4 personnes', en: 'Table for 4' }, w: 120, d: 80, h: 75, color: '#a5825f' },
  { id: 'round-table', category: 'dining', shape: 'round-table', name: { fr: 'Table ronde', en: 'Round table' }, w: 110, d: 110, h: 75, color: '#c9a77c' },
  { id: 'chair', category: 'dining', shape: 'chair', name: { fr: 'Chaise', en: 'Chair' }, w: 45, d: 50, h: 88, color: '#5a4636' },
  // office
  { id: 'desk', category: 'office', shape: 'desk', name: { fr: 'Bureau', en: 'Desk' }, w: 140, d: 70, h: 75, color: '#d7c4a8' },
  { id: 'office-chair', category: 'office', shape: 'office-chair', name: { fr: 'Fauteuil de bureau', en: 'Office chair' }, w: 62, d: 62, h: 110, color: '#2b2b2b' },
  { id: 'office-shelf', category: 'office', shape: 'bookshelf', name: { fr: 'Étagère', en: 'Shelf' }, w: 80, d: 30, h: 180, color: '#ffffff' },
  // decor
  { id: 'plant', category: 'decor', shape: 'plant', name: { fr: 'Plante', en: 'Plant' }, w: 45, d: 45, h: 120, color: '#3f7d4e' },
  { id: 'floor-lamp', category: 'decor', shape: 'floor-lamp', name: { fr: 'Lampadaire', en: 'Floor lamp' }, w: 40, d: 40, h: 165, color: '#e9d8a6' },
  { id: 'rug', category: 'decor', shape: 'rug', name: { fr: 'Tapis', en: 'Rug' }, w: 200, d: 140, h: 1, color: '#b5523b' },
  { id: 'stairs', category: 'decor', shape: 'stairs', name: { fr: 'Escalier', en: 'Stairs' }, w: 100, d: 300, h: 280, color: '#a9886a' },
];

export const CATALOG: CatalogEntry[] = [...OPENINGS, ...FURNITURE];

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export function getEntry(id: string): CatalogEntry | undefined {
  return byId.get(id);
}

export function getFurniture(id: string): FurnitureDef | undefined {
  const e = byId.get(id);
  return e && e.category !== 'openings' ? e : undefined;
}

export function isOpening(e: CatalogEntry): e is OpeningDef {
  return e.category === 'openings';
}
