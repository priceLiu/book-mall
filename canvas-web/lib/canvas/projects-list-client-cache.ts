import type { CanvasProjectListPage } from "@/lib/canvas-api";

const CACHE_KEY = "canvas:projects-list:v1";
const TTL_MS = 60_000;

type CachedProjectsList = {
  savedAt: number;
  page: CanvasProjectListPage;
};

function readRaw(): CachedProjectsList | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProjectsList;
    if (!parsed?.page || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadCachedProjectsList(): CanvasProjectListPage | null {
  return readRaw()?.page ?? null;
}

export function saveCachedProjectsList(page: CanvasProjectListPage): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: CachedProjectsList = { savedAt: Date.now(), page };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function invalidateCachedProjectsList(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isCachedProjectsListStale(): boolean {
  return readRaw() === null;
}
