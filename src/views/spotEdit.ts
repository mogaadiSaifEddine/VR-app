import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addLights, animateItems, applyPose, buildItem, createItem, disposeObject, SHAPES, targetPlane } from '../content';
import { getPosition, formatDistance } from '../geo';
import { fileToDataUrl } from '../image';
import { findSpot, getExperience, saveExperience } from '../store';
import { compileTarget, targetQuality } from '../target';
import type { Animation, ContentItem, ModelShape } from '../types';
import { $, $input, errorMessage, esc, navigate, toast, type View } from '../ui';

const MAX_ITEMS = 8;

export const spotEditView: View = (root, [expId, spotId]) => {
  const exp = getExperience(expId);
  const spot = exp && findSpot(exp, spotId);
  if (!exp || !spot) {
    root.innerHTML = `<main class="page"><p>Spot not found.</p><a href="#/">Home</a></main>`;
    return;
  }

  // Saving rewrites the whole experience (with images) to localStorage, so
  // debounce it while sliders are being dragged.
  let saveTimer: number | undefined;
  const saveNow = () => {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    try {
      saveExperience(exp);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const save = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 300);
  };

  let selectedId: string | null = spot.items[0]?.id ?? null;

  root.innerHTML = `
    <main class="page">
      <nav class="topbar"><a href="#/edit/${exp.id}">← ${esc(exp.title)}</a></nav>
      <section class="card form">
        <label>Spot name<input id="name" value="${esc(spot.name)}" maxlength="60" /></label>
        <label>Hint for players <span class="muted">(what to point the camera at)</span>
          <input id="hint" value="${esc(spot.hint)}" maxlength="140" placeholder="e.g. The big painting left of the entrance" /></label>
      </section>

      <section class="card">
        <h2>1. Location</h2>
        <p class="muted small">Stand at the spot and save your location. Players must be within the radius to unlock it.</p>
        <div id="loc"></div>
        <div class="row wrap gap">
          <button id="captureLoc" class="primary">📍 Use my current location</button>
        </div>
        <label class="field-inline">Unlock radius
          <input type="range" id="radius" min="10" max="500" step="5" value="${spot.unlockRadius}" />
          <output id="radiusOut">${spot.unlockRadius} m</output>
        </label>
        <label class="check"><input type="checkbox" id="geofence" ${spot.geofenceEnabled ? 'checked' : ''} />
          <span>Require players to be here. Turn off for indoor spots where GPS is poor: the target object still has to be found.</span></label>
      </section>

      <section class="card">
        <h2>2. Target object</h2>
        <p class="muted small">Take a straight-on, well-lit photo of a flat object at this spot (painting, sign, poster, plaque) that fills the frame. Objects with lots of detail work best; plain walls, glass and shiny surfaces do not.</p>
        <div id="target"></div>
        <label class="button primary">📷 ${spot.targetImage ? 'Replace photo' : 'Take photo'}
          <input type="file" id="targetFile" accept="image/*" hidden /></label>
      </section>

      <section class="card">
        <div class="row between"><h2>3. Content</h2><a class="button" id="preview" href="#/preview/${exp.id}/${spot.id}">👁 Preview in AR</a></div>
        <p class="muted small">The photo is the grey plane below. Drag to rotate the view, pinch or scroll to zoom, tap an item to select it.</p>
        <div class="editor-3d" id="viewport"></div>
        <div class="row wrap gap add-row">
          <button data-add="model">+ 3D shape</button>
          <button data-add="text">+ Text</button>
          <label class="button">+ Image<input type="file" id="addImage" accept="image/*" hidden /></label>
        </div>
        <div id="itemList" class="chips"></div>
        <div id="props"></div>
      </section>

      <section class="row between">
        <a class="button" href="#/edit/${exp.id}">Done</a>
        <button id="deleteSpot" class="danger">Delete spot</button>
      </section>
    </main>`;

  // ---- Details -------------------------------------------------------------
  $input('#name', root).oninput = (e) => {
    spot.name = (e.target as HTMLInputElement).value || 'Spot';
    save();
  };
  $input('#hint', root).oninput = (e) => {
    spot.hint = (e.target as HTMLInputElement).value;
    save();
  };

  // ---- Location ------------------------------------------------------------
  const renderLoc = () => {
    $('#loc', root).innerHTML =
      spot.lat != null && spot.lng != null
        ? `<p class="small">Saved: <code>${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)}</code>
           ${spot.accuracy != null ? `<span class="muted">(±${formatDistance(spot.accuracy)})</span>` : ''}</p>
           ${spot.accuracy != null && spot.accuracy > spot.unlockRadius ? `<p class="warn small">GPS accuracy is worse than the radius. Increase the radius or try again outside.</p>` : ''}`
        : `<p class="warn small">No location saved yet.</p>`;
  };
  renderLoc();
  $('#captureLoc', root).onclick = async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Getting location…';
    try {
      const p = await getPosition();
      spot.lat = p.lat;
      spot.lng = p.lng;
      spot.accuracy = p.accuracy;
      saveNow();
      renderLoc();
      toast('Location saved');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📍 Use my current location';
    }
  };
  $input('#radius', root).oninput = (e) => {
    spot.unlockRadius = Number((e.target as HTMLInputElement).value);
    $('#radiusOut', root).textContent = `${spot.unlockRadius} m`;
    renderLoc();
    save();
  };
  $input('#geofence', root).onchange = (e) => {
    spot.geofenceEnabled = (e.target as HTMLInputElement).checked;
    saveNow();
  };

  // ---- Target --------------------------------------------------------------
  const renderTarget = (progress?: number) => {
    const q = targetQuality(spot.targetFeatures);
    $('#target', root).innerHTML = spot.targetImage
      ? `<img class="target-img" src="${spot.targetImage}" alt="Target" />
         ${progress != null ? `<div class="progress"><div style="width:${progress}%"></div></div><p class="small muted">Analysing photo… ${Math.round(progress)}%</p>` : `<p class="small q-${q.level}">Tracking quality: ${q.label}</p>`}`
      : `<p class="warn small">No photo yet.</p>`;
  };
  renderTarget();
  $input('#targetFile', root).onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const prev = { img: spot.targetImage, aspect: spot.targetAspect, f: spot.targetFeatures };
    try {
      const { dataUrl, width, height } = await fileToDataUrl(file, 900, 0.8);
      spot.targetImage = dataUrl;
      spot.targetAspect = height / width;
      spot.targetFeatures = null;
      renderTarget(0);
      const { features } = await compileTarget(dataUrl, (p) => renderTarget(p));
      spot.targetFeatures = features;
      saveNow();
      renderTarget();
      editor.setTarget(spot.targetImage, spot.targetAspect);
      if (features < 150) toast('This photo has little detail. Tracking may be unreliable.', 'error');
    } catch (err) {
      Object.assign(spot, { targetImage: prev.img, targetAspect: prev.aspect, targetFeatures: prev.f });
      renderTarget();
      toast(errorMessage(err), 'error');
    }
  };

  // ---- 3D editor -----------------------------------------------------------
  const editor = createEditor($('#viewport', root), (id) => {
    selectedId = id;
    renderItems();
  });
  editor.setTarget(spot.targetImage, spot.targetAspect);
  const syncScene = () => editor.setItems(spot.items, selectedId);

  const addItem = (item: ContentItem) => {
    if (spot.items.length >= MAX_ITEMS) {
      toast(`Up to ${MAX_ITEMS} items per spot in this version.`, 'error');
      return;
    }
    // Offset new items a little so they don't all overlap.
    item.position.x += (spot.items.length % 3) * 0.15 - 0.15;
    spot.items.push(item);
    selectedId = item.id;
    saveNow();
    renderItems();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
    btn.onclick = () => addItem(createItem(btn.dataset.add as ContentItem['type']));
  });
  $input('#addImage', root).onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { dataUrl, width, height } = await fileToDataUrl(file, 700, 0.8, true);
      addItem(createItem('image', { src: dataUrl, aspect: height / width, name: file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Image' }));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const renderItems = () => {
    $('#itemList', root).innerHTML = spot.items.length
      ? spot.items
          .map((it) => `<button class="chip ${it.id === selectedId ? 'active' : ''}" data-select="${it.id}">${it.type === 'model' ? '🧊' : it.type === 'text' ? '🔤' : '🖼️'} ${esc(it.name)}</button>`)
          .join('')
      : `<p class="empty small">No content yet. Add a 3D shape, text or image.</p>`;
    root.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((b) => {
      b.onclick = () => {
        selectedId = b.dataset.select!;
        renderItems();
      };
    });
    renderProps();
    syncScene();
  };

  const renderProps = () => {
    const item = spot.items.find((i) => i.id === selectedId);
    const props = $('#props', root);
    if (!item) {
      props.innerHTML = '';
      return;
    }
    const slider = (key: string, label: string, value: number, min: number, max: number, step: number) => `
      <label class="slider">${label}<input type="range" data-pose="${key}" min="${min}" max="${max}" step="${step}" value="${value}" /><output>${value}</output></label>`;
    props.innerHTML = `
      <div class="props form">
        <label>Name<input id="pName" value="${esc(item.name)}" maxlength="40" /></label>
        ${
          item.type === 'model'
            ? `<div class="row gap">
                 <label class="grow">Shape<select id="pShape">${SHAPES.map((s) => `<option value="${s.value}" ${s.value === item.shape ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
                 <label>Colour<input type="color" id="pColor" value="${item.color}" /></label>
               </div>`
            : ''
        }
        ${
          item.type === 'text'
            ? `<label>Text<textarea id="pText" rows="2" maxlength="200">${esc(item.text)}</textarea></label>
               <div class="row gap">
                 <label>Text colour<input type="color" id="pColor" value="${item.color}" /></label>
                 <label>Background<input type="color" id="pBg" value="${item.background === 'transparent' ? '#000000' : item.background}" /></label>
                 <label class="check"><input type="checkbox" id="pNoBg" ${item.background === 'transparent' ? 'checked' : ''} /><span>None</span></label>
               </div>`
            : ''
        }
        ${item.type === 'image' ? `<label class="button">Replace image<input type="file" id="pImage" accept="image/*" hidden /></label>` : ''}

        <fieldset><legend>Position <span class="muted small">(1 = photo width)</span></legend>
          ${slider('position.x', '← →', item.position.x, -2, 2, 0.01)}
          ${slider('position.y', '↓ ↑', item.position.y, -2, 2, 0.01)}
          ${slider('position.z', 'Out of photo', item.position.z, -0.5, 2, 0.01)}
        </fieldset>
        <fieldset><legend>Rotation (°)</legend>
          ${slider('rotation.x', 'Tilt', item.rotation.x, -180, 180, 1)}
          ${slider('rotation.y', 'Turn', item.rotation.y, -180, 180, 1)}
          ${slider('rotation.z', 'Roll', item.rotation.z, -180, 180, 1)}
        </fieldset>
        ${slider('scale', 'Size', item.scale, 0.05, 3, 0.01)}

        <label>Animation<select id="pAnim">
          ${(['none', 'spin', 'bob', 'pulse'] as Animation[]).map((a) => `<option value="${a}" ${a === item.animation ? 'selected' : ''}>${a[0].toUpperCase() + a.slice(1)}</option>`).join('')}
        </select></label>
        <label>Info shown when tapped <span class="muted">(optional)</span><textarea id="pInfo" rows="2" maxlength="500">${esc(item.info)}</textarea></label>
        <div class="row gap">
          <button id="pDup">Duplicate</button>
          <button id="pDel" class="danger">Delete item</button>
        </div>
      </div>`;

    const rebuild = () => {
      save();
      syncScene();
      renderItemsListOnly();
    };
    const on = (sel: string, ev: 'input' | 'change', fn: (el: HTMLInputElement) => void) => {
      const el = props.querySelector<HTMLInputElement>(sel);
      if (el) el.addEventListener(ev, () => fn(el));
    };
    on('#pName', 'input', (el) => {
      item.name = el.value || 'Item';
      save();
      renderItemsListOnly();
    });
    on('#pShape', 'change', (el) => {
      if (item.type === 'model') item.shape = el.value as ModelShape;
      rebuild();
    });
    on('#pColor', 'input', (el) => {
      if (item.type !== 'image') item.color = el.value;
      rebuild();
    });
    on('#pText', 'input', (el) => {
      if (item.type === 'text') item.text = el.value;
      rebuild();
    });
    const setBg = () => {
      if (item.type !== 'text') return;
      const none = props.querySelector<HTMLInputElement>('#pNoBg')!.checked;
      item.background = none ? 'transparent' : props.querySelector<HTMLInputElement>('#pBg')!.value;
      rebuild();
    };
    on('#pBg', 'input', setBg);
    on('#pNoBg', 'change', setBg);
    on('#pImage', 'change', async (el) => {
      const file = el.files?.[0];
      el.value = '';
      if (!file || item.type !== 'image') return;
      try {
        const { dataUrl, width, height } = await fileToDataUrl(file, 700, 0.8, true);
        item.src = dataUrl;
        item.aspect = height / width;
        rebuild();
      } catch (err) {
        toast(errorMessage(err), 'error');
      }
    });
    on('#pAnim', 'change', (el) => {
      item.animation = el.value as Animation;
      rebuild();
    });
    on('#pInfo', 'input', (el) => {
      item.info = el.value;
      save();
    });
    props.querySelectorAll<HTMLInputElement>('[data-pose]').forEach((el) => {
      el.oninput = () => {
        const v = Number(el.value);
        (el.nextElementSibling as HTMLOutputElement).textContent = String(v);
        const key = el.dataset.pose!;
        if (key === 'scale') item.scale = v;
        else {
          const [group, axis] = key.split('.') as ['position' | 'rotation', 'x' | 'y' | 'z'];
          item[group][axis] = v;
        }
        editor.updatePose(item);
        save();
      };
    });
    $('#pDup', props).onclick = () => {
      const copy = JSON.parse(JSON.stringify(item)) as ContentItem;
      copy.id = createItem(item.type).id;
      copy.name = `${item.name} copy`;
      addItem(copy);
    };
    $('#pDel', props).onclick = () => {
      spot.items = spot.items.filter((i) => i.id !== item.id);
      selectedId = spot.items[0]?.id ?? null;
      saveNow();
      renderItems();
    };
  };

  const renderItemsListOnly = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((b) => {
      const it = spot.items.find((i) => i.id === b.dataset.select);
      if (it) b.innerHTML = `${it.type === 'model' ? '🧊' : it.type === 'text' ? '🔤' : '🖼️'} ${esc(it.name)}`;
    });
  };

  renderItems();

  $('#preview', root).onclick = (e) => {
    if (!spot.targetImage) {
      e.preventDefault();
      toast('Take a photo of the target object first.', 'error');
      return;
    }
    saveNow();
  };
  $('#deleteSpot', root).onclick = () => {
    if (!confirm(`Delete "${spot.name}" and its content?`)) return;
    exp.spots = exp.spots.filter((s) => s.id !== spot.id);
    saveNow();
    navigate(`#/edit/${exp.id}`);
  };

  return () => {
    if (saveTimer !== undefined) saveNow();
    editor.dispose();
  };
};

// ---- Three.js editor viewport ----------------------------------------------

function createEditor(container: HTMLElement, onSelect: (id: string | null) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1e293b');
  addLights(scene);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0.9, 0.5, 2.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.2);
  controls.enableDamping = true;
  controls.update();

  const grid = new THREE.GridHelper(4, 16, '#475569', '#334155');
  grid.rotation.x = Math.PI / 2; // grid lies in the photo's plane
  grid.position.z = -0.002;
  scene.add(grid);

  let target: THREE.Mesh | null = null;
  const itemsRoot = new THREE.Group();
  scene.add(itemsRoot);
  const selection = new THREE.BoxHelper(new THREE.Object3D(), '#facc15');
  selection.visible = false;
  scene.add(selection);
  let selectedObj: THREE.Object3D | null = null;

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    controls.update();
    animateItems(itemsRoot, clock.getElapsedTime());
    if (selectedObj) selection.setFromObject(selectedObj);
    renderer.render(scene, camera);
  });

  // Tap (not drag) selects an item.
  let down: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1),
      camera,
    );
    const hit = ray.intersectObjects(itemsRoot.children, true)[0];
    if (hit) onSelect(hit.object.userData.itemId as string);
  });

  return {
    setTarget(src: string | null, aspect: number) {
      if (target) {
        scene.remove(target);
        disposeObject(target);
      }
      target = targetPlane(src, aspect);
      scene.add(target);
    },
    setItems(items: ContentItem[], selectedId: string | null) {
      for (const child of [...itemsRoot.children]) {
        itemsRoot.remove(child);
        disposeObject(child);
      }
      selectedObj = null;
      for (const item of items) {
        const obj = buildItem(item);
        itemsRoot.add(obj);
        if (item.id === selectedId) selectedObj = obj;
      }
      selection.visible = !!selectedObj;
    },
    updatePose(item: ContentItem) {
      const obj = itemsRoot.children.find((c) => c.userData.itemId === item.id);
      if (obj) applyPose(obj, item);
    },
    dispose() {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
