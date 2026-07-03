/**
 * MiniMax 系统音色目录（OSS manifest + 本地 fallback）
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type MinimaxVoiceCatalogEntry = {
  voiceId: string;
  label: string;
  language: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter?: string;
};

export type MinimaxVoiceCatalogManifest = {
  schemaVersion: 1;
  total: number;
  pageSize: number;
  voices: MinimaxVoiceCatalogEntry[];
  updatedAt?: string;
};

const ROOT = resolve(process.cwd());
const MANIFEST_PATH = resolve(ROOT, "content/quick-replica/minimax-voice-catalog.json");
const DOCS_MINIMAX_PATH = resolve(ROOT, "../docs/minimax.md");

let cachedManifest: MinimaxVoiceCatalogManifest | null = null;

function avatarLetterFromLabel(label: string): string {
  const ch = label.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

/** 从 docs/minimax.md 表格解析系统音色（离线 fallback） */
export function parseMinimaxMdVoiceTable(md: string): MinimaxVoiceCatalogEntry[] {
  const lines = md.split("\n");
  const voices: MinimaxVoiceCatalogEntry[] = [];
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("序号") || line.includes(":--")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    // 仅解析「序号 | 语言 | voice_id | 名称」四列表格
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    const language = cells[1] ?? "";
    const voiceIdRaw = cells[2] ?? "";
    const label = cells[3] ?? voiceIdRaw;
    const voiceId = voiceIdRaw.replace(/^`/, "").replace(/`$/, "").trim();
    if (!voiceId || voiceId === "音色 ID (Voice ID)") continue;
    if (!/^[A-Za-z0-9_ ().-]+$/.test(voiceId)) continue;
    voices.push({
      voiceId,
      label,
      language,
      avatarLetter: avatarLetterFromLabel(label),
      tags: [language].filter(Boolean),
    });
  }
  return voices;
}

function loadManifestFromDisk(): MinimaxVoiceCatalogManifest | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as MinimaxVoiceCatalogManifest;
  } catch {
    return null;
  }
}

function loadFallbackManifest(): MinimaxVoiceCatalogManifest {
  let voices: MinimaxVoiceCatalogEntry[] = [];
  if (existsSync(DOCS_MINIMAX_PATH)) {
    voices = parseMinimaxMdVoiceTable(readFileSync(DOCS_MINIMAX_PATH, "utf8"));
  }
  return {
    schemaVersion: 1,
    total: voices.length,
    pageSize: 40,
    voices,
  };
}

export function loadMinimaxVoiceCatalog(): MinimaxVoiceCatalogManifest {
  if (cachedManifest) return cachedManifest;
  cachedManifest = loadManifestFromDisk() ?? loadFallbackManifest();
  return cachedManifest;
}

export function getMinimaxVoicePage(args: {
  page?: number;
  pageSize?: number;
}): {
  items: MinimaxVoiceCatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
} {
  const catalog = loadMinimaxVoiceCatalog();
  const pageSize = Math.min(Math.max(args.pageSize ?? catalog.pageSize ?? 40, 1), 100);
  const page = Math.max(args.page ?? 1, 1);
  const total = catalog.total || catalog.voices.length;
  const start = (page - 1) * pageSize;
  const items = catalog.voices.slice(start, start + pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: start + items.length < total,
  };
}

export function findMinimaxVoiceById(voiceId: string): MinimaxVoiceCatalogEntry | null {
  const id = voiceId.trim();
  if (!id) return null;
  const catalog = loadMinimaxVoiceCatalog();
  return catalog.voices.find((v) => v.voiceId === id) ?? null;
}

export function invalidateMinimaxVoiceCatalogCache(): void {
  cachedManifest = null;
}
