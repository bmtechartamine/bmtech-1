import { getLang, t } from '../i18n';
import { apartmentTemplate, cloneProject, newProject, projectStats, studioTemplate, validateProject } from '../model/project';
import { StorageFullError, type ProjectStore } from '../model/storage';
import type { Project } from '../model/types';
import { formatArea } from '../model/units';
import { h } from '../ui/dom';
import { icon, logo } from '../ui/icons';
import { confirmDialog, modal, promptDialog, toast } from '../ui/overlay';

type Template = 'blank' | 'studio' | 'apartment';

export function mountHome(root: HTMLElement, store: ProjectStore, open: (id: string) => void): () => void {
  const list = h('div', {});
  const fileInput = h('input', { type: 'file', accept: '.bmtplan,application/json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const p = validateProject(JSON.parse(await file.text()));
      if (!p) throw new Error('invalid');
      const copy = cloneProject(p, p.name);
      store.save(copy);
      toast(t('imported'));
      open(copy.id);
    } catch (e) {
      toast(e instanceof StorageFullError ? t('storageFull') : t('importFailed'), 'error');
    }
  });

  const page = h(
    'div',
    {},
    h(
      'header',
      { class: 'site-head' },
      h('a', { class: 'brand', href: '#/' }, logo(36), h('span', {}, 'BMT ', h('small', {}, 'Plan'))),
      h(
        'div',
        { class: 'hero-actions' },
        h('button', { class: 'btn btn-secondary hide-sm', on: { click: () => fileInput.click() } }, icon('upload', 18), t('importProject')),
        h('button', { class: 'btn btn-primary', on: { click: () => newProjectDialog() } }, icon('plus', 18), t('newProject')),
      ),
    ),
    h(
      'section',
      { class: 'hero' },
      h(
        'div',
        { class: 'hero-inner' },
        h('h1', {}, ...splitTagline(t('tagline'))),
        h('p', {}, t('heroText')),
        h(
          'div',
          { class: 'hero-actions' },
          h('button', { class: 'btn btn-accent', on: { click: () => newProjectDialog() } }, icon('plus', 18), t('newProject')),
          h('button', { class: 'btn btn-secondary', on: { click: () => create('apartment', t('tplApartment')) } }, t('tplApartment')),
        ),
      ),
    ),
    h('main', { class: 'page' }, h('div', { class: 'section-head' }, h('h2', {}, t('myProjects')), h('span', { class: 'muted' }, t('localNote'))), list),
    h('footer', { class: 'site-foot' }, t('footer')),
    fileInput,
  );
  root.append(page);

  function render() {
    list.replaceChildren();
    const projects = store.list();
    if (!projects.length) {
      list.append(
        h(
          'div',
          { class: 'empty' },
          h('h3', {}, t('noProjects')),
          h('p', { class: 'muted' }, t('noProjectsHint')),
          h('button', { class: 'btn btn-primary', on: { click: () => newProjectDialog() } }, icon('plus', 18), t('newProject')),
        ),
      );
      return;
    }
    list.append(h('div', { class: 'grid' }, projects.map(card)));
  }

  function card(p: Project) {
    const st = projectStats(p);
    const date = new Date(p.updatedAt).toLocaleDateString(getLang(), { day: 'numeric', month: 'short', year: 'numeric' });
    return h(
      'article',
      { class: 'card' },
      h(
        'button',
        { class: 'card-thumb', 'aria-label': `${t('open')} ${p.name}`, on: { click: () => open(p.id) } },
        p.thumbnail ? h('img', { src: p.thumbnail, alt: '' }) : icon('plan', 48),
      ),
      h(
        'div',
        { class: 'card-body' },
        h(
          'div',
          { style: 'min-width:0' },
          h('div', { class: 'card-title', title: p.name }, p.name),
          h('div', { class: 'card-meta' }, `${formatArea(st.area, p.units)} · ${t('updated', { date })}`),
        ),
        h(
          'div',
          { class: 'card-actions' },
          h('button', { class: 'btn btn-icon btn-sm btn-ghost', title: t('rename'), 'aria-label': `${t('rename')} ${p.name}`, on: { click: () => rename(p) } }, icon('edit', 16)),
          h('button', { class: 'btn btn-icon btn-sm btn-ghost', title: t('duplicate'), 'aria-label': `${t('duplicate')} ${p.name}`, on: { click: () => duplicate(p) } }, icon('copy', 16)),
          h('button', { class: 'btn btn-icon btn-sm btn-ghost', title: t('delete'), 'aria-label': `${t('delete')} ${p.name}`, on: { click: () => remove(p) } }, icon('trash', 16)),
        ),
      ),
    );
  }

  async function rename(p: Project) {
    const name = await promptDialog(t('rename'), t('projectName'), p.name, t('save'));
    if (!name) return;
    p.name = name;
    p.updatedAt = Date.now();
    safeSave(p);
    render();
  }

  function duplicate(p: Project) {
    safeSave(cloneProject(p, `${p.name} (2)`));
    render();
  }

  async function remove(p: Project) {
    if (!(await confirmDialog(t('confirmDelete', { name: p.name }), t('delete')))) return;
    store.remove(p.id);
    render();
  }

  function safeSave(p: Project) {
    try {
      store.save(p);
      return true;
    } catch (e) {
      toast(e instanceof StorageFullError ? t('storageFull') : String(e), 'error');
      return false;
    }
  }

  function create(tpl: Template, name: string) {
    const p = newProject(name, t('groundFloor'));
    const names = { living: t('living'), kitchen: t('kitchen'), bedroom: t('bedroom'), bathroom: t('bathroom'), hall: t('hall'), mainRoom: t('mainRoom') };
    if (tpl === 'studio') studioTemplate(p, names);
    if (tpl === 'apartment') apartmentTemplate(p, names);
    if (safeSave(p)) open(p.id);
  }

  function newProjectDialog() {
    let chosen: Template = 'blank';
    const nameInput = h('input', { class: 'input', value: t('untitled'), maxlength: 120, 'aria-label': t('projectName') });
    const options: [Template, string, string, string][] = [
      ['blank', t('tplBlank'), t('tplBlankDesc'), 'plus'],
      ['studio', t('tplStudio'), t('tplStudioDesc'), 'room'],
      ['apartment', t('tplApartment'), t('tplApartmentDesc'), 'plan'],
    ];
    const buttons = options.map(([id, title, desc, ic]) =>
      h(
        'button',
        {
          class: 'template',
          type: 'button',
          role: 'radio',
          'aria-checked': String(id === chosen),
          on: {
            click: () => {
              chosen = id;
              buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i][0] === id)));
              if (nameInput.value === t('untitled') || options.some((o) => o[1] === nameInput.value)) nameInput.value = id === 'blank' ? t('untitled') : title;
            },
          },
        },
        h('span', { class: 'template-icon' }, icon(ic, 22)),
        h('span', {}, h('strong', {}, title), h('span', {}, desc)),
      ),
    );
    const submit = () => {
      close();
      create(chosen, nameInput.value.trim() || t('untitled'));
    };
    const form = h(
      'form',
      { on: { submit: (e) => (e.preventDefault(), submit()) }, style: 'display:grid;gap:14px' },
      h('label', { class: 'field' }, h('span', {}, t('projectName')), nameInput),
      h('div', { class: 'field' }, h('span', {}, t('startFrom')), h('div', { class: 'templates', role: 'radiogroup', 'aria-label': t('startFrom') }, buttons)),
    );
    const close = modal(t('newProject'), form, [
      h('button', { class: 'btn btn-secondary', on: { click: () => close() } }, t('cancel')),
      h('button', { class: 'btn btn-primary', on: { click: submit } }, t('create')),
    ]);
    nameInput.select();
  }

  render();
  return () => page.remove();
}

/** Put the second clause of the tagline in the accent colour. */
function splitTagline(s: string): (string | HTMLElement)[] {
  const i = s.indexOf(',');
  if (i < 0) return [s];
  return [s.slice(0, i + 1) + ' ', h('em', {}, s.slice(i + 1).trim())];
}
