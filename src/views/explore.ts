import { distanceM, formatDistance, watchPosition, type Position } from '../geo';
import { getFoundSpots, listExperiences } from '../store';
import type { Experience } from '../types';
import { $, esc, type View } from '../ui';

/** Distance to the nearest spot that has a location, or null. */
export function nearestDistance(exp: Experience, pos: Position | null): number | null {
  if (!pos) return null;
  let best: number | null = null;
  for (const s of exp.spots) {
    if (s.lat == null || s.lng == null) continue;
    const d = distanceM(pos.lat, pos.lng, s.lat, s.lng);
    if (best == null || d < best) best = d;
  }
  return best;
}

export const exploreView: View = (root) => {
  const exps = listExperiences().filter((e) => e.status === 'published');
  let pos: Position | null = null;
  let error = '';

  root.innerHTML = `
    <main class="page">
      <nav class="topbar"><a href="#/">← Home</a></nav>
      <h1>Explore</h1>
      <p id="gps" class="muted small">Finding your location…</p>
      <ul id="list" class="list"></ul>
    </main>`;

  const render = () => {
    $('#gps', root).innerHTML = error
      ? `<span class="warn">${esc(error)}</span>`
      : pos
        ? `Your location ±${formatDistance(pos.accuracy)}`
        : 'Finding your location…';
    const sorted = exps
      .map((e) => ({ e, d: nearestDistance(e, pos) }))
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));
    $('#list', root).innerHTML = sorted.length
      ? sorted
          .map(({ e, d }) => {
            const found = getFoundSpots(e.id).length;
            const cover = e.spots.find((s) => s.targetImage)?.targetImage;
            return `
          <li><a class="card row" href="#/play/${e.id}">
            ${cover ? `<img class="thumb" src="${cover}" alt="" />` : `<div class="thumb placeholder">📍</div>`}
            <div class="grow">
              <div class="card-title">${esc(e.title)}</div>
              <div class="muted small">${e.organisation ? `${esc(e.organisation)} · ` : ''}${e.spots.length} spot${e.spots.length === 1 ? '' : 's'}${found ? ` · ${found} found` : ''}</div>
            </div>
            <div class="distance">${d != null ? formatDistance(d) : ''}</div>
          </a></li>`;
          })
          .join('')
      : `<p class="empty">No published experiences on this device. Create and publish one, or import a file from the home screen.</p>`;
  };
  render();

  return watchPosition(
    (p) => {
      pos = p;
      error = '';
      render();
    },
    (msg) => {
      error = msg;
      render();
    },
  );
};
