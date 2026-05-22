/** 我的剧场：收藏的空间链接（localStorage；后续可换主站表） */

export const STORY_THEATER_LIBRARY_STORAGE_KEY = "story-theater-library-v1";

export type StoryTheaterLibraryItem = {
  id: string;
  createdAt: string;
  title: string;
  note: string;
  /** story-web 空间 URL */
  spaceUrl: string;
};

function readRaw(): StoryTheaterLibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORY_THEATER_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoryTheaterLibraryItem =>
        typeof x === "object" &&
        x != null &&
        typeof (x as StoryTheaterLibraryItem).id === "string" &&
        typeof (x as StoryTheaterLibraryItem).spaceUrl === "string",
    );
  } catch {
    return [];
  }
}

function writeRaw(items: StoryTheaterLibraryItem[]) {
  window.localStorage.setItem(STORY_THEATER_LIBRARY_STORAGE_KEY, JSON.stringify(items));
}

export function listStoryTheaterLibrary(): StoryTheaterLibraryItem[] {
  return readRaw().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendStoryTheaterLibrary(item: Omit<StoryTheaterLibraryItem, "id" | "createdAt">) {
  const next: StoryTheaterLibraryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeRaw([next, ...readRaw()]);
  return next;
}

export function removeStoryTheaterLibrary(id: string) {
  writeRaw(readRaw().filter((x) => x.id !== id));
}

export function clearStoryTheaterLibrary() {
  writeRaw([]);
}
