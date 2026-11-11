import * as THREE from 'three';
import type { ContentItem, ModelShape, Vec3 } from './types';
import { uid } from './store';

// Builds Three.js objects for content items. Everything is in target units
// (target width = 1), see types.ts.

export const SHAPES: { value: ModelShape; label: string }[] = [
  { value: 'cube', label: 'Cube' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'cone', label: 'Cone' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'torus', label: 'Ring' },
  { value: 'pin', label: 'Map pin' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'star', label: 'Star' },
];

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function createItem(type: ContentItem['type'], extra: Partial<ContentItem> = {}): ContentItem {
  const base = {
    id: uid(),
    position: v(0, 0, 0.25),
    rotation: v(),
    scale: 0.4,
    animation: 'none' as const,
    info: '',
  };
  let item: ContentItem;
  if (type === 'model') item = { ...base, type, name: 'Model', shape: 'cube', color: '#4f8cff', animation: 'spin' };
  else if (type === 'text')
    item = { ...base, type, name: 'Text', text: 'Hello!', color: '#ffffff', background: '#1f2937', scale: 0.6, position: v(0, 0.7, 0.05) };
  else item = { ...base, type, name: 'Image', src: '', aspect: 1, scale: 0.6, position: v(0, 0, 0.05) };
  return { ...item, ...extra } as ContentItem;
}

function starShape(): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.22;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function modelObject(shape: ModelShape, color: string): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
  const mesh = (g: THREE.BufferGeometry) => new THREE.Mesh(g, mat);
  switch (shape) {
    case 'cube':
      return mesh(new THREE.BoxGeometry(1, 1, 1));
    case 'sphere':
      return mesh(new THREE.SphereGeometry(0.5, 32, 16));
    case 'cone': {
      const m = mesh(new THREE.ConeGeometry(0.5, 1, 32));
      m.rotation.x = Math.PI / 2; // point out of the image
      return m;
    }
    case 'cylinder': {
      const m = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 32));
      m.rotation.x = Math.PI / 2;
      return m;
    }
    case 'torus':
      return mesh(new THREE.TorusGeometry(0.4, 0.12, 16, 48));
    case 'star': {
      const g = new THREE.ExtrudeGeometry(starShape(), { depth: 0.15, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
      g.center();
      return mesh(g);
    }
    case 'pin': {
      // A map pin standing on the image, tip at the origin.
      const group = new THREE.Group();
      const head = mesh(new THREE.SphereGeometry(0.3, 32, 16));
      head.position.z = 0.85;
      const tip = mesh(new THREE.ConeGeometry(0.26, 0.7, 32));
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = 0.4;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
      dot.position.set(0, -0.22, 0.95);
      group.add(head, tip, dot);
      return group;
    }
    case 'arrow': {
      // Points along +y (up the image).
      const group = new THREE.Group();
      const shaft = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 24));
      shaft.position.y = -0.2;
      const head = mesh(new THREE.ConeGeometry(0.25, 0.4, 24));
      head.position.y = 0.3;
      group.add(shaft, head);
      return group;
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textObject(text: string, color: string, background: string): THREE.Object3D {
  const lines = (text || ' ').split('\n').slice(0, 8);
  const fontPx = 64;
  const pad = 36;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${fontPx}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.font = font;
  const width = Math.min(2048, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2));
  const lineH = fontPx * 1.25;
  const height = Math.ceil(lines.length * lineH + pad * 2 - (lineH - fontPx));
  canvas.width = width;
  canvas.height = height;
  ctx.font = font;
  if (background && background !== 'transparent') {
    ctx.fillStyle = background;
    roundRect(ctx, 0, 0, width, height, 28);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, width / 2, pad + i * lineH));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const aspect = height / width;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, aspect), mat);
}

function imageObject(src: string, aspect: number): THREE.Object3D {
  const mat = new THREE.MeshBasicMaterial({ color: '#cccccc', side: THREE.DoubleSide, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, aspect || 1), mat);
  if (src) {
    new THREE.TextureLoader().load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.color.set('#ffffff');
      mat.needsUpdate = true;
    });
  }
  return mesh;
}

const DEG = Math.PI / 180;

/** Wraps the item's visual in a group carrying its pose. The group's
 * userData.itemId lets raycasts find which item was tapped. */
export function buildItem(item: ContentItem): THREE.Group {
  let visual: THREE.Object3D;
  if (item.type === 'model') visual = modelObject(item.shape, item.color);
  else if (item.type === 'text') visual = textObject(item.text, item.color, item.background);
  else visual = imageObject(item.src, item.aspect);

  const inner = new THREE.Group(); // animated
  inner.add(visual);
  const outer = new THREE.Group(); // posed
  outer.add(inner);
  applyPose(outer, item);
  outer.userData.itemId = item.id;
  outer.userData.animation = item.animation;
  outer.userData.inner = inner;
  outer.traverse((o) => (o.userData.itemId = item.id));
  return outer;
}

export function applyPose(obj: THREE.Object3D, item: ContentItem): void {
  obj.position.set(item.position.x, item.position.y, item.position.z);
  obj.rotation.set(item.rotation.x * DEG, item.rotation.y * DEG, item.rotation.z * DEG);
  obj.scale.setScalar(item.scale);
}

/** Call every frame with elapsed seconds to run simple item animations. */
export function animateItems(root: THREE.Object3D, t: number): void {
  for (const child of root.children) {
    const inner = child.userData.inner as THREE.Object3D | undefined;
    if (!inner) continue;
    inner.rotation.set(0, 0, 0);
    inner.position.set(0, 0, 0);
    inner.scale.setScalar(1);
    switch (child.userData.animation) {
      case 'spin':
        inner.rotation.z = t * 1.2;
        break;
      case 'bob':
        inner.position.z = Math.sin(t * 2.2) * 0.15;
        break;
      case 'pulse':
        inner.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
        break;
    }
  }
}

export function addLights(scene: THREE.Object3D): void {
  scene.add(new THREE.HemisphereLight('#ffffff', '#666677', 1.6));
  const dir = new THREE.DirectionalLight('#ffffff', 1.8);
  dir.position.set(1, 2, 3);
  scene.add(dir);
}

/** The flat plane representing the physical target (used in the editor). */
export function targetPlane(src: string | null, aspect: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: '#888888', side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, aspect), mat);
  if (src) {
    new THREE.TextureLoader().load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.color.set('#ffffff');
      mat.needsUpdate = true;
    });
  }
  return mesh;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const map = (mat as THREE.MeshBasicMaterial).map;
      if (map) map.dispose();
      mat.dispose();
    }
  });
}
