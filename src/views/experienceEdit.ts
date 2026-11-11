import { deleteExperience, exportJson, getExperience, newSpot, saveExperience } from '../store';
import type { Experience } from '../types';
import { targetQuality } from '../target';
import { $, $input, downloadFile, errorMessage, esc, navigate, slug, toast, type View } from '../ui';

export function spotProblems(exp: Experience): string[] {
  const problems: string[] = [];
  if (exp.spots.length === 0) problems.push('Add at least one spot.');
  exp.spots.forEach((s) => {
    if (s.geofenceEnabled && (s.lat == null || s.lng == null)) problems.push(`${s.name}: set its location.`);
    if (!s.targetImage) problems.push(`${s.name}: take a photo of the target object.`);
    if (s.items.length === 0) problems.push(`${s.name}: add some content.`);
  });
  return problems;
}

export const experienceEditView: View = (root, [id]) => {
  const exp = getExperience(id);
  if (!exp) {
    root.innerHTML = `<main class="page"><p>Experience not found.</p><a href="#/">Home</a></main>`;
    return;
  }

  const save = () => {
    try {
      saveExperience(exp);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const render = () => {
    const problems = spotProblems(exp);
    root.innerHTML = `
      <main class="page">
        <nav class="topbar"><a href="#/">← Home</a><span class="badge ${exp.status}">${exp.status === 'published' ? 'Published' : 'Draft'}</span></nav>
        <h1>Edit experience</h1>

        <section class="card form">
          <label>Title<input id="title" value="${esc(exp.title)}" maxlength="80" /></label>
          <label>Organisation <span class="muted">(museum, venue, client)</span><input id="org" value="${esc(exp.organisation)}" maxlength="80" /></label>
          <label>Description<textarea id="desc" rows="3" maxlength="600">${esc(exp.description)}</textarea></label>
        </section>

        <section>
          <div class="row between"><h2>Spots</h2><button id="addSpot" class="primary">+ Add spot</button></div>
          <p class="muted small">A spot is one place: a GPS location plus a photo of a flat object there (painting, sign, poster) that the AR content sticks to.</p>
          ${
            exp.spots.length === 0
              ? `<p class="empty">No spots yet. Go to the place and tap <strong>Add spot</strong>.</p>`
              : `<ol class="list">${exp.spots
                  .map((s, i) => {
                    const q = targetQuality(s.targetFeatures);
                    return `
                <li class="card row">
                  ${s.targetImage ? `<img class="thumb" src="${s.targetImage}" alt="" />` : `<div class="thumb placeholder">📷</div>`}
                  <a class="grow" href="#/edit/${exp.id}/spot/${s.id}">
                    <div class="card-title">${esc(s.name)}</div>
                    <div class="muted small">
                      ${s.geofenceEnabled ? (s.lat != null ? `📍 ${s.unlockRadius} m radius` : '📍 No location yet') : '📍 Location check off'}
                      · ${s.items.length} item${s.items.length === 1 ? '' : 's'}
                      ${s.targetImage ? ` · <span class="q-${q.level}">target ${q.level}</span>` : ''}
                    </div>
                  </a>
                  <div class="col">
                    <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
                    <button class="icon-btn" data-down="${i}" ${i === exp.spots.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
                  </div>
                </li>`;
                  })
                  .join('')}</ol>`
          }
        </section>

        <section class="card">
          <h2>Publish</h2>
          ${
            problems.length
              ? `<p class="muted small">Before publishing:</p><ul class="problems">${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
              : `<p class="muted small">Ready. Published experiences appear in Explore on this device, and in exported files.</p>`
          }
          <div class="row wrap gap">
            ${
              exp.status === 'published'
                ? `<button id="unpublish">Unpublish</button><a class="button primary" href="#/play/${exp.id}">▶ Play</a>`
                : `<button id="publish" class="primary" ${problems.length ? 'disabled' : ''}>Publish</button>`
            }
            <button id="export">⬇️ Export this experience</button>
          </div>
        </section>

        <section>
          <button id="delete" class="danger">Delete experience</button>
        </section>
      </main>`;

    const bindText = (sel: string, key: 'title' | 'organisation' | 'description') => {
      const el = $(sel, root) as HTMLInputElement | HTMLTextAreaElement;
      el.oninput = () => {
        exp[key] = el.value;
        save();
      };
    };
    bindText('#title', 'title');
    bindText('#org', 'organisation');
    bindText('#desc', 'description');
    $input('#title', root).onblur = () => {
      if (!exp.title.trim()) {
        exp.title = 'Untitled experience';
        save();
        render();
      }
    };

    $('#addSpot', root).onclick = () => {
      const spot = newSpot(exp.spots.length);
      exp.spots.push(spot);
      save();
      navigate(`#/edit/${exp.id}/spot/${spot.id}`);
    };
    root.querySelectorAll<HTMLButtonElement>('[data-up],[data-down]').forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.up ?? btn.dataset.down);
        const j = btn.dataset.up != null ? i - 1 : i + 1;
        [exp.spots[i], exp.spots[j]] = [exp.spots[j], exp.spots[i]];
        save();
        render();
      };
    });
    root.querySelector<HTMLButtonElement>('#publish')?.addEventListener('click', () => {
      exp.status = 'published';
      save();
      toast('Published');
      render();
    });
    root.querySelector<HTMLButtonElement>('#unpublish')?.addEventListener('click', () => {
      exp.status = 'draft';
      save();
      render();
    });
    $('#export', root).onclick = () => downloadFile(`placear-${slug(exp.title)}.json`, exportJson([exp]));
    $('#delete', root).onclick = () => {
      if (confirm(`Delete "${exp.title}"? This cannot be undone.`)) {
        deleteExperience(exp.id);
        navigate('#/');
      }
    };
  };
  render();
};
