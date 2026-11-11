import { Compiler } from 'mind-ar/dist/mindar-image.prod.js';
import { loadImage } from './image';

// Image targets are stored as plain photos and compiled to MindAR tracking
// data in the browser when needed. Compiled data is cached in memory for the
// session (it is too large to keep in localStorage).

const cache = new Map<string, Uint8Array>();

export interface CompileResult {
  buffer: Uint8Array;
  features: number;
}

export async function compileTarget(
  imageDataUrl: string,
  onProgress?: (percent: number) => void,
): Promise<CompileResult> {
  const cached = cache.get(imageDataUrl);
  if (cached) return { buffer: cached, features: -1 };
  const img = await loadImage(imageDataUrl);
  const compiler = new Compiler();
  const data = await compiler.compileImageTargets([img], (p) => onProgress?.(Math.min(100, p)));
  const buffer = compiler.exportData();
  cache.set(imageDataUrl, buffer);
  const features = data[0].matchingData.reduce(
    (sum, k) => sum + k.maximaPoints.length + k.minimaPoints.length,
    0,
  );
  return { buffer, features };
}

export function targetQuality(features: number | null): { label: string; level: 'good' | 'ok' | 'poor' | 'unknown' } {
  if (features == null || features < 0) return { label: 'Not checked', level: 'unknown' };
  if (features >= 400) return { label: 'Good — lots of detail to track', level: 'good' };
  if (features >= 150) return { label: 'OK — may need good light', level: 'ok' };
  return { label: 'Poor — pick something with more detail or texture', level: 'poor' };
}
