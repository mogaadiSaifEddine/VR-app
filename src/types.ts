/** Positions are in "target units": the image target's width is 1, its centre
 * is the origin, +x is right, +y is up and +z points out of the image towards
 * the viewer. Rotations are in degrees. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type ModelShape = 'cube' | 'sphere' | 'cone' | 'cylinder' | 'torus' | 'pin' | 'arrow' | 'star';
export type Animation = 'none' | 'spin' | 'bob' | 'pulse';

interface ContentBase {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  animation: Animation;
  /** Optional text shown in a panel when the player taps the item. */
  info: string;
}

export interface ModelItem extends ContentBase {
  type: 'model';
  shape: ModelShape;
  color: string;
}

export interface TextItem extends ContentBase {
  type: 'text';
  text: string;
  color: string;
  background: string;
}

export interface ImageItem extends ContentBase {
  type: 'image';
  /** JPEG/PNG data URL, downscaled before saving. */
  src: string;
  aspect: number;
}

export type ContentItem = ModelItem | TextItem | ImageItem;

export interface Spot {
  id: string;
  name: string;
  hint: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  unlockRadius: number;
  geofenceEnabled: boolean;
  /** Photo of the physical object used as the AR anchor (data URL). */
  targetImage: string | null;
  targetAspect: number;
  /** Rough count of trackable feature points, from compiling the target. */
  targetFeatures: number | null;
  items: ContentItem[];
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  organisation: string;
  status: 'draft' | 'published';
  spots: Spot[];
  createdAt: number;
  updatedAt: number;
}
