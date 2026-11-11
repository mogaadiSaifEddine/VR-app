export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el as HTMLElement;
}

export function $input(sel: string, root: ParentNode = document): HTMLInputElement {
  return $(sel, root) as HTMLInputElement;
}

let toastTimer: number | undefined;
export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${kind}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), kind === 'error' ? 5000 : 2500);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function navigate(hash: string): void {
  location.hash = hash;
}

export function downloadFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'experience';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** A view renders into the app root and returns an optional cleanup function. */
export type View = (root: HTMLElement, params: string[]) => void | (() => void);
