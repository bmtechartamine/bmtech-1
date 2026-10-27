// All lengths are centimetres. Angles are degrees.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  color: string;
}

export interface Room {
  id: string;
  name: string;
  points: Vec2[];
  floor: string;
}

export type OpeningKind = 'door' | 'window';

export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** Distance from wall.a to the opening's centre. */
  offset: number;
  width: number;
  height: number;
  sill: number;
  /** Doors: swing to the other side of the wall. */
  flip?: boolean;
}

export interface Item {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  rotation: number;
  w: number;
  d: number;
  h: number;
  elevation: number;
  color: string;
}

export interface Floor {
  id: string;
  name: string;
  height: number;
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
  items: Item[];
}

export type Units = 'metric' | 'imperial';

export interface Project {
  id: string;
  name: string;
  units: Units;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  floors: Floor[];
}

export const MAX_FLOORS = 6;
export const DEFAULT_WALL_HEIGHT = 280;
export const DEFAULT_WALL_THICKNESS = 15;
export const DEFAULT_WALL_COLOR = '#f2efe9';
export const DEFAULT_FLOOR_COLOR = '#d9c3a3';
