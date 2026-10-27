import './styles.css';
import { mountEditor } from './editor/editor';
import { getLang, setLang, t } from './i18n';
import { cloneProject } from './model/project';
import { decodeProject } from './model/share';
import { createStore, StorageFullError } from './model/storage';
import { mountHome } from './pages/home';
import { h } from './ui/dom';
import { logo } from './ui/icons';
import { toast } from './ui/overlay';

const root = document.getElementById('app')!;
const store = createStore();
let unmount: (() => void) | null = null;
setLang(getLang());

function go(hash: string) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function route() {
  unmount?.();
  unmount = null;
  root.replaceChildren();
  const hash = location.hash.replace(/^#/, '') || '/';
  document.title = t('appName');

  const edit = hash.match(/^\/p\/([\w-]+)$/);
  if (edit) {
    const project = store.get(edit[1]);
    if (!project) return notFound(t('notFound'), t('notFoundHint'));
    document.title = `${project.name} · ${t('appName')}`;
    unmount = mountEditor(root, project, { store, onBack: () => go('#/'), onReload: route });
    return;
  }

  const view = hash.match(/^\/view\/([\w-]+)$/);
  if (view) {
    const project = await decodeProject(view[1]);
    if (!project) return notFound(t('viewerBroken'), '');
    document.title = `${project.name} · ${t('appName')}`;
    unmount = mountEditor(root, project, {
      readOnly: true,
      onBack: () => go('#/'),
      onCopyToMine: (p) => {
        try {
          const copy = cloneProject(p, p.name);
          store.save(copy);
          toast(t('copiedToMine'));
          go(`#/p/${copy.id}`);
        } catch (e) {
          toast(e instanceof StorageFullError ? t('storageFull') : String(e), 'error');
        }
      },
    });
    return;
  }

  unmount = mountHome(root, store, (id) => go(`#/p/${id}`));
}

function notFound(title: string, hint: string) {
  root.append(
    h(
      'div',
      { class: 'notfound' },
      logo(56),
      h('h1', {}, title),
      hint ? h('p', { class: 'muted' }, hint) : null,
      h('a', { class: 'btn btn-primary', href: '#/' }, t('back')),
    ),
  );
}

window.addEventListener('hashchange', route);
route();
