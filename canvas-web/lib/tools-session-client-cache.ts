import type { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";

export type ToolsSessionClientPayload = ReturnType<
  typeof parseToolsSessionPayload
>;

const MEMORY_TTL_MS = 45_000;
const SESSION_OK_STORAGE_KEY = "canvas_tools_session_ok";
const SESSION_OK_TTL_MS = 5 * 60_000;

let memoryCache: { at: number; data: ToolsSessionClientPayload } | null = null;

export function getCachedToolsSession(): ToolsSessionClientPayload | null {
  if (!memoryCache) return null;
  if (Date.now() - memoryCache.at > MEMORY_TTL_MS) {
    memoryCache = null;
    return null;
  }
  return memoryCache.data;
}

export function setCachedToolsSession(data: ToolsSessionClientPayload): void {
  memoryCache = { at: Date.now(), data };
  if (data.active) {
    markToolsSessionOkHint();
  }
}

export function clearCachedToolsSession(): void {
  memoryCache = null;
  clearToolsSessionOkHint();
}

export function readToolsSessionOkHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(SESSION_OK_STORAGE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < SESSION_OK_TTL_MS;
  } catch {
    return false;
  }
}

export function markToolsSessionOkHint(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_OK_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearToolsSessionOkHint(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_OK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
