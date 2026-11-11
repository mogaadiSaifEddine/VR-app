import { loadImage } from './image';

// Full-screen crop step for target photos. Tracking only works well when the
// target is just the flat object, without the wall/floor/people around it.

export interface CropResult {
  dataUrl: string;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shows the cropper. Resolves with the cropped image (longest side <=
 * maxSide), or null if cancelled. */
export async function cropImage(src: string, maxSide: number, quality = 0.82): Promise<CropResult | null> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-head">
      <strong>Crop to the object</strong>
      <span>Drag the corners so the box covers <b>only the flat object</b> (painting, poster, sign) — no wall, floor or people.</span>
    </div>
    <div class="crop-stage">
      <div class="crop-wrap">
        <img alt="" draggable="false" />
        <div class="crop-shade"></div>
        <div class="crop-box">
          <span class="h" data-h="nw"></span><span class="h" data-h="ne"></span>
          <span class="h" data-h="sw"></span><span class="h" data-h="se"></span>
        </div>
      </div>
    </div>
    <div class="crop-actions">
      <button data-act="cancel">Cancel</button>
      <button data-act="full">Use whole photo</button>
      <button data-act="ok" class="primary">Use this area</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const imgEl = overlay.querySelector('img')!;
  imgEl.src = src;
  const wrap = overlay.querySelector<HTMLElement>('.crop-wrap')!;
  const box = overlay.querySelector<HTMLElement>('.crop-box')!;

  // Crop rect in natural image pixels. Start with a centred 80% box.
  const rect: Rect = { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.8 };
  const MIN = Math.min(W, H) * 0.1;

  const scale = () => wrap.clientWidth / W; // display px per image px
  const draw = () => {
    const s = scale();
    Object.assign(box.style, {
      left: `${rect.x * s}px`,
      top: `${rect.y * s}px`,
      width: `${rect.w * s}px`,
      height: `${rect.h * s}px`,
    });
  };
  const fit = () => {
    const stage = overlay.querySelector<HTMLElement>('.crop-stage')!;
    const s = Math.min(stage.clientWidth / W, stage.clientHeight / H);
    wrap.style.width = `${W * s}px`;
    wrap.style.height = `${H * s}px`;
    draw();
  };
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(fit);

  let drag: { mode: string; px: number; py: number; start: Rect } | null = null;
  wrap.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).dataset.h;
    const inBox = (e.target as HTMLElement).closest('.crop-box');
    if (!handle && !inBox) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    drag = { mode: handle ?? 'move', px: e.clientX, py: e.clientY, start: { ...rect } };
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const s = scale();
    const dx = (e.clientX - drag.px) / s;
    const dy = (e.clientY - drag.py) / s;
    const st = drag.start;
    let { x, y, w, h } = st;
    if (drag.mode === 'move') {
      x = Math.min(Math.max(0, st.x + dx), W - st.w);
      y = Math.min(Math.max(0, st.y + dy), H - st.h);
    } else {
      if (drag.mode.includes('w')) {
        x = Math.min(Math.max(0, st.x + dx), st.x + st.w - MIN);
        w = st.x + st.w - x;
      }
      if (drag.mode.includes('e')) w = Math.min(Math.max(MIN, st.w + dx), W - st.x);
      if (drag.mode.includes('n')) {
        y = Math.min(Math.max(0, st.y + dy), st.y + st.h - MIN);
        h = st.y + st.h - y;
      }
      if (drag.mode.includes('s')) h = Math.min(Math.max(MIN, st.h + dy), H - st.y);
    }
    Object.assign(rect, { x, y, w, h });
    draw();
  });
  const endDrag = () => (drag = null);
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  const result = await new Promise<Rect | null>((resolve) => {
    overlay.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.onclick = () => {
        const act = b.dataset.act;
        resolve(act === 'cancel' ? null : act === 'full' ? { x: 0, y: 0, w: W, h: H } : { ...rect });
      };
    });
  });

  window.removeEventListener('resize', onResize);
  overlay.remove();
  document.body.classList.remove('no-scroll');
  if (!result) return null;

  const s = Math.min(1, maxSide / Math.max(result.w, result.h));
  const width = Math.max(1, Math.round(result.w * s));
  const height = Math.max(1, Math.round(result.h * s));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, result.x, result.y, result.w, result.h, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}
