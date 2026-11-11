import { deleteExperience, exportJson, getSettings, importJson, listExperiences, newExperience, saveExperience, saveSettings, storageUsage } from '../store';
import { $, $input, downloadFile, errorMessage, esc, formatBytes, navigate, toast, type View } from '../ui';

export const homeView: View = (root) => {
  const render = () => {
    const exps = listExperiences();
    const settings = getSettings();
    root.innerHTML = `
      <main class="page">
        <header class="hero">
          <div class="logo">📍 PlaceAR</div>
          <p class="muted">Put AR content on real places. Visitors see it only when they are there.</p>
        </header>

        <div class="big-actions">
          <button class="big primary" id="create">
            <span class="big-icon">✏️</span><span><strong>Create</strong><small>Make an experience at a place</small></span>
          </button>
          <a class="big" href="#/explore">
            <span class="big-icon">🧭</span><span><strong>Explore</strong><small>Find experiences near you</small></span>
          </a>
        </div>

        <section>
          <h2>My experiences</h2>
          ${
            exps.length === 0
              ? `<p class="empty">Nothing yet. Tap <strong>Create</strong> to make your first experience, or import a file.</p>`
              : `<ul class="list">${exps
                  .map(
                    (e) => `
                <li class="card row">
                  <div class="grow">
                    <a href="#/edit/${e.id}" class="card-title">${esc(e.title)}</a>
                    <div class="muted small">
                      <span class="badge ${e.status}">${e.status === 'published' ? 'Published' : 'Draft'}</span>
                      ${e.spots.length} spot${e.spots.length === 1 ? '' : 's'}
                      ${e.organisation ? ` · ${esc(e.organisation)}` : ''}
                    </div>
                  </div>
                  <button class="icon-btn" data-delete="${e.id}" title="Delete">🗑️</button>
                </li>`,
                  )
                  .join('')}</ul>`
          }
        </section>

        <section>
          <h2>Share between devices</h2>
          <p class="muted small">There is no server yet: everything is saved in this browser. To play an experience on another phone, export it here and import the file there.</p>
          <div class="row wrap gap">
            <button id="export" ${exps.length ? '' : 'disabled'}>⬇️ Export all</button>
            <label class="button">⬆️ Import file<input type="file" id="import" accept=".json,application/json" hidden /></label>
          </div>
        </section>

        <section>
          <h2>Testing</h2>
          <label class="check">
            <input type="checkbox" id="ignoreLocation" ${settings.ignoreLocation ? 'checked' : ''} />
            <span>Ignore location (unlock every spot without being there)</span>
          </label>
          <p class="muted small">Storage used: ${formatBytes(storageUsage())} of about 5 MB.</p>
        </section>
      </main>`;

    $('#create', root).onclick = () => {
      const exp = newExperience();
      try {
        saveExperience(exp);
        navigate(`#/edit/${exp.id}`);
      } catch (err) {
        toast(errorMessage(err), 'error');
      }
    };
    root.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.onclick = () => {
        const exp = exps.find((e) => e.id === btn.dataset.delete);
        if (exp && confirm(`Delete "${exp.title}"? This cannot be undone.`)) {
          deleteExperience(exp.id);
          render();
        }
      };
    });
    $('#export', root).onclick = () => downloadFile(`placear-export-${new Date().toISOString().slice(0, 10)}.json`, exportJson(exps));
    $input('#import', root).onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const n = importJson(await file.text());
        toast(`Imported ${n} experience${n === 1 ? '' : 's'}`);
        render();
      } catch (err) {
        toast(errorMessage(err), 'error');
      }
    };
    $input('#ignoreLocation', root).onchange = (e) => {
      saveSettings({ ...settings, ignoreLocation: (e.target as HTMLInputElement).checked });
    };
  };
  render();
};
