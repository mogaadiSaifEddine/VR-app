import type { ContentItem, Experience, Spot } from './types';

// All data lives in the browser's localStorage for the POC (no backend).
// Use Export / Import on the home screen to move experiences between devices.

const KEY = 'placear.experiences.v1';
const SETTINGS_KEY = 'placear.settings.v1';
const PROGRESS_KEY = 'placear.progress.v1';

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Delete or export some experiences, or use smaller images.');
  }
}

export const uid = (): string =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new StorageFullError();
    }
    throw err;
  }
}

export function listExperiences(): Experience[] {
  return safeParse<Experience[]>(localStorage.getItem(KEY), []);
}

export function getExperience(id: string): Experience | undefined {
  return listExperiences().find((e) => e.id === id);
}

export function saveExperience(exp: Experience): void {
  const all = listExperiences();
  exp.updatedAt = Date.now();
  const i = all.findIndex((e) => e.id === exp.id);
  if (i >= 0) all[i] = exp;
  else all.unshift(exp);
  write(KEY, all);
}

export function deleteExperience(id: string): void {
  write(KEY, listExperiences().filter((e) => e.id !== id));
}

export function newExperience(): Experience {
  const now = Date.now();
  return {
    id: uid(),
    title: 'Untitled experience',
    description: '',
    organisation: '',
    status: 'draft',
    spots: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newSpot(index: number): Spot {
  return {
    id: uid(),
    name: `Spot ${index + 1}`,
    hint: '',
    lat: null,
    lng: null,
    accuracy: null,
    unlockRadius: 50,
    geofenceEnabled: true,
    targetImage: null,
    targetAspect: 1,
    targetFeatures: null,
    items: [],
  };
}

export function findSpot(exp: Experience, spotId: string): Spot | undefined {
  return exp.spots.find((s) => s.id === spotId);
}

export function findItem(spot: Spot, itemId: string): ContentItem | undefined {
  return spot.items.find((i) => i.id === itemId);
}

// ---- Import / export -------------------------------------------------------

interface ExportFile {
  format: 'placear-export';
  version: 1;
  exportedAt: string;
  experiences: Experience[];
}

export function exportJson(experiences: Experience[]): string {
  const file: ExportFile = {
    format: 'placear-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    experiences,
  };
  return JSON.stringify(file);
}

/** Merges experiences from an export file. Same id = overwritten. Returns count. */
export function importJson(text: string): number {
  const data = JSON.parse(text) as Partial<ExportFile>;
  if (data.format !== 'placear-export' || !Array.isArray(data.experiences)) {
    throw new Error('This is not a PlaceAR export file.');
  }
  const all = listExperiences();
  for (const exp of data.experiences) {
    if (!exp || typeof exp.id !== 'string' || !Array.isArray(exp.spots)) continue;
    const i = all.findIndex((e) => e.id === exp.id);
    if (i >= 0) all[i] = exp;
    else all.unshift(exp);
  }
  write(KEY, all);
  return data.experiences.length;
}

// ---- Settings & player progress -------------------------------------------

export interface Settings {
  /** Skip the GPS check so the app can be tested away from the real place. */
  ignoreLocation: boolean;
}

export function getSettings(): Settings {
  return { ignoreLocation: false, ...safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {}) };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

type Progress = Record<string, string[]>; // experienceId -> found spot ids

export function getFoundSpots(expId: string): string[] {
  return safeParse<Progress>(localStorage.getItem(PROGRESS_KEY), {})[expId] ?? [];
}

export function markSpotFound(expId: string, spotId: string): void {
  const p = safeParse<Progress>(localStorage.getItem(PROGRESS_KEY), {});
  const list = new Set(p[expId] ?? []);
  list.add(spotId);
  p[expId] = [...list];
  write(PROGRESS_KEY, p);
}

export function resetProgress(expId: string): void {
  const p = safeParse<Progress>(localStorage.getItem(PROGRESS_KEY), {});
  delete p[expId];
  write(PROGRESS_KEY, p);
}

/** Approximate bytes used by this app in localStorage (UTF-16 = 2 bytes/char). */
export function storageUsage(): number {
  let chars = 0;
  for (const k of [KEY, SETTINGS_KEY, PROGRESS_KEY]) chars += (localStorage.getItem(k) ?? '').length;
  return chars * 2;
}
