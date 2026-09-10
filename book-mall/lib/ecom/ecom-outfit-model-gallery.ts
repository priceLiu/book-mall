import { randomUUID } from "crypto";

import type { WorkflowRefImage, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

export const OUTFIT_MODEL_GALLERY_MAX = 9;

export type OutfitModelGalleryItem = WorkflowRefImage & { id: string };

export function sanitizeOutfitModelGalleryItem(raw: unknown): OutfitModelGalleryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
  if (!id || !ossUrl) return null;
  return {
    id,
    ossUrl,
    label: typeof o.label === "string" ? o.label : undefined,
    source:
      typeof o.source === "string"
        ? (o.source as WorkflowRefImage["source"])
        : undefined,
  };
}

export function sanitizeOutfitModelGallery(raw: unknown): OutfitModelGalleryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OutfitModelGalleryItem[] = [];
  for (const row of raw) {
    const parsed = sanitizeOutfitModelGalleryItem(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 首张为默认人物参考（同步到 refs.model） */
export function syncPrimaryOutfitModelFromGallery(refs: WorkflowRefs): WorkflowRefs {
  const gallery = refs.modelGallery ?? [];
  const next: WorkflowRefs = { ...refs, modelGallery: gallery.length ? gallery : undefined };
  const first = gallery[0];
  if (first?.ossUrl.trim()) {
    next.model = {
      ossUrl: first.ossUrl.trim(),
      source: first.source,
      label: first.label ?? "穿搭参考 1",
    };
  } else {
    delete next.model;
  }
  delete next.dressedImage;
  return next;
}

export function normalizeOutfitModelGalleryRefs(refs: WorkflowRefs): WorkflowRefs {
  let gallery = sanitizeOutfitModelGallery(refs.modelGallery);
  if (gallery.length === 0 && refs.model?.ossUrl?.trim()) {
    gallery = [
      {
        id: randomUUID(),
        ossUrl: refs.model.ossUrl.trim(),
        source: refs.model.source,
        label: refs.model.label ?? "穿搭参考 1",
      },
    ];
  }
  return syncPrimaryOutfitModelFromGallery({ ...refs, modelGallery: gallery });
}

export function appendOutfitModelGalleryItems(
  refs: WorkflowRefs,
  items: Array<Omit<OutfitModelGalleryItem, "id"> & { id?: string }>,
): WorkflowRefs {
  const normalized = normalizeOutfitModelGalleryRefs(refs);
  const gallery = [...(normalized.modelGallery ?? [])];
  for (const item of items) {
    if (gallery.length >= OUTFIT_MODEL_GALLERY_MAX) break;
    const ossUrl = item.ossUrl.trim();
    if (!ossUrl || gallery.some((g) => g.ossUrl === ossUrl)) continue;
    gallery.push({
      id: item.id?.trim() || randomUUID(),
      ossUrl,
      source: item.source,
      label: item.label,
    });
  }
  return syncPrimaryOutfitModelFromGallery({ ...normalized, modelGallery: gallery });
}

export function removeOutfitModelGalleryItem(refs: WorkflowRefs, refId: string): WorkflowRefs {
  const normalized = normalizeOutfitModelGalleryRefs(refs);
  const gallery = (normalized.modelGallery ?? []).filter((g) => g.id !== refId);
  return syncPrimaryOutfitModelFromGallery({ ...normalized, modelGallery: gallery });
}
