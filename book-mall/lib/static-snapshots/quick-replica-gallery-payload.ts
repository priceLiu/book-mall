import type { QrKindBrowseItem } from "@/lib/quick-replica/qr-types";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import {
  QR_HOME_FEED_CATEGORIES,
  type QrHomeFeedCategory,
} from "@/lib/quick-replica/qr-types";

export const QUICK_REPLICA_GALLERY_PAGE_KEY = "quick-replica-gallery" as const;

export const QR_GALLERY_SNAPSHOT_CATEGORIES = [
  "video",
  "image",
  "character",
  "world",
  "audio",
] as const;

export type QrGallerySnapshotCategory = (typeof QR_GALLERY_SNAPSHOT_CATEGORIES)[number];

export type QuickReplicaGallerySnapshotPayload = {
  version: 1;
  generatedAt: string;
  homeFeed: Record<QrHomeFeedCategory, QrTemplateJson[]>;
  templatesByCategory: Record<QrGallerySnapshotCategory, QrTemplateJson[]>;
  kindsByCategory: Record<QrGallerySnapshotCategory, QrKindBrowseItem[]>;
};

export type QuickReplicaGallerySnapshotSummary = {
  homeFeedCounts: Record<QrHomeFeedCategory, number>;
  templateCounts: Record<QrGallerySnapshotCategory, number>;
  kindCounts: Record<QrGallerySnapshotCategory, number>;
};

export function summarizeQuickReplicaGalleryPayload(
  payload: QuickReplicaGallerySnapshotPayload,
): QuickReplicaGallerySnapshotSummary {
  const homeFeedCounts = Object.fromEntries(
    QR_HOME_FEED_CATEGORIES.map((c) => [c, payload.homeFeed[c]?.length ?? 0]),
  ) as Record<QrHomeFeedCategory, number>;
  const templateCounts = Object.fromEntries(
    QR_GALLERY_SNAPSHOT_CATEGORIES.map((c) => [c, payload.templatesByCategory[c]?.length ?? 0]),
  ) as Record<QrGallerySnapshotCategory, number>;
  const kindCounts = Object.fromEntries(
    QR_GALLERY_SNAPSHOT_CATEGORIES.map((c) => [c, payload.kindsByCategory[c]?.length ?? 0]),
  ) as Record<QrGallerySnapshotCategory, number>;
  return { homeFeedCounts, templateCounts, kindCounts };
}

export function isQuickReplicaGallerySnapshotPayload(
  value: unknown,
): value is QuickReplicaGallerySnapshotPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as QuickReplicaGallerySnapshotPayload;
  return (
    v.version === 1 &&
    typeof v.generatedAt === "string" &&
    v.homeFeed != null &&
    typeof v.homeFeed === "object" &&
    v.templatesByCategory != null &&
    typeof v.templatesByCategory === "object" &&
    v.kindsByCategory != null &&
    typeof v.kindsByCategory === "object"
  );
}

export function normalizeQuickReplicaGallerySnapshotPayload(
  payload: QuickReplicaGallerySnapshotPayload,
): QuickReplicaGallerySnapshotPayload {
  const homeFeed = Object.fromEntries(
    QR_HOME_FEED_CATEGORIES.map((c) => [c, payload.homeFeed[c] ?? []]),
  ) as Record<QrHomeFeedCategory, QrTemplateJson[]>;
  const templatesByCategory = Object.fromEntries(
    QR_GALLERY_SNAPSHOT_CATEGORIES.map((c) => [c, payload.templatesByCategory[c] ?? []]),
  ) as Record<QrGallerySnapshotCategory, QrTemplateJson[]>;
  const kindsByCategory = Object.fromEntries(
    QR_GALLERY_SNAPSHOT_CATEGORIES.map((c) => [c, payload.kindsByCategory[c] ?? []]),
  ) as Record<QrGallerySnapshotCategory, QrKindBrowseItem[]>;
  return {
    version: 1,
    generatedAt: payload.generatedAt,
    homeFeed,
    templatesByCategory,
    kindsByCategory,
  };
}
