import { count, getLang, setLang, t, type Lang } from '../i18n';
import { duplicateItem, newFloor, removeRoom, removeWall } from '../model/project';
import { encodeProject, MAX_LINK_PAYLOAD } from '../model/share';
import { StorageFullError, type ProjectStore } from '../model/storage';
import { MAX_FLOORS, type Project, type Units } from '../model/types';
import { formatArea } from '../model/units';
import { polygonArea } from '../model/geometry';
import { download, h, safeFilename } from '../ui/dom';
import { icon, logo } from '../ui/icons';
import { modal, toast } from '../ui/overlay';
import { CatalogPanel, PropertiesPanel, renderFloors } from './panels';
import { PlanCanvas } from './plan2d';
import { EditorState, type Tool } from './state';
import { floorBase, View3D } from './view3d';
import { getEntry } from '../catalog/catalog';

export interface EditorOptions {
  store?: ProjectStore;
  readOnly?: boolean;
  onBack: () => void;
  /** Re-open the editor, e.g. after a language change. */
  onReload?: () => void;
  onCopyToMine?: (p: Project) => void;
}

export function mountEditor(root: HTMLElement, project: Project, opts: EditorOptions): () => void {
  const state = new EditorState(project, !!opts.readOnly);
  const cleanups: (() => void)[] = [];

  // ---------- layout ----------
  const stage = h('div', { class: 'stage' });
  const hint = h('div', { class: 'stage-hint', 'aria-live': 'polite' });
  const floorsBar = h('div', { class: 'floors' });
  const stats = h('div', { class: 'stage-stats hide-sm' });
  const plan = new PlanCanvas(stage, state);
  const view3d = new View3D(stage);
  view3d.el.hidden = true;
  // furniture can be dropped, or placed with a click, straight into the 3D view
  const ground = (e: MouseEvent) => view3d.groundPoint(e.clientX, e.clientY, floorBase(state.project, state.floorIndex));
  view3d.el.addEventListener('dragover', (e) => {
    if (!state.readOnly && e.dataTransfer?.types.includes('text/bmt-catalog')) e.preventDefault();
  });
  view3d.el.addEventListener('drop', (e) => {
    const entry = getEntry(e.dataTransfer?.getData('text/bmt-catalog') ?? '');
    const p = ground(e);
    if (!entry || !p || state.readOnly) return;
    e.preventDefault();
    plan.place(entry, p);
  });
  let downAt: { x: number; y: number } | null = null;
  view3d.el.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
  view3d.el.addEventListener('pointerup', (e) => {
    const still = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4;
    downAt = null;
    if (!still || state.tool !== 'place' || !state.placing) return;
    const p = ground(e);
    if (p) plan.place(state.placing, p);
  });
  stage.append(hint, floorsBar, stats);

  const saveState = h('span', { class: 'save-state hide-sm', 'aria-live': 'polite' });
  const nameInput = h('input', {
    class: 'project-name',
    value: project.name,
    maxlength: 120,
    'aria-label': t('projectName'),
    readonly: state.readOnly,
  });
  nameInput.addEventListener('change', () => {
    const v = nameInput.value.trim() || t('untitled');
    nameInput.value = v;
    state.commit((_, p) => (p.name = v));
  });
  nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());

  const undoBtn = iconBtn('undo', t('undo'), () => state.undo());
  const redoBtn = iconBtn('redo', t('redo'), () => state.redo());
  const btn2d = h('button', { class: 'btn', 'aria-pressed': 'true', on: { click: () => state.setView('2d') } }, icon('plan', 18), h('span', { class: 'hide-sm' }, t('view2d')));
  const btn3d = h('button', { class: 'btn', 'aria-pressed': 'false', on: { click: () => state.setView('3d') } }, icon('cube', 18), h('span', { class: 'hide-sm' }, t('view3d')));

  const topbar = h(
    'header',
    { class: 'topbar' },
    state.readOnly
      ? h('span', { class: 'brand', style: 'color:#fff' }, logo(32))
      : iconBtn('back', t('back'), opts.onBack),
    state.readOnly ? null : h('span', { class: 'hide-sm' }, logo(30)),
    nameInput,
    saveState,
    h('div', { class: 'spacer' }),
    state.readOnly ? null : undoBtn,
    state.readOnly ? null : redoBtn,
    state.readOnly ? null : h('span', { class: 'sep hide-sm' }),
    h('div', { class: 'segmented', role: 'group', 'aria-label': `${t('view2d')} / ${t('view3d')}` }, btn2d, btn3d),
    h('span', { class: 'sep hide-sm' }),
    iconBtn('camera', t('snapshot'), () => snapshot(), 'hide-sm'),
    state.readOnly ? null : iconBtn('share', t('share'), () => shareDialog()),
    iconBtn('download', t('export'), () => exportDialog(), state.readOnly ? '' : 'hide-sm'),
    state.readOnly ? null : iconBtn('settings', t('settings'), () => settingsDialog()),
    state.readOnly && opts.onCopyToMine
      ? h('button', { class: 'btn btn-accent btn-sm', on: { click: () => opts.onCopyToMine!(project) } }, icon('copy', 16), h('span', { class: 'hide-sm' }, t('copyToMine')))
      : null,
  );

  const tools: { tool: Tool; icon: string; label: string; key: string }[] = [
    { tool: 'select', icon: 'select', label: t('tool_select'), key: 'V' },
    { tool: 'room', icon: 'room', label: t('tool_room'), key: 'R' },
    { tool: 'wall', icon: 'wall', label: t('tool_wall'), key: 'W' },
    { tool: 'pan', icon: 'pan', label: t('tool_pan'), key: 'H' },
  ];
  const toolButtons = tools.map((tl) =>
    h(
      'button',
      {
        class: 'btn btn-icon btn-ghost',
        title: `${tl.label} (${tl.key})`,
        'aria-label': tl.label,
        'aria-pressed': 'false',
        'data-tool': tl.tool,
        on: { click: () => setTool(tl.tool) },
      },
      icon(tl.icon),
    ),
  );
  const toolbar = h(
    'nav',
    { class: 'toolbar', 'aria-label': 'Outils' },
    toolButtons,
    h('span', { class: 'divider' }),
    iconBtn('plus', t('zoomIn'), () => plan.zoomBy(1.25)),
    iconBtn('minus', t('zoomOut'), () => plan.zoomBy(0.8)),
    iconBtn('fit', t('fit'), () => plan.fit()),
  );

  const catalog = state.readOnly ? null : new CatalogPanel(state);
  const props = state.readOnly ? null : new PropertiesPanel(state, () => renderFloors(floorsBar, state, addFloor));
  const tabCatalog = h('button', { class: 'tab', role: 'tab', id: 'tab-catalog', 'aria-controls': 'panel-catalog', on: { click: () => showTab('catalog') } }, t('catalog'));
  const tabProps = h('button', { class: 'tab', role: 'tab', id: 'tab-props', 'aria-controls': 'panel-props', on: { click: () => showTab('props') } }, t('properties'));
  const sidebar = state.readOnly
    ? null
    : h(
        'aside',
        { class: 'sidebar' },
        h('div', { class: 'tabs', role: 'tablist' }, tabCatalog, tabProps),
        catalog!.el,
        props!.el,
        h('div', { class: 'shortcuts' }, t('shortcuts')),
      );

  const shell = h('div', { class: `editor${state.readOnly ? ' viewer' : ''}` }, topbar, state.readOnly ? null : toolbar, stage, sidebar);
  if (state.readOnly) {
    stage.append(h('div', { class: 'viewer-banner' }, h('span', {}, t('viewerBanner'))));
  }
  root.append(shell);

  // ---------- behaviour ----------
  function showTab(which: 'catalog' | 'props') {
    if (!catalog || !props) return;
    catalog.el.hidden = which !== 'catalog';
    props.el.hidden = which !== 'props';
    tabCatalog.setAttribute('aria-selected', String(which === 'catalog'));
    tabProps.setAttribute('aria-selected', String(which === 'props'));
  }
  showTab(state.selection ? 'props' : 'catalog');

  function setTool(tool: Tool) {
    plan.resetDraft();
    state.setTool(tool);
  }

  function addFloor() {
    if (state.project.floors.length >= MAX_FLOORS) {
      toast(t('maxFloors'), 'error');
      return;
    }
    const n = state.project.floors.length;
    state.commit((_, p) => p.floors.push(newFloor(t('floorN', { n }), p.floors[n - 1]?.height)));
    state.setFloor(n);
  }

  function updateHint() {
    const s = state;
    let text = '';
    if (s.readOnly) text = '';
    else if (s.tool === 'room') text = t('hintRoom');
    else if (s.tool === 'wall') text = t('hintWall');
    else if (s.tool === 'place' && s.placing) {
      const name = s.placing.name[getLang()];
      text = s.placing.category === 'openings' ? t('hintOpening', { name }) : t('hintFurniture', { name });
    } else if (s.view === '2d' && !s.floor.walls.length && !s.floor.items.length) text = t('hintRoom');
    hint.replaceChildren(text ? h('span', {}, text) : '');
    hint.hidden = !text || s.view === '3d';
  }

  function updateStats() {
    const f = state.floor;
    const area = f.rooms.reduce((a, r) => a + polygonArea(r.points), 0);
    stats.textContent = `${formatArea(area, state.project.units)} · ${count(f.rooms.length, 'room1', 'rooms')} · ${count(f.items.length, 'object1', 'objects')}`;
    stats.hidden = state.view === '3d';
  }

  function updateView() {
    const is3d = state.view === '3d';
    btn2d.setAttribute('aria-pressed', String(!is3d));
    btn3d.setAttribute('aria-pressed', String(is3d));
    view3d.el.hidden = !is3d;
    plan.canvas.hidden = is3d;
    toolbar.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = is3d));
    if (is3d) {
      if (!view3d.update(state.project, state.floorIndex)) toast('WebGL indisponible sur cet appareil.', 'error');
    } else plan.render();
    updateHint();
    updateStats();
  }

  // autosave
  let saveTimer = 0;
  function scheduleSave() {
    if (state.readOnly || !opts.store) return;
    saveState.textContent = t('saving');
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 600);
  }
  function saveNow() {
    if (state.readOnly || !opts.store) return;
    clearTimeout(saveTimer);
    try {
      project.thumbnail = PlanCanvas.snapshot(state, 320, 240, 0);
      opts.store.save(project);
      saveState.textContent = `✓ ${t('saved')}`;
    } catch (e) {
      saveState.textContent = '';
      toast(e instanceof StorageFullError ? t('storageFull') : String(e), 'error');
    }
  }
  cleanups.push(saveNow);

  const unsubscribe = state.on((what) => {
    if (what.has('model') || what.has('selection') || what.has('floor')) {
      if (state.view === '2d') plan.render();
      else if (what.has('model') || what.has('floor')) view3d.update(state.project, state.floorIndex, what.has('floor'));
    }
    if (what.has('model') || what.has('meta')) {
      scheduleSave();
      if (document.activeElement !== nameInput) nameInput.value = project.name;
    }
    if (what.has('floor') || what.has('model')) renderFloors(floorsBar, state, addFloor);
    if (what.has('selection')) showTab(state.selection ? 'props' : 'catalog');
    if (what.has('tool')) {
      for (const b of toolButtons) b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool));
      if (state.tool === 'place') showTab('catalog');
    }
    if (what.has('view')) updateView();
    undoBtn.disabled = !state.history.canUndo;
    redoBtn.disabled = !state.history.canRedo;
    updateHint();
    updateStats();
  });
  cleanups.push(() => void unsubscribe());

  // keyboard
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.backdrop')) return;
    plan.setShift(e.shiftKey);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (state.readOnly) return;
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if (mod && k === 'y') {
      e.preventDefault();
      state.redo();
      return;
    }
    if (mod && k === 'd' && state.selection?.kind === 'item') {
      e.preventDefault();
      const id = state.selection.id;
      let copy = '';
      state.commit((f) => {
        const src = f.items.find((i) => i.id === id);
        if (src) copy = duplicateItem(f, src).id;
      });
      if (copy) state.select({ kind: 'item', id: copy });
      return;
    }
    if (mod) return;
    if (e.key === 'Escape') {
      if (plan.hasDraft()) plan.resetDraft();
      else if (state.tool !== 'select') setTool('select');
      else state.select(null);
      return;
    }
    if (e.key === 'Enter' && plan.finishDraft()) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection) {
      e.preventDefault();
      const { kind, id } = state.selection;
      state.commit((f) => {
        if (kind === 'wall') removeWall(f, id);
        else if (kind === 'room') removeRoom(f, id);
        else if (kind === 'opening') f.openings = f.openings.filter((o) => o.id !== id);
        else f.items = f.items.filter((i) => i.id !== id);
      });
      state.select(null);
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && state.view === '2d') {
      const step = e.shiftKey ? 10 : 1;
      if (plan.nudge(arrows[e.key][0] * step, arrows[e.key][1] * step)) e.preventDefault();
      return;
    }
    const map: Record<string, Tool> = { v: 'select', r: 'room', w: 'wall', h: 'pan' };
    if (map[k] && state.view === '2d') setTool(map[k]);
  };
  const onKeyUp = (e: KeyboardEvent) => plan.setShift(e.shiftKey);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  cleanups.push(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  });
  const onUnload = () => saveNow();
  window.addEventListener('beforeunload', onUnload);
  cleanups.push(() => window.removeEventListener('beforeunload', onUnload));

  // ---------- dialogs ----------
  async function shareDialog() {
    saveNow();
    const payload = await encodeProject(project);
    const url = `${location.origin}${location.pathname}#/view/${payload}`;
    const tooLong = payload.length > MAX_LINK_PAYLOAD;
    const input = h('input', { class: 'input', value: tooLong ? '' : url, readonly: true, 'aria-label': t('copyLink') });
    const body = h(
      'div',
      { class: 'option-list' },
      h('p', {}, tooLong ? t('linkTooLong') : t('shareText')),
      tooLong
        ? null
        : h(
            'div',
            { class: 'share-link' },
            input,
            h(
              'button',
              {
                class: 'btn btn-primary',
                on: {
                  click: async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                    } catch {
                      input.select();
                      document.execCommand('copy');
                    }
                    toast(t('linkCopied'));
                  },
                },
              },
              icon('copy', 18),
              t('copyLink'),
            ),
          ),
      h('button', { class: 'btn btn-secondary', on: { click: exportFile } }, icon('download', 18), t('exportFile')),
    );
    modal(t('shareTitle'), body);
    input.focus();
    input.select();
  }

  function exportFile() {
    const { thumbnail: _t, ...data } = project;
    download(`${safeFilename(project.name)}.bmtplan`, new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  }

  function exportDialog() {
    let close = () => {};
    const png = () => {
      download(`${safeFilename(project.name)} - ${state.floor.name}.png`, PlanCanvas.snapshot(state, 1600, 1200, state.floorIndex, 1.5));
      close();
    };
    const pdf = () => {
      close();
      printPlan();
    };
    const body = h(
      'div',
      { class: 'option-list' },
      h('button', { class: 'btn btn-secondary', on: { click: png } }, icon('download', 18), t('exportPng')),
      h('button', { class: 'btn btn-secondary', on: { click: pdf } }, icon('plan', 18), t('exportPdf')),
      state.readOnly ? null : h('button', { class: 'btn btn-secondary', on: { click: () => (exportFile(), close()) } }, icon('download', 18), t('exportFile')),
    );
    close = modal(t('exportTitle'), body);
  }

  function printPlan() {
    const pages = project.floors.map((f, i) =>
      h(
        'section',
        { class: 'print-page' },
        h('h1', {}, `${project.name} — ${f.name}`),
        h('img', { src: PlanCanvas.snapshot(state, 1400, 1000, i, 1.5), alt: f.name }),
        h('p', {}, `${t('appName')} · ${new Date().toLocaleDateString(getLang())}`),
      ),
    );
    const sheet = h('div', { class: 'print-sheet' }, pages);
    const style = h('style', {}, `
      @media print {
        body > *:not(.print-sheet) { display: none !important; }
        .print-sheet { display: block !important; }
        .print-page { page-break-after: always; font-family: Inter, system-ui, sans-serif; }
        .print-page img { width: 100%; height: auto; }
        .print-page h1 { font-size: 18pt; margin: 0 0 8pt; }
        .print-page p { font-size: 9pt; color: #555; }
      }
      .print-sheet { display: none; }`);
    document.body.append(style, sheet);
    const done = () => {
      sheet.remove();
      style.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // images are data URLs, so they are ready immediately
    setTimeout(() => window.print(), 50);
  }

  function snapshot() {
    const wasView = state.view;
    if (wasView !== '3d') {
      state.view = '3d';
      updateView();
    }
    setTimeout(() => {
      const data = view3d.capture();
      if (data) {
        download(`${safeFilename(project.name)} 3D.png`, data);
        toast(t('snapshotDone'));
      }
    }, 120);
  }

  function settingsDialog() {
    const units = h(
      'select',
      { class: 'select', 'aria-label': t('units') },
      h('option', { value: 'metric', selected: project.units === 'metric' }, t('metric')),
      h('option', { value: 'imperial', selected: project.units === 'imperial' }, t('imperial')),
    );
    const lang = h(
      'select',
      { class: 'select', 'aria-label': t('language') },
      h('option', { value: 'fr', selected: getLang() === 'fr' }, 'Français'),
      h('option', { value: 'en', selected: getLang() === 'en' }, 'English'),
    );
    let close = () => {};
    const apply = () => {
      const u = units.value as Units;
      if (u !== project.units) state.commit((_, p) => (p.units = u));
      const l = lang.value as Lang;
      close();
      if (l !== getLang()) {
        saveNow();
        setLang(l);
        opts.onReload?.();
      }
    };
    close = modal(
      t('settings'),
      h('div', { class: 'option-list' }, h('label', { class: 'field' }, h('span', {}, t('units')), units), h('label', { class: 'field' }, h('span', {}, t('language')), lang)),
      [h('button', { class: 'btn btn-secondary', on: { click: () => close() } }, t('cancel')), h('button', { class: 'btn btn-primary', on: { click: apply } }, t('save'))],
    );
  }

  // first paint
  renderFloors(floorsBar, state, addFloor);
  for (const b of toolButtons) b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool));
  undoBtn.disabled = true;
  redoBtn.disabled = true;
  updateHint();
  updateStats();
  if (!state.readOnly) saveState.textContent = `✓ ${t('saved')}`;

  // handy for end-to-end tests and debugging
  (window as unknown as { __bmt?: unknown }).__bmt = { state, plan, view3d };

  return () => {
    for (const fn of cleanups.reverse()) fn();
    plan.destroy();
    view3d.destroy();
    shell.remove();
  };
}

function iconBtn(name: string, label: string, onClick: () => void, extra = '') {
  return h('button', { class: `btn btn-icon btn-ghost ${extra}`.trim(), title: label, 'aria-label': label, on: { click: onClick } }, icon(name));
}
