import { distanceM, formatDistance, mapsLink, watchPosition, type Position } from '../geo';
import { getExperience, getFoundSpots, getSettings, resetProgress } from '../store';
import type { Spot } from '../types';
import { $, esc, type View } from '../ui';

export type SpotState = { unlocked: boolean; distance: number | null; reason: string };

export function spotState(spot: Spot, pos: Position | null): SpotState {
  const distance = pos && spot.lat != null && spot.lng != null ? distanceM(pos.lat, pos.lng, spot.lat, spot.lng) : null;
  if (!spot.geofenceEnabled) return { unlocked: true, distance, reason: 'No location check' };
  if (getSettings().ignoreLocation) return { unlocked: true, distance, reason: 'Location ignored (testing)' };
  if (spot.lat == null || spot.lng == null) return { unlocked: false, distance, reason: 'Spot has no location' };
  if (!pos) return { unlocked: false, distance, reason: 'Waiting for your location' };
  // Give the player the benefit of the GPS uncertainty, up to 30 m.
  const slack = Math.min(pos.accuracy, 30);
  if (distance! <= spot.unlockRadius + slack) return { unlocked: true, distance, reason: "You're here" };
  return { unlocked: false, distance, reason: `${formatDistance(distance! - spot.unlockRadius)} to go` };
}

export const playView: View = (root, [id]) => {
  const exp = getExperience(id);
  if (!exp) {
    root.innerHTML = `<main class="page"><p>Experience not found.</p><a href="#/explore">Explore</a></main>`;
    return;
  }
  let pos: Position | null = null;
  let error = '';

  root.innerHTML = `
    <main class="page">
      <nav class="topbar"><a href="#/explore">← Explore</a>${exp.status === 'draft' ? '<span class="badge draft">Draft</span>' : ''}</nav>
      <h1>${esc(exp.title)}</h1>
      ${exp.organisation ? `<p class="muted">${esc(exp.organisation)}</p>` : ''}
      ${exp.description ? `<p>${esc(exp.description)}</p>` : ''}
      <p id="progress" class="small"></p>
      <p id="gps" class="muted small"></p>
      <ol id="spots" class="list"></ol>
      <button id="reset" class="link small">Reset my progress</button>
    </main>`;

  const render = () => {
    const found = new Set(getFoundSpots(exp.id));
    $('#progress', root).innerHTML = `<strong>${found.size} of ${exp.spots.length}</strong> spots found`;
    $('#gps', root).innerHTML = error ? `<span class="warn">${esc(error)}</span>` : pos ? `Your location ±${formatDistance(pos.accuracy)}` : 'Finding your location…';
    $('#spots', root).innerHTML = exp.spots
      .map((s) => {
        const st = spotState(s, pos);
        const done = found.has(s.id);
        return `
        <li class="card spot ${st.unlocked ? 'unlocked' : 'locked'} ${done ? 'done' : ''}">
          <div class="row">
            ${s.targetImage && st.unlocked ? `<img class="thumb" src="${s.targetImage}" alt="" />` : `<div class="thumb placeholder">${done ? '✅' : st.unlocked ? '🔓' : '🔒'}</div>`}
            <div class="grow">
              <div class="card-title">${done ? '✅ ' : ''}${esc(s.name)}</div>
              <div class="muted small">${esc(st.reason)}${st.distance != null ? ` · ${formatDistance(st.distance)} away` : ''}</div>
            </div>
          </div>
          ${st.unlocked && s.hint ? `<p class="small">🔎 ${esc(s.hint)}</p>` : ''}
          <div class="row gap wrap">
            ${st.unlocked ? `<a class="button primary" href="#/play/${exp.id}/${s.id}">📷 Open camera</a>` : ''}
            ${s.lat != null && s.lng != null ? `<a class="button" href="${mapsLink(s.lat, s.lng)}" target="_blank" rel="noopener">🗺 Directions</a>` : ''}
          </div>
        </li>`;
      })
      .join('');
  };
  render();

  $('#reset', root).onclick = () => {
    if (confirm('Reset your progress for this experience?')) {
      resetProgress(exp.id);
      render();
    }
  };

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
