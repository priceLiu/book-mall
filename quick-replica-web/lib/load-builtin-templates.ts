import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  BUILTIN_TEMPLATES,
  type QrCategory,
  type QrTemplate,
} from "@/lib/qr-template-types";

let cached: QrTemplate[] | null = null;

function loadFromJsonFiles(): QrTemplate[] {
  const dir = join(process.cwd(), "content", "templates");
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return BUILTIN_TEMPLATES;
    return files.flatMap((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const parsed = JSON.parse(raw) as QrTemplate | QrTemplate[];
      return Array.isArray(parsed) ? parsed : [parsed];
    });
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
