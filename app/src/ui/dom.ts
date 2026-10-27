type Attrs = Record<string, unknown> & {
  class?: string;
  style?: string;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
};
type Child = Node | string | number | null | undefined | false;

/** Small element builder: h('button', { class: 'btn', on: { click } }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') {
      for (const [ev, fn] of Object.entries(v as object)) el.addEventListener(ev, fn as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k in el && typeof v !== 'string') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Inline SVG from a trusted string written in this codebase. */
export function svg(markup: string): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild as SVGElement;
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function download(filename: string, data: Blob | string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string) {
  return (name.trim() || 'projet').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}
