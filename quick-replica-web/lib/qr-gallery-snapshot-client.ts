"use client";

import type { QrCategory, QrKindBrowseItem, QrTemplate } from "@/lib/qr-template-types";
import type { QrHomeCardCategory } from "@/lib/qr-home-feed";

export type QrGallerySnapshotPayload = {
  version: 1;
  generatedAt: string;
  homeFeed: Partial<Record<QrHomeCardCategory, QrTemplate[]>>;
  templatesByCategory: Partial<Record<QrCategory, QrTemplate[]>>;
  kindsByCategory: Partial<Record<QrCategory, QrKindBrowseItem[]>>;
};

type SnapshotResponse = {
  payload: QrGallerySnapshotPayload;
  dateKey: string;
  stale: boolean;
  source: string;
};

let cached: SnapshotResponse | null = null;
let inflight: Promise<SnapshotResponse | null> | null = null;

export function invalidateQrGallerySnapshotClientCache(): void {
  cached = null;
  inflight = null;
}

export async function fetchQrGallerySnapshot(
  force = false,
): Promise<SnapshotResponse | null> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = fetch("/api/gallery-snapshot", { cache: "no-store", credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as SnapshotResponse;
      if (!data?.payload) return null;
      cached = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function pickTemplatesFromGallerySnapshot(
  payload: QrGallerySnapshotPayload,
  input: { category?: QrCategory | null; kind?: string | null; toolKey?: string | null },
): QrTemplate[] {
  if (!input.category) return [];
  let items = payload.templatesByCategory[input.category] ?? [];
  if (input.kind) items = items.filter((t) => t.kind === input.kind);
  if (input.toolKey) {
    items = items.filter(
      (t) =>
        t.toolKey === input.toolKey ||
        (input.toolKey === "motion-sync" && t.kind === "motion-sync"),
    );
  }
  return items;
}

export function pickKindsFromGallerySnapshot(
  payload: QrGallerySnapshotPayload,
  category: QrCategory,
): QrKindBrowseItem[] {
  return payload.kindsByCategory[category] ?? [];
}

export function pickHomeFeedFromGallerySnapshot(
  payload: QrGallerySnapshotPayload,
): Partial<Record<QrHomeCardCategory, QrTemplate[]>> {
  return payload.homeFeed;
}
