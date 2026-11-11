import * as THREE from 'three';
import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import { addLights, animateItems } from './content';

// Image-target AR session: camera feed + MindAR tracking + Three.js overlay.
// We drive MindAR's Controller directly (instead of its bundled Three.js
// helper, which needs an old Three.js version).

export interface ARSessionOptions {
  container: HTMLElement;
  targetBuffer: Uint8Array;
  onFound?: () => void;
  onLost?: () => void;
  onTap?: (itemId: string | null) => void;
}

const HIDDEN = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);

export class ARSession {
  /** Add content here, in target units (target width = 1, centred). */
  readonly anchor = new THREE.Group();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private renderer: THREE.WebGLRenderer;
  private video: HTMLVideoElement;
  private controller: Controller | null = null;
  private postMatrix = new THREE.Matrix4();
  private visible = false;
  private stopped = false;
  private clock = new THREE.Clock();
  private onResize = () => this.resize();
  private onPointer = (e: PointerEvent) => this.handleTap(e);

  constructor(private opts: ARSessionOptions) {
    const { container } = opts;
    this.video = document.createElement('video');
    this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    this.video.className = 'ar-video';
    container.appendChild(this.video);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = 'ar-canvas';
    container.appendChild(this.renderer.domElement);

    this.anchor.matrixAutoUpdate = false;
    this.anchor.visible = false;
    this.scene.add(this.anchor);
    addLights(this.scene);
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera is not available. Open this page over HTTPS in Safari (iPhone) or Chrome (Android).');
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch {
      throw new Error('Camera permission was denied. Allow camera access for this site and try again.');
    }
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      if (this.video.readyState >= 1) resolve();
      else this.video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });
    await this.video.play().catch(() => {});
    this.video.width = this.video.videoWidth;
    this.video.height = this.video.videoHeight;

    const controller = new Controller({
      inputWidth: this.video.videoWidth,
      inputHeight: this.video.videoHeight,
      maxTrack: 1,
      filterMinCF: 0.0001,
      filterBeta: 0.001,
      warmupTolerance: 3,
      missTolerance: 5,
      onUpdate: (data) => {
        if (data.type !== 'updateMatrix') return;
        this.updateAnchor(data.worldMatrix ?? null);
      },
    });
    this.controller = controller;

    const { dimensions } = controller.addImageTargetsFromBuffer(this.opts.targetBuffer);
    const [w, h] = dimensions[0];
    // MindAR's world matrix is in target pixels with the origin at the
    // bottom-left corner. Re-centre and scale so the target is 1 unit wide.
    this.postMatrix.compose(
      new THREE.Vector3(w / 2, h / 2, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(w, w, w),
    );

    this.resize();
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointer);

    controller.dummyRun(this.video);
    if (this.stopped) return;
    controller.processVideo(this.video);

    this.renderer.setAnimationLoop(() => {
      animateItems(this.anchor, this.clock.getElapsedTime());
      this.renderer.render(this.scene, this.camera);
    });
  }

  private updateAnchor(worldMatrix: number[] | null): void {
    if (worldMatrix) {
      const m = new THREE.Matrix4();
      m.fromArray(worldMatrix);
      m.multiply(this.postMatrix);
      this.anchor.matrix.copy(m);
      this.anchor.matrixWorldNeedsUpdate = true;
      this.anchor.visible = true;
      if (!this.visible) {
        this.visible = true;
        this.opts.onFound?.();
      }
    } else {
      this.anchor.matrix.copy(HIDDEN);
      this.anchor.visible = false;
      if (this.visible) {
        this.visible = false;
        this.opts.onLost?.();
      }
    }
  }

  private handleTap(e: PointerEvent): void {
    if (!this.opts.onTap) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = this.anchor.visible ? ray.intersectObjects(this.anchor.children, true)[0] : undefined;
    this.opts.onTap((hit?.object.userData.itemId as string | undefined) ?? null);
  }

  /** Mirrors MindAR's own resize logic: video covers the container, and the
   * Three.js camera uses MindAR's projection adjusted for the crop. */
  private resize(): void {
    const { container } = this.opts;
    const controller = this.controller;
    if (!controller) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const video = this.video;

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = cw / ch;
    let vw: number, vh: number;
    if (videoRatio > containerRatio) {
      vh = ch;
      vw = vh * videoRatio;
    } else {
      vw = cw;
      vh = vw / videoRatio;
    }

    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    let videoDisplayHeight: number;
    if (inputRatio > containerRatio) {
      videoDisplayHeight = ch * (video.width / controller.inputWidth);
    } else {
      videoDisplayHeight = (cw / controller.inputWidth) * controller.inputHeight * (video.height / controller.inputHeight);
    }
    const fovAdjust = ch / videoDisplayHeight;

    this.camera.fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI;
    this.camera.near = proj[14] / (proj[10] - 1.0);
    this.camera.far = proj[14] / (proj[10] + 1.0);
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
    this.renderer.setSize(cw, ch);
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointer);
    this.renderer.setAnimationLoop(null);
    try {
      this.controller?.stopProcessVideo();
      this.controller?.dispose();
    } catch {
      /* ignore */
    }
    const stream = this.video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.video.remove();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
