import { filterTemplatesForGallery } from "@/lib/quick-replica/qr-template-catalog";
import type {
  QrCategory,
  QrKindBrowseItem,
  QrTemplateJson,
  QrTemplateListFilters,
} from "@/lib/quick-replica/qr-types";
import type { QrHomeFeedCategory } from "@/lib/quick-replica/qr-template-service";
import type { QuickReplicaGallerySnapshotPayload } from "@/lib/static-snapshots/quick-replica-gallery-payload";

function filterTemplatesFromCategoryPool(
  pool: QrTemplateJson[],
  filters: Pick<QrTemplateListFilters, "kind" | "toolKey">,
): QrTemplateJson[] {
  let items = pool;
  if (filters.kind) {
    items = items.filter((t) => t.kind === filters.kind);
  }
  if (filters.toolKey) {
    items = items.filter(
      (t) =>
        t.toolKey === filters.toolKey ||
        (filters.toolKey === "motion-sync" && t.kind === "motion-sync"),
    );
  }
  return filterTemplatesForGallery(items, {
    scope: "all",
    kind: filters.kind ?? undefined,
    toolKey: filters.toolKey ?? undefined,
  });
}

export function pickHomeFeedFromSnapshot(
  payload: QuickReplicaGallerySnapshotPayload,
): Record<QrHomeFeedCategory, QrTemplateJson[]> {
  return payload.homeFeed;
}

export function pickTemplatesFromSnapshot(
  payload: QuickReplicaGallerySnapshotPayload,
  filters: QrTemplateListFilters,
): QrTemplateJson[] {
  if (!filters.category) return [];
  const pool = payload.templatesByCategory[filters.category] ?? [];
  return filterTemplatesFromCategoryPool(pool, filters);
}

export function pickKindsFromSnapshot(
  payload: QuickReplicaGallerySnapshotPayload,
  category: QrCategory,
): QrKindBrowseItem[] {
  return payload.kindsByCategory[category] ?? [];
}

export function mergeUserOwnTemplatesIntoGallery(
  snapshotTemplates: QrTemplateJson[],
  ownTemplates: QrTemplateJson[],
  filters: QrTemplateListFilters,
): QrTemplateJson[] {
  const seen = new Set(snapshotTemplates.map((t) => t.id));
  const extra = ownTemplates.filter((t) => !seen.has(t.id));
  const merged = [...extra, ...snapshotTemplates];
  return filterTemplatesForGallery(merged, { ...filters, scope: "all" }).sort(
    (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
  );
}
