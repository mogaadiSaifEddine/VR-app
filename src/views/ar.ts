import { ARSession } from '../ar';
import { buildItem } from '../content';
import { getPosition } from '../geo';
import { findSpot, getExperience, getSettings, markSpotFound } from '../store';
import { compileTarget } from '../target';
import { $, errorMessage, esc, type View } from '../ui';
import { spotState } from './play';

/** Full-screen camera view. mode 'preview' is for creators (no location
 * check); mode 'play' re-checks the geofence before opening the camera. */
export const arView = (root: HTMLElement, [expId, spotId]: string[], mode: 'preview' | 'play'): ReturnType<View> => {
  const exp = getExperience(expId);
  const spot = exp && findSpot(exp, spotId);
  const back = mode === 'preview' ? `#/edit/${expId}/spot/${spotId}` : `#/play/${expId}`;
  if (!exp || !spot || !spot.targetImage) {
    root.innerHTML = `<main class="page"><p>This spot is not ready yet.</p><a href="${back}">Back</a></main>`;
    return;
  }
  const targetImage = spot.targetImage;

  root.innerHTML = `
    <div class="ar-root" id="arRoot">
      <div class="ar-stage" id="stage"></div>
      <div class="ar-top">
        <a class="ar-btn" href="${back}">✕</a>
        <div class="ar-title">${mode === 'preview' ? 'Preview · ' : ''}${esc(spot.name)}</div>
      </div>
      <div class="ar-status" id="status">Starting…</div>
      <div class="ar-scan" id="scan" hidden>
        <img src="${targetImage}" alt="" />
        <p>Point your camera at this${spot.hint ? `<br><small>${esc(spot.hint)}</small>` : ''}</p>
      </div>
      <div class="ar-tips" id="tips" hidden>
        <strong>Can't find it?</strong>
        <ul>
          <li>Stand about where the photo was taken, facing the object straight on.</li>
          <li>Fill most of the screen with the object, then move slowly.</li>
          <li>Avoid glare and reflections; make sure it's well lit.</li>
          ${mode === 'preview' ? '<li>Still nothing? Re-take the photo and crop it to just the object.</li>' : ''}
        </ul>
      </div>
      <div class="ar-info" id="info" hidden></div>
    </div>`;
  document.body.classList.add('no-scroll');

  const status = $('#status', root);
  const scan = $('#scan', root);
  const info = $('#info', root);
  const tips = $('#tips', root);
  let tipsTimer: number | undefined;
  const scheduleTips = () => {
    window.clearTimeout(tipsTimer);
    tipsTimer = window.setTimeout(() => (tips.hidden = false), 8000);
  };
  const setStatus = (text: string, isError = false) => {
    status.hidden = !text;
    status.textContent = text;
    status.classList.toggle('error', isError);
  };

  let session: ARSession | null = null;
  let cancelled = false;

  (async () => {
    try {
      if (mode === 'play') {
        setStatus('Checking your location…');
        const pos = spot.geofenceEnabled && !getSettings().ignoreLocation ? await getPosition().catch(() => null) : null;
        const st = spotState(spot, pos);
        if (!st.unlocked) throw new Error(`This spot is locked: ${st.reason}. Go to the place to unlock it.`);
      }
      setStatus('Preparing target… 0%');
      const { buffer } = await compileTarget(targetImage, (p) => setStatus(`Preparing target… ${Math.round(p)}%`));
      if (cancelled) return;
      setStatus('Starting camera…');
      session = new ARSession({
        container: $('#stage', root),
        targetBuffer: buffer,
        onFound: () => {
          scan.hidden = true;
          tips.hidden = true;
          window.clearTimeout(tipsTimer);
          if (mode === 'play') markSpotFound(exp.id, spot.id);
        },
        onLost: () => {
          scan.hidden = false;
          info.hidden = true;
          scheduleTips();
        },
        onTap: (itemId) => {
          const item = itemId ? spot.items.find((i) => i.id === itemId) : undefined;
          if (item?.info) {
            info.innerHTML = `<strong>${esc(item.name)}</strong><p>${esc(item.info).replace(/\n/g, '<br>')}</p><small>Tap to close</small>`;
            info.hidden = false;
          } else {
            info.hidden = true;
          }
        },
      });
      for (const item of spot.items) session.anchor.add(buildItem(item));
      await session.start();
      if (cancelled) return;
      setStatus('');
      if (!session.isTracking) {
        scan.hidden = false;
        scheduleTips();
      }
    } catch (err) {
      setStatus(errorMessage(err), true);
    }
  })();

  info.onclick = () => (info.hidden = true);

  return () => {
    cancelled = true;
    window.clearTimeout(tipsTimer);
    session?.stop();
    document.body.classList.remove('no-scroll');
  };
};
