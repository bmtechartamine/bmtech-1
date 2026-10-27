import * as THREE from 'three';
import type { Shape } from './catalog';
import { shade } from './draw2d';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export function material(color: string, opts: { roughness?: number; metalness?: number; opacity?: number } = {}) {
  const key = `${color}|${opts.roughness ?? 0.7}|${opts.metalness ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

/**
 * A piece of furniture in centimetres: width along x, depth along z (front is +z),
 * height along y, standing on y = 0 and centred on x = z = 0.
 */
export function buildFurniture(shape: Shape, w: number, d: number, h: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const main = material(color);
  const light = material(shade(color, 0.3));
  const dark = material(shade(color, -0.25));
  const metal = material('#9aa3ad', { roughness: 0.35, metalness: 0.6 });
  const white = material('#f7f7f5', { roughness: 0.3 });
  const black = material('#1c1c1e', { roughness: 0.4 });

  const box = (bw: number, bh: number, bd: number, x: number, y: number, z: number, m = main) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(bw, 0.5), Math.max(bh, 0.5), Math.max(bd, 0.5)), m);
    mesh.position.set(x, y + bh / 2, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (rt: number, rb: number, ch: number, x: number, y: number, z: number, m = main, seg = 20) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, ch, seg), m);
    mesh.position.set(x, y + ch / 2, z);
    g.add(mesh);
    return mesh;
  };
  const legs = (lw: number, ld: number, lh: number, inset: number, m = dark, r = 2) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(r, r, lh, sx * (lw / 2 - inset), 0, sz * (ld / 2 - inset), m, 8);
  };

  switch (shape) {
    case 'sofa':
    case 'armchair': {
      const arm = Math.min(18, w * 0.15);
      const seatH = h * 0.5;
      box(w, seatH * 0.6, d, 0, 8, 0, dark);
      legs(w, d, 8, 6, black, 2);
      box(w - arm * 2, seatH * 0.4, d * 0.75, 0, 8 + seatH * 0.6, d * 0.12, light);
      box(w, h - 8, d * 0.25, 0, 8, -d / 2 + d * 0.125, main);
      box(arm, h * 0.68 - 8, d, -w / 2 + arm / 2, 8, 0, main);
      box(arm, h * 0.68 - 8, d, w / 2 - arm / 2, 8, 0, main);
      break;
    }
    case 'bed': {
      box(w, 30, d, 0, 5, 0, dark);
      legs(w, d, 5, 6, black, 2.5);
      box(w - 6, 22, d - 6, 0, 35, 2, white);
      box(w - 6, 6, d * 0.6, 0, 55, d * 0.2 - 2, material(color));
      const pillows = w > 120 ? 2 : 1;
      const pw = (w - 20) / pillows - 6;
      for (let i = 0; i < pillows; i++) {
        box(pw, 12, 30, -w / 2 + 13 + pw / 2 + i * (pw + 6), 57, -d / 2 + 25, light);
      }
      box(w, h, 8, 0, 0, -d / 2 + 4, dark);
      break;
    }
    case 'table':
    case 'desk': {
      box(w, 4, d, 0, h - 4, 0, main);
      legs(w, d, h - 4, 6, dark, 2.5);
      if (shape === 'desk') box(w * 0.3, h * 0.6, d - 10, w / 2 - w * 0.15 - 4, h * 0.35, 0, light);
      break;
    }
    case 'coffee-table': {
      box(w, 5, d, 0, h - 5, 0, main);
      box(w - 10, 2, d - 10, 0, 10, 0, dark);
      legs(w, d, h - 5, 5, dark, 2);
      break;
    }
    case 'round-table': {
      cyl(w / 2, w / 2, 4, 0, h - 4, 0, main, 40);
      cyl(5, 5, h - 4, 0, 0, 0, dark);
      cyl(w * 0.22, w * 0.25, 3, 0, 0, 0, dark, 30);
      break;
    }
    case 'chair': {
      box(w, 4, d * 0.9, 0, 44, d * 0.05, main);
      legs(w, d * 0.9, 44, 4, dark, 1.5);
      box(w, h - 48, 3, 0, 48, -d / 2 + 3, main);
      break;
    }
    case 'office-chair': {
      cyl(4, 4, 40, 0, 6, 0, metal);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leg = box(w * 0.45, 3, 4, Math.cos(a) * w * 0.22, 4, Math.sin(a) * d * 0.22, black);
        leg.rotation.y = -a;
      }
      box(w * 0.85, 8, d * 0.8, 0, 46, d * 0.05, main);
      box(w * 0.8, h - 60, 6, 0, 58, -d / 2 + 8, main);
      break;
    }
    case 'tv-unit':
    case 'dresser':
    case 'nightstand': {
      const foot = 6;
      box(w, h - foot, d, 0, foot, 0, main);
      legs(w, d, foot, 4, dark, 1.5);
      const rows = shape === 'tv-unit' ? 1 : shape === 'nightstand' ? 2 : 3;
      for (let i = 0; i < rows; i++) {
        const rh = (h - foot) / rows;
        box(w - 6, rh - 4, 1, 0, foot + i * rh + 2, d / 2 + 0.5, light);
        box(w * 0.18, 2, 2, 0, foot + i * rh + rh / 2, d / 2 + 1.5, metal);
      }
      break;
    }
    case 'wardrobe': {
      box(w, h, d, 0, 0, 0, main);
      const doors = Math.max(2, Math.round(w / 55));
      const dw = w / doors;
      for (let i = 0; i < doors; i++) {
        box(dw - 2, h - 6, 1, -w / 2 + dw * i + dw / 2, 3, d / 2 + 0.5, light);
        box(2, 30, 2, -w / 2 + dw * i + (i % 2 ? 6 : dw - 6), h / 2, d / 2 + 1.5, metal);
      }
      break;
    }
    case 'bookshelf': {
      box(w, h, 2, 0, 0, -d / 2 + 1, dark);
      box(2, h, d, -w / 2 + 1, 0, 0, main);
      box(2, h, d, w / 2 - 1, 0, 0, main);
      const shelves = Math.max(3, Math.round(h / 38));
      const books = ['#b5523b', '#2f4858', '#c49a5a', '#6b7a8f', '#3f7d4e'];
      for (let i = 0; i <= shelves; i++) {
        const y = (h - 2) * (i / shelves);
        box(w - 4, 2, d, 0, y, 0, main);
        if (i < shelves && h > 60) {
          let x = -w / 2 + 4;
          let k = i;
          while (x < w / 2 - 10) {
            const bw = 3 + ((k * 7) % 4);
            const bh = 18 + ((k * 13) % 10);
            if ((k * 5) % 7 !== 0) box(bw, bh, d * 0.7, x + bw / 2, y + 2, 0, material(books[k % books.length]));
            x += bw + 0.6;
            k++;
          }
        }
      }
      break;
    }
    case 'counter':
    case 'kitchen-island':
    case 'sink-counter': {
      box(w, h - 14, d - 4, 0, 10, -2, main);
      box(w - 4, 10, d - 8, 0, 0, -4, dark);
      box(w, 4, d, 0, h - 4, 0, material(shape === 'kitchen-island' ? '#e9e5dc' : '#b9b2a6', { roughness: 0.4 }));
      const doors = Math.max(1, Math.round(w / 60));
      for (let i = 0; i < doors; i++) {
        const dw = w / doors;
        box(dw - 2, h - 18, 1, -w / 2 + dw * i + dw / 2, 12, d / 2 - 3.5, light);
      }
      if (shape === 'sink-counter') {
        box(w * 0.6, 1, d * 0.55, 0, h - 0.5, 0, metal);
        cyl(1.2, 1.2, 25, 0, h, -d * 0.35, metal, 10);
      }
      break;
    }
    case 'stove': {
      box(w, h - 4, d, 0, 0, 0, main);
      box(w, 4, d, 0, h - 4, 0, black);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(w * 0.12, w * 0.12, 0.6, sx * w * 0.24, h, sz * d * 0.22, material('#3a3f47'));
      box(w - 10, h * 0.45, 1, 0, 12, d / 2 + 0.5, material('#2b2f36', { roughness: 0.2 }));
      break;
    }
    case 'fridge': {
      box(w, h, d, 0, 0, 0, main);
      box(w - 2, h * 0.32, 1, 0, h * 0.66, d / 2 + 0.5, light);
      box(w - 2, h * 0.62, 1, 0, 2, d / 2 + 0.5, light);
      box(2, 30, 3, w / 2 - 8, h * 0.4, d / 2 + 2, metal);
      box(2, 20, 3, w / 2 - 8, h * 0.72, d / 2 + 2, metal);
      break;
    }
    case 'washing-machine': {
      box(w, h, d, 0, 0, 0, main);
      const door = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.3, 2, 30), material('#c5ced6', { roughness: 0.2 }));
      door.rotation.x = Math.PI / 2;
      door.position.set(0, h * 0.45, d / 2 + 1);
      g.add(door);
      break;
    }
    case 'toilet': {
      box(w - 4, 38, d * 0.3, 0, 40, -d / 2 + d * 0.15, white);
      const bowl = cyl(w / 2, w * 0.36, 40, 0, 0, d * 0.12, white, 24);
      bowl.scale.z = (d * 0.65) / w;
      const seat = cyl(w / 2, w / 2, 3, 0, 40, d * 0.12, white, 24);
      seat.scale.z = (d * 0.65) / w;
      break;
    }
    case 'bathtub': {
      box(w, h, d, 0, 0, 0, white);
      box(w - 16, 2, d - 16, 0, h - 1, 0, material('#cfe0ea', { roughness: 0.15 }));
      cyl(1.5, 1.5, 18, -w / 2 + 12, h, 0, metal, 10);
      break;
    }
    case 'shower': {
      box(w, 6, d, 0, 0, 0, white);
      const glass = material('#bcd8e8', { roughness: 0.05, opacity: 0.35 });
      box(w, h - 6, 1, 0, 6, d / 2 - 0.5, glass);
      box(1, h - 6, d, w / 2 - 0.5, 6, 0, glass);
      cyl(1, 1, h - 20, -w / 2 + 6, 6, -d / 2 + 6, metal, 8);
      cyl(8, 8, 1, -w / 2 + 14, h - 14, -d / 2 + 14, metal);
      break;
    }
    case 'washbasin': {
      box(w, h - 18, d - 4, 0, 0, -2, material('#e8e2d6'));
      box(w, 16, d, 0, h - 16, 0, white);
      box(w * 0.62, 1, d * 0.6, 0, h, d * 0.05, material('#dbe7ef', { roughness: 0.15 }));
      cyl(1.2, 1.2, 18, 0, h, -d / 2 + 6, metal, 10);
      box(w * 0.9, 60, 2, 0, h + 30, -d / 2 + 1, material('#cfe3ee', { roughness: 0.05, metalness: 0.4 }));
      break;
    }
    case 'plant': {
      const pot = Math.min(w, d) * 0.35;
      cyl(pot, pot * 0.75, h * 0.28, 0, 0, 0, material('#8c5a3c'));
      const leaves = material(color, { roughness: 0.8 });
      const sphere = (r: number, x: number, y: number, z: number) => {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaves);
        s.position.set(x, y, z);
        g.add(s);
      };
      const r = Math.min(w, d) / 2;
      sphere(r * 0.75, 0, h * 0.62, 0);
      sphere(r * 0.55, r * 0.35, h * 0.8, r * 0.1);
      sphere(r * 0.5, -r * 0.3, h * 0.78, -r * 0.15);
      sphere(r * 0.45, 0, h * 0.92, 0);
      break;
    }
    case 'floor-lamp': {
      cyl(w * 0.35, w * 0.4, 3, 0, 0, 0, dark);
      cyl(1.2, 1.2, h - 30, 0, 3, 0, metal, 8);
      cyl(w * 0.3, w / 2, 30, 0, h - 30, 0, material(color, { roughness: 0.9 }), 24);
      break;
    }
    case 'rug':
      box(w, Math.max(h, 1), d, 0, 0, 0, material(color, { roughness: 1 }));
      break;
    case 'tv': {
      box(w, h, Math.max(3, d * 0.5), 0, 0, 0, black);
      box(w - 4, h - 4, 0.5, 0, 2, Math.max(3, d * 0.5) / 2 + 0.3, material('#22303f', { roughness: 0.1 }));
      break;
    }
    case 'stairs': {
      const steps = Math.max(4, Math.round(d / 28));
      const sd = d / steps;
      const sh = h / steps;
      for (let i = 0; i < steps; i++) {
        // step 0 at the front (+z), climbing toward the back (-z)
        box(w, sh * (i + 1), sd, 0, 0, d / 2 - sd * i - sd / 2, i % 2 ? main : light);
      }
      break;
    }
    default:
      box(w, h, d, 0, 0, 0, main);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
