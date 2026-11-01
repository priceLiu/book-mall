import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import type { QuickReplicaGallerySnapshotPayload } from "@/lib/static-snapshots/quick-replica-gallery-payload";

const SHOWCASE_COUNT = 12;

function dedupeById(templates: QrTemplateJson[]): QrTemplateJson[] {
  const seen = new Set<string>();
  const out: QrTemplateJson[] = [];
  for (const t of templates) {
    if (!t.thumbnailUrl?.trim() || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** 首页一键复刻 · 12 条（image / video 优先，按 sortOrder） */
export function pickHomeV2QuickReplicaShowcase(
  payload: QuickReplicaGallerySnapshotPayload,
  limit = SHOWCASE_COUNT,
): QrTemplateJson[] {
  const image = payload.templatesByCategory.image ?? [];
  const video = payload.templatesByCategory.video ?? [];
  const character = payload.templatesByCategory.character ?? [];

  const merged = dedupeById([
    ...[...image].sort(compareTemplate),
    ...[...video].sort(compareTemplate),
    ...[...character].sort(compareTemplate),
  ]);

  return merged.slice(0, limit);
}

function compareTemplate(a: QrTemplateJson, b: QrTemplateJson): number {
  const so = a.sortOrder - b.sortOrder;
  if (so !== 0) return so;
  return b.createdAt.localeCompare(a.createdAt);
}
