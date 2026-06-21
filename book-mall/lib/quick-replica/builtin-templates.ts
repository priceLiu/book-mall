import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";

let cached: QrTemplateJson[] | null = null;

function loadJsonFile(relativePath: string): QrTemplateJson[] {
  const file = join(process.cwd(), "content", "quick-replica", relativePath);
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as QrTemplateJson | QrTemplateJson[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function loadFromJson(): QrTemplateJson[] {
  return [
    ...loadJsonFile("builtin-all.json"),
    ...loadJsonFile("builtin-image-gallery.json"),
    ...loadJsonFile("builtin-character-gallery.json"),
    ...loadJsonFile("builtin-world-gallery.json"),
    ...loadJsonFile("builtin-video-gallery.json"),
    ...loadJsonFile("builtin-motion-sync-gallery.json"),
  ];
}

export function getBuiltinQrTemplates(): QrTemplateJson[] {
  if (!cached) cached = loadFromJson();
  return cached;
}

export function listBuiltinQrTemplates(filters: {
  category?: QrCategory | null;
  kind?: string | null;
  toolKey?: string | null;
}): QrTemplateJson[] {
  let items = getBuiltinQrTemplates();
  if (filters.category) items = items.filter((t) => t.category === filters.category);
  if (filters.kind) items = items.filter((t) => t.kind === filters.kind);
  if (filters.toolKey) items = items.filter((t) => t.toolKey === filters.toolKey);
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function getBuiltinQrTemplateById(id: string): QrTemplateJson | null {
  return getBuiltinQrTemplates().find((t) => t.id === id) ?? null;
}
