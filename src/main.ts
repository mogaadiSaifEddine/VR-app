import './style.css';
import type { View } from './ui';
import { homeView } from './views/home';
import { experienceEditView } from './views/experienceEdit';
import { spotEditView } from './views/spotEdit';
import { exploreView } from './views/explore';
import { playView } from './views/play';
import { arView } from './views/ar';

// Hash routes, so the app works on any static host.
const routes: [RegExp, View][] = [
  [/^\/?$/, homeView],
  [/^\/edit\/([^/]+)$/, experienceEditView],
  [/^\/edit\/([^/]+)\/spot\/([^/]+)$/, spotEditView],
  [/^\/preview\/([^/]+)\/([^/]+)$/, (root, p) => arView(root, p, 'preview')],
  [/^\/explore$/, exploreView],
  [/^\/play\/([^/]+)$/, playView],
  [/^\/play\/([^/]+)\/([^/]+)$/, (root, p) => arView(root, p, 'play')],
];

const root = document.getElementById('app')!;
let cleanup: (() => void) | void;

function render(): void {
  cleanup?.();
  cleanup = undefined;
  root.innerHTML = '';
  window.scrollTo(0, 0);
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  for (const [re, view] of routes) {
    const m = path.match(re);
    if (m) {
      cleanup = view(root, m.slice(1));
      return;
    }
  }
  root.innerHTML = `<main class="page"><h1>Page not found</h1><p><a href="#/">Go home</a></p></main>`;
}

window.addEventListener('hashchange', render);
render();
