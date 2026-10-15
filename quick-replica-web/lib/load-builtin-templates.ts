import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  BUILTIN_TEMPLATES,
  type QrCategory,
  type QrTemplate,
} from "@/lib/qr-template-types";

let cached: QrTemplate[] | null = null;

function readJsonTemplates(path: string): QrTemplate[] {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as QrTemplate | QrTemplate[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function loadMonorepoGalleryTemplates(): QrTemplate[] {
  const galleryDir = join(process.cwd(), "..", "book-mall", "content", "quick-replica");
  const galleryFiles = [
    "builtin-video-gallery.json",
    "builtin-image-gallery.json",
    "builtin-character-gallery.json",
    "builtin-world-gallery.json",
    "builtin-motion-sync-gallery.json",
  ];
  return galleryFiles.flatMap((file) => readJsonTemplates(join(galleryDir, file)));
}

function loadFromJsonFiles(): QrTemplate[] {
  const dir = join(process.cwd(), "content", "templates");
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const fromLocal =
      files.length === 0
        ? BUILTIN_TEMPLATES
        : files.flatMap((file) => readJsonTemplates(join(dir, file)));
    const fromGallery = loadMonorepoGalleryTemplates();
    if (fromGallery.length === 0) return fromLocal;
    const seen = new Set(fromLocal.map((t) => t.id));
    const merged = [...fromLocal];
    for (const t of fromGallery) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        merged.push(t);
      }
    }
    return merged;
  } catch {
    return BUILTIN_TEMPLATES;
  }
}

export function getBuiltinTemplates(): QrTemplate[] {
  if (!cached) cached = loadFromJsonFiles();
  return cached;
}

export function listBuiltinTemplates(filters: {
  category?: QrCategory | null;
  kind?: string | null;
  toolKey?: string | null;
}): QrTemplate[] {
  let items = getBuiltinTemplates();
  if (filters.category) {
    items = items.filter((t) => t.category === filters.category);
  }
  if (filters.kind) {
    items = items.filter((t) => t.kind === filters.kind);
  }
  if (filters.toolKey) {
    items = items.filter((t) => t.toolKey === filters.toolKey);
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function getBuiltinTemplateById(id: string): QrTemplate | null {
  return getBuiltinTemplates().find((t) => t.id === id) ?? null;
}
