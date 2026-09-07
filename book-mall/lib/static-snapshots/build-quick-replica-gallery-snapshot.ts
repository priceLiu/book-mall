import { listKindBrowseItemsForSnapshot } from "@/lib/quick-replica/qr-kind-featured-service";
import {
  listQrTemplatesGalleryForSnapshot,
  QR_HOME_FEED_CATEGORIES,
} from "@/lib/quick-replica/qr-template-service";
import type { QrCategory } from "@/lib/quick-replica/qr-types";
import {
  normalizeQuickReplicaGallerySnapshotPayload,
  QR_GALLERY_SNAPSHOT_CATEGORIES,
  type QuickReplicaGallerySnapshotPayload,
} from "@/lib/static-snapshots/quick-replica-gallery-payload";

export async function buildQuickReplicaGallerySnapshot(
  now: Date = new Date(),
): Promise<QuickReplicaGallerySnapshotPayload> {
  const templatesByCategory = Object.fromEntries(
    await Promise.all(
      QR_GALLERY_SNAPSHOT_CATEGORIES.map(async (category) => {
        const templates = await listQrTemplatesGalleryForSnapshot({ category, scope: "all" });
        return [category, templates] as const;
      }),
    ),
  ) as QuickReplicaGallerySnapshotPayload["templatesByCategory"];

  const homeFeed = Object.fromEntries(
    QR_HOME_FEED_CATEGORIES.map((category) => [
      category,
      templatesByCategory[category as QrCategory] ?? [],
    ]),
  ) as QuickReplicaGallerySnapshotPayload["homeFeed"];

  const kindsByCategory = Object.fromEntries(
    await Promise.all(
      QR_GALLERY_SNAPSHOT_CATEGORIES.map(async (category) => {
        const kinds = await listKindBrowseItemsForSnapshot(category);
        return [category, kinds] as const;
      }),
    ),
  ) as QuickReplicaGallerySnapshotPayload["kindsByCategory"];

  return normalizeQuickReplicaGallerySnapshotPayload({
    version: 1,
    generatedAt: now.toISOString(),
    homeFeed,
    templatesByCategory,
    kindsByCategory,
  });
}
