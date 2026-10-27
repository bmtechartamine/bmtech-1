import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getFurniture } from '../catalog/catalog';
import { buildFurniture, material } from '../catalog/models3d';
import { wallLength } from '../model/geometry';
import type { Floor, Opening, Project, Wall } from '../model/types';

const SLAB = 20; // cm between floors

/** Height of a floor's surface above the ground floor, in cm. */
export function floorBase(project: Project, index: number): number {
  let base = 0;
  for (let i = 0; i < index; i++) base += project.floors[i].height + SLAB;
  return base;
}

/** Everything above `upTo` is hidden so you can look into the current floor. */
export function buildScene(project: Project, upTo: number): { group: THREE.Group; box: THREE.Box3 } {
  const group = new THREE.Group();
  let base = 0;
  project.floors.forEach((floor, i) => {
    if (i <= upTo) group.add(buildFloor(floor, base, i === 0));
    base += floor.height + SLAB;
  });
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) box.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(600, 280, 500));
  return { group, box };
}

function buildFloor(floor: Floor, base: number, ground: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.y = base;

  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    const shape = new THREE.Shape(r.points.map((p) => new THREE.Vector2(p.x, -p.y)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material(r.floor, { roughness: 0.85 }));
    mesh.position.y = 0.5;
    mesh.receiveShadow = true;
    g.add(mesh);
    if (!ground) {
      // a slab under upper-floor rooms so they do not float as paper
      const slab = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false }).rotateX(-Math.PI / 2),
        material('#d6d3cc'),
      );
      slab.position.y = -SLAB;
      g.add(slab);
    }
  }

  const byWall = new Map<string, Opening[]>();
  for (const o of floor.openings) {
    const list = byWall.get(o.wallId) ?? [];
    list.push(o);
    byWall.set(o.wallId, list);
  }
  for (const w of floor.walls) g.add(buildWall(w, byWall.get(w.id) ?? []));

  for (const it of floor.items) {
    const def = getFurniture(it.catalogId);
    if (!def) continue;
    const m = buildFurniture(def.shape, it.w, it.d, it.h, it.color);
    m.position.set(it.x, it.elevation, it.y);
    m.rotation.y = (-it.rotation * Math.PI) / 180;
    g.add(m);
  }
  return g;
}

/**
 * A wall as boxes: full-height pieces between openings, with lintels above and
 * sills below each opening. Boxes never fail to triangulate, unlike shapes with holes.
 */
export function buildWall(w: Wall, openings: Opening[]): THREE.Group {
  const len = wallLength(w);
  const g = new THREE.Group();
  if (len < 1) return g;
  g.position.set(w.a.x, 0, w.a.y);
  g.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
  const mat = material(w.color, { roughness: 0.9 });
  const t = w.thickness;
  const H = w.height;

  const piece = (u0: number, u1: number, v0: number, v1: number, m: THREE.Material = mat) => {
    if (u1 - u0 < 0.2 || v1 - v0 < 0.2) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, v1 - v0, t), m);
    mesh.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };

  const ops = [...openings]
    .map((o) => ({ o, u0: Math.max(0, o.offset - o.width / 2), u1: Math.min(len, o.offset + o.width / 2) }))
    .sort((a, b) => a.u0 - b.u0);
  // ends stick out by half a thickness so corners close
  let cursor = -t / 2;
  for (const { o, u0, u1 } of ops) {
    if (u0 < cursor) continue; // overlapping opening: skip it rather than break the wall
    piece(cursor, u0, 0, H);
    const top = Math.min(H, o.sill + o.height);
    piece(u0, u1, top, H);
    piece(u0, u1, 0, o.sill);
    addOpeningModel(g, o, u0, u1, t);
    cursor = u1;
  }
  piece(cursor, len + t / 2, 0, H);
  return g;
}

function addOpeningModel(g: THREE.Group, o: Opening, u0: number, u1: number, t: number) {
  const frame = material('#f4f2ee', { roughness: 0.5 });
  const w = u1 - u0;
  const cx = (u0 + u1) / 2;
  const add = (bw: number, bh: number, bd: number, x: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const top = o.sill + o.height;
  // frame around the hole
  add(4, o.height, t + 1, u0 + 2, o.sill + o.height / 2, 0, frame);
  add(4, o.height, t + 1, u1 - 2, o.sill + o.height / 2, 0, frame);
  add(w, 4, t + 1, cx, top - 2, 0, frame);
  if (o.kind === 'window') {
    add(w, 4, t + 3, cx, o.sill + 2, 0, frame);
    add(w - 8, o.height - 8, 1, cx, o.sill + o.height / 2, 0, material('#a9cde3', { roughness: 0.05, metalness: 0.1, opacity: 0.35 }));
    add(3, o.height - 8, 2.5, cx, o.sill + o.height / 2, 0, frame);
  } else {
    const leaves = o.width > 120 ? 2 : 1;
    const lw = (w - 8) / leaves;
    const side = o.flip ? -1 : 1;
    for (let i = 0; i < leaves; i++) {
      const hingeU = i === 0 ? u0 + 4 : u1 - 4;
      const dir = i === 0 ? 1 : -1;
      const leaf = new THREE.Group();
      leaf.position.set(hingeU, 0, (side * t) / 2);
      // a door left a little open reads as a door in 3D
      leaf.rotation.y = -side * dir * 0.45;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(lw, o.height - 4, 4), material('#c8a27a', { roughness: 0.6 }));
      panel.position.set((dir * lw) / 2, (o.height - 4) / 2, 0);
      panel.castShadow = true;
      leaf.add(panel);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), material('#9aa3ad', { metalness: 0.6, roughness: 0.3 }));
      knob.position.set(dir * (lw - 8), 100, side * 3);
      leaf.add(knob);
      g.add(leaf);
    }
  }
}

export class View3D {
  readonly el: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 5, 20000);
  private controls: OrbitControls | null = null;
  private content: THREE.Group | null = null;
  private sun = new THREE.DirectionalLight('#ffffff', 2.2);
  private ground: THREE.Mesh;
  private ro: ResizeObserver;
  private frame = 0;
  private framed = false;
  failed = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'view3d';
    host.append(this.el);
    this.scene.background = new THREE.Color('#e9eef4');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.4));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material('#dfe5dc', { roughness: 1 }));
    this.ground.receiveShadow = true;
    this.ground.position.y = -0.5;
    this.scene.add(this.ground);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
  }

  private ensure() {
    if (this.renderer || this.failed) return !!this.renderer;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.outputColorSpace = THREE.SRGBColorSpace;
      this.el.append(r.domElement);
      r.domElement.setAttribute('aria-label', 'Vue 3D');
      this.renderer = r;
      this.controls = new OrbitControls(this.camera, r.domElement);
      this.controls.enableDamping = true;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
      this.controls.addEventListener('change', () => this.render());
      this.resize();
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  private resize() {
    if (!this.renderer) return;
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** Rebuild the scene from the project. Keeps the camera unless `refit`. */
  update(project: Project, upTo: number, refit = false) {
    if (!this.ensure()) return false;
    if (this.content) {
      this.scene.remove(this.content);
      disposeGeometries(this.content);
    }
    const { group, box } = buildScene(project, upTo);
    this.content = group;
    this.scene.add(group);

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 300);
    this.ground.scale.set(span * 4, 1, span * 4);
    this.ground.position.set(center.x, -0.5, center.z);
    this.sun.position.set(center.x + span * 0.6, span * 1.2 + size.y, center.z + span * 0.8);
    this.sun.target.position.copy(center);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.near = 10;
    cam.far = span * 4 + size.y * 2;
    cam.updateProjectionMatrix();

    if (refit || !this.framed) {
      this.frameBox(box);
      this.framed = true;
    }
    this.render();
    return true;
  }

  private frameBox(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 300);
    const d = span / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * 1.1;
    this.camera.position.set(center.x + d * 0.55, center.y + d * 0.85, center.z + d * 0.75);
    this.camera.near = Math.max(1, d / 200);
    this.camera.far = d * 20;
    this.camera.updateProjectionMatrix();
    this.controls?.target.copy(new THREE.Vector3(center.x, 0, center.z));
    this.controls?.update();
  }

  render() {
    if (!this.renderer || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.renderer) return;
      // damping needs a few extra frames to settle
      if (this.controls?.update()) this.render();
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Where a screen point lands on the horizontal plane at height y (cm), as plan x/y. */
  groundPoint(clientX: number, clientY: number, y: number): { x: number; y: number } | null {
    if (!this.renderer) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) return null;
    return { x: hit.x, y: hit.z };
  }

  /** The current view as a PNG data URL. */
  capture(): string | null {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.frame);
    if (this.content) disposeGeometries(this.content);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.el.remove();
  }
}

function disposeGeometries(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}
