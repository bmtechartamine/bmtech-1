import { t } from '../i18n';
import { h } from './dom';
import { icon } from './icons';

let toastBox: HTMLElement | null = null;

export function toast(message: string, kind: 'ok' | 'error' = 'ok') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const el = h('div', { class: `toast toast-${kind}` }, message);
  toastBox.append(el);
  setTimeout(() => el.classList.add('toast-out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/** Opens a modal dialog. Returns a function that closes it. */
export function modal(title: string, body: Node, actions: HTMLElement[] = []): () => void {
  const prevFocus = document.activeElement as HTMLElement | null;
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    prevFocus?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const titleId = `m${Math.random().toString(36).slice(2)}`;
  const dialog = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'modal-head' },
      h('h2', { id: titleId }, title),
      h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': t('close'), on: { click: close } }, icon('close')),
    ),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions) : null,
  );
  const backdrop = h('div', { class: 'backdrop', on: { mousedown: (e) => e.target === backdrop && close() } }, dialog);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey, true);
  const first = dialog.querySelector<HTMLElement>('input, select, .modal-actions .btn-primary, .modal-body button');
  (first ?? dialog.querySelector<HTMLElement>('button'))?.focus();
  return close;
}

export function confirmDialog(message: string, okLabel: string, danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const close = modal(t('appName'), h('p', {}, message), [
      h('button', { class: 'btn btn-secondary', on: { click: () => finish(false) } }, t('cancel')),
      h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, on: { click: () => finish(true) } }, okLabel),
    ]);
  });
}

export function promptDialog(title: string, label: string, value: string, okLabel: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input', { class: 'input', value, maxlength: 120, 'aria-label': label });
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const form = h(
      'form',
      { on: { submit: (e) => (e.preventDefault(), finish(input.value.trim() || value)) } },
      h('label', { class: 'field' }, h('span', {}, label), input),
    );
    const close = modal(title, form, [
      h('button', { class: 'btn btn-secondary', type: 'button', on: { click: () => finish(null) } }, t('cancel')),
      h('button', { class: 'btn btn-primary', on: { click: () => finish(input.value.trim() || value) } }, okLabel),
    ]);
    input.select();
  });
}
