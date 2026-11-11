/** Reads an image file, downscales it and returns a JPEG data URL, so it fits
 * in localStorage. */
export async function fileToDataUrl(
  file: File,
  maxSide: number,
  quality = 0.82,
  keepPng = false,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await loadImage(URL.createObjectURL(file));
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  URL.revokeObjectURL(bitmap.src);
  const png = keepPng && file.type === 'image/png';
  return { dataUrl: canvas.toDataURL(png ? 'image/png' : 'image/jpeg', quality), width, height };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image.'));
    img.src = src;
  });
}
