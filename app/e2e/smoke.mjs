// End-to-end walk through the main flows, with screenshots in e2e/out/.
// Needs a running server: `npm run build && npx vite preview --port 4173`, then `npm run e2e`.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const { chromium } = playwright;

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const state = () => page.evaluate(() => {
  const s = window.__bmt.state;
  const f = s.project.floors[s.floorIndex];
  return { walls: f.walls.length, rooms: f.rooms.length, items: f.items.length, openings: f.openings.length, floors: s.project.floors.length, sel: s.selection, tool: s.tool };
});

// F00 home, empty state
await page.goto(BASE);
await page.getByRole('heading', { name: /Aucun projet/ }).waitFor();
check('home shows the empty state', true);
await shot('01-home-empty');

// F01 draw a first plan from a blank project
await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
await page.getByRole('dialog').waitFor();
await shot('02-new-project');
await page.getByLabel('Nom du projet').fill('Maison test');
await page.getByRole('button', { name: 'Créer' }).click();
await page.locator('.stage canvas').first().waitFor();
await shot('03-editor-blank');

const canvas = page.locator('.stage canvas').first();
const box = await canvas.boundingBox();
const at = (x, y) => ({ x: box.x + x, y: box.y + y });

// draw a rectangle room by dragging
await page.keyboard.press('r');
let p = at(250, 200);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(p.x + 40 * i, p.y + 30 * i);
await page.mouse.up();
let s = await state();
check('drag draws a room with 4 walls', s.rooms === 1 && s.walls === 4, JSON.stringify(s));

// draw an L-shaped room by clicking corners, sharing the right wall
await page.keyboard.press('r');
const pts = [at(650, 200), at(850, 200), at(850, 600), at(650, 600)];
for (const q of pts) await page.mouse.click(q.x, q.y);
await page.mouse.click(pts[0].x, pts[0].y);
s = await state();
check('click-drawn room closes on its first point', s.rooms === 2, JSON.stringify(s));
const overlaps = await page.evaluate(() => {
  const ws = window.__bmt.state.floor.walls;
  let n = 0;
  for (let i = 0; i < ws.length; i++)
    for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i], b = ws[j];
      const vx = a.b.x - a.a.x, vy = a.b.y - a.a.y, len = Math.hypot(vx, vy);
      const off = (p) => Math.abs(((p.x - a.a.x) * vy - (p.y - a.a.y) * vx) / len);
      if (off(b.a) > 1 || off(b.b) > 1) continue;
      const t = (p) => ((p.x - a.a.x) * vx + (p.y - a.a.y) * vy) / len;
      const lo = Math.max(0, Math.min(t(b.a), t(b.b))), hi = Math.min(len, Math.max(t(b.a), t(b.b)));
      if (hi - lo > 1) n++;
    }
  return n;
});
check('the shared wall is not doubled', s.walls === 8 && overlaps === 0, `walls=${s.walls} overlaps=${overlaps}`);
await shot('04-two-rooms');

// add a door and a window from the catalogue
await page.getByRole('tab', { name: 'Catalogue' }).click();
await page.getByRole('button', { name: 'Porte', exact: true }).click();
let wall = await page.evaluate(() => {
  const s = window.__bmt.state;
  const w = s.floor.walls.find((w) => Math.abs(w.a.y - w.b.y) < 1);
  const v = window.__bmt.plan.view;
  return { x: ((w.a.x + w.b.x) / 2) * v.scale + v.ox, y: w.a.y * v.scale + v.oy };
});
await page.mouse.move(box.x + wall.x, box.y + wall.y + 2);
await page.mouse.click(box.x + wall.x, box.y + wall.y + 2);
s = await state();
check('a door lands on the clicked wall', s.openings === 1 && s.sel?.kind === 'opening', JSON.stringify(s));
await page.getByRole('tab', { name: 'Catalogue' }).click();
await page.getByRole('button', { name: 'Fenêtre', exact: true }).click();
wall = await page.evaluate(() => {
  const s = window.__bmt.state;
  const w = s.floor.walls.find((w) => Math.abs(w.a.x - w.b.x) < 1);
  const v = window.__bmt.plan.view;
  return { x: w.a.x * v.scale + v.ox, y: ((w.a.y + w.b.y) / 2) * v.scale + v.oy };
});
await page.mouse.click(box.x + wall.x, box.y + wall.y);
s = await state();
check('a window lands on the clicked wall', s.openings === 2, JSON.stringify(s));

// F02 furnish: search the catalogue, click to place, then drag-and-drop
await page.getByRole('tab', { name: 'Catalogue' }).click();
await page.getByRole('searchbox').fill('canape');
await page.getByRole('button', { name: /Canapé 3 places/ }).click();
p = at(420, 330);
await page.mouse.move(p.x, p.y);
await page.mouse.click(p.x, p.y);
s = await state();
check('search without accents finds the sofa and it is placed', s.items === 1 && s.sel?.kind === 'item', JSON.stringify(s));
await shot('05-sofa-selected');

// change its width through the properties panel
const width = page.getByLabel('Largeur');
await width.fill('2,5 m');
await width.press('Enter');
const w = await page.evaluate(() => window.__bmt.state.floor.items[0].w);
check('typing "2,5 m" sets the width to 250 cm', Math.abs(w - 250) < 0.01, `w=${w}`);

await page.getByRole('button', { name: 'Pivoter de 90°' }).click();
const rot = await page.evaluate(() => window.__bmt.state.floor.items[0].rotation);
check('rotate 90° works', rot === 90, `rot=${rot}`);

await page.getByRole('tab', { name: 'Catalogue' }).click();
await page.getByRole('searchbox').fill('lit');
const bed = page.getByRole('button', { name: /Lit double/ });
await bed.dragTo(canvas, { targetPosition: { x: 750, y: 400 } });
s = await state();
check('drag and drop from the catalogue places an item', s.items === 2, JSON.stringify(s));

// undo / redo
await page.keyboard.press('Control+z');
s = await state();
const undone = s.items === 1;
await page.keyboard.press('Control+Shift+z');
s = await state();
check('undo then redo', undone && s.items === 2, JSON.stringify(s));

// move an item by dragging it
const before = await page.evaluate(() => ({ ...window.__bmt.state.floor.items[1] }));
const v = await page.evaluate(() => window.__bmt.plan.view);
const from = at(before.x * v.scale + v.ox, before.y * v.scale + v.oy);
await page.keyboard.press('Escape');
await page.mouse.move(from.x, from.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(from.x - 5 * i, from.y + 3 * i);
await page.mouse.up();
const after = await page.evaluate(() => window.__bmt.state.floor.items[1]);
check('dragging moves an item', after.x < before.x && after.y > before.y, `${before.x},${before.y} -> ${after.x},${after.y}`);
await page.keyboard.press('Escape');
await shot('06-furnished-2d');

// F03 add a floor
await page.getByRole('button', { name: 'Ajouter un étage' }).click();
s = await state();
check('a second floor is added and selected', s.floors === 2 && s.walls === 0, JSON.stringify(s));
await shot('07-floor-2');
await page.getByRole('button', { name: 'Rez-de-chaussée' }).click();

// 3D view
await page.getByRole('button', { name: '3D' }).click();
await page.locator('.view3d canvas').waitFor();
await page.waitForTimeout(800);
await shot('08-view-3d');
const lit = await page.evaluate(() => {
  const c = document.querySelector('.view3d canvas');
  const g = c.getContext('webgl2') || c.getContext('webgl');
  const px = new Uint8Array(4);
  g.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  return Array.from(px);
});
check('3D view renders something', lit.some((x) => x > 0), JSON.stringify(lit));
const itemsBefore3d = (await state()).items;
await page.getByRole('tab', { name: 'Catalogue' }).click();
await page.getByRole('searchbox').fill('plante');
await page.getByRole('button', { name: 'Plante', exact: true }).dragTo(page.locator('.view3d canvas'));
check('drag and drop into the 3D view places an item', (await state()).items === itemsBefore3d + 1);
await page.getByRole('button', { name: '2D' }).click();

// units
await page.getByRole('button', { name: 'Réglages' }).click();
await page.getByLabel('Unités').selectOption('imperial');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.waitForTimeout(150);
await shot('09-imperial');
const units = await page.evaluate(() => window.__bmt.state.project.units);
check('switching to imperial units', units === 'imperial');
await page.keyboard.press('Control+z');

// F04 share link opens a read-only view
await page.getByRole('button', { name: 'Partager' }).click();
const link = await page.getByLabel('Copier le lien').inputValue();
check('share link is generated', /#\/view\/[\w-]+$/.test(link), `${link.length} chars`);
await shot('10-share');
await page.keyboard.press('Escape');

// saved: back to the list
await page.getByRole('button', { name: 'Mes projets' }).click();
await page.getByText('Maison test').waitFor();
await shot('11-home-list');
check('project appears in the list with a thumbnail', (await page.locator('.card img').count()) === 1);

const viewer = await context.newPage();
viewer.on('pageerror', (e) => errors.push(String(e)));
await viewer.goto(link);
await viewer.getByText('Lecture seule', { exact: false }).waitFor();
await viewer.waitForTimeout(300);
await viewer.screenshot({ path: join(OUT, '12-shared-view.png') });
check('shared link opens read-only', (await viewer.locator('.sidebar').count()) === 0);
await viewer.close();

// templates
await page.getByRole('button', { name: 'Appartement T3' }).first().click();
await page.locator('.stage canvas').first().waitFor();
await page.waitForTimeout(300);
await shot('13-template-apartment');
await page.getByRole('button', { name: '3D' }).click();
await page.waitForTimeout(1000);
await shot('14-template-apartment-3d');

// mobile layout
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
mobile.on('pageerror', (e) => errors.push(String(e)));
await mobile.goto(BASE);
await mobile.screenshot({ path: join(OUT, '15-mobile-home.png') });
let overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('no horizontal scroll on a phone (home)', !overflow);
await mobile.getByRole('button', { name: 'Appartement T3' }).first().click();
await mobile.locator('.stage canvas').first().waitFor();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: join(OUT, '16-mobile-editor.png') });
overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('no horizontal scroll on a phone (editor)', !overflow);
const tapBox = await mobile.locator('.stage canvas').first().boundingBox();
await mobile.touchscreen.tap(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2);
const tapped = await mobile.evaluate(() => window.__bmt.state.selection);
check('tapping the plan selects something on a phone', !!tapped, JSON.stringify(tapped));
await mobile.waitForTimeout(200);
await mobile.screenshot({ path: join(OUT, '17-mobile-selected.png') });

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
