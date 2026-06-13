/**
 * 项目资产 · 从 payload 回退解析媒体 URL（与 canvas-web project-asset-media-url 对齐）
 */

import type { ProjectAssetKind } from "@prisma/client";

import type {
  ProjectAssetRecord,
  ProjectAssetRefRecord,
} from "./project-asset-types";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isHttpMediaUrl(v: unknown): v is string {
  return Boolean(normalizePersistableMediaUrl(v));
}

function normalizePersistableMediaUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return "";
}

function firstHttpMediaUrl(...candidates: unknown[]): string {
  for (const c of candidates) {
    const url = normalizePersistableMediaUrl(c);
    if (url) return url;
  }
  return "";
}

function mediaUrlFromNodeData(data: Record<string, unknown>): string {
  const runtime =
    data.runtime && typeof data.runtime === "object" && !Array.isArray(data.runtime)
      ? (data.runtime as Record<string, unknown>)
      : undefined;
  return firstHttpMediaUrl(
    data.ossUrl,
    data.imageUrl,
    data.videoUrl,
    data.previewUrl,
    data.thumbnailUrl,
    runtime?.ossUrl,
    runtime?.ephemeralUrl,
  );
}

type LayoutNode = {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
};

function readLayoutNodes(payload: Record<string, unknown>): LayoutNode[] {
  const layout = payload.layout;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) return [];
  const nodes = (layout as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes.filter(
    (n): n is LayoutNode =>
      Boolean(n) &&
      typeof n === "object" &&
      typeof (n as LayoutNode).id === "string",
  );
}

export type AssetMediaItem = {
  id: string;
  url: string;
  label: string;
  mimeType: string | null;
};

const GROUP_LAYOUT_MEDIA_TYPES = new Set([
  "story-pro2-three-view",
  "story-pro2-image",
  "sbv1-image",
  "sbv1-video-engine",
  "image-engine",
  "three-view-engine",
  "video-engine",
]);

export function collectLayoutNodeMediaItems(
  payload: Record<string, unknown>,
): AssetMediaItem[] {
  const out: AssetMediaItem[] = [];
  const seenIds = new Set<string>();

  for (const node of readLayoutNodes(payload)) {
    const nodeType = str(node.type);
    if (nodeType === "group") continue;
    if (nodeType && !GROUP_LAYOUT_MEDIA_TYPES.has(nodeType)) continue;

    const url = mediaUrlFromNodeData(node.data ?? {});
    if (!url) continue;

    const id = `layout-${node.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    out.push({
      id,
      url: normalizePersistableMediaUrl(url),
      label:
        str(node.data?.label) ||
        str(node.data?.characterKey) ||
        nodeType ||
        node.id,
      mimeType: null,
    });
  }

  return out;
}

export function collectAssetMediaItems(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "displayName" | "thumbnailUrl" | "refs" | "payload"
  >,
): AssetMediaItem[] {
  const payload = asset.payload ?? {};

  if (asset.kind === "GROUP_BUNDLE") {
    const layoutItems = collectLayoutNodeMediaItems(payload);
    if (layoutItems.length > 0) return layoutItems;
  }

  const out: AssetMediaItem[] = [];
  const seen = new Set<string>();
  const push = (
    url: unknown,
    label: string,
    id: string,
    mimeType: string | null = null,
  ) => {
    const normalized = normalizePersistableMediaUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push({ id, url: normalized, label, mimeType });
  };

  if (isHttpMediaUrl(asset.thumbnailUrl)) {
    push(asset.thumbnailUrl, "封面", "thumb");
  }

  for (const ref of asset.refs) {
    push(
      ref.mediaUrl,
      ref.label?.trim() || ref.slotKey,
      ref.id,
      ref.mimeType,
    );
  }

  const snap = payload.nodeSnapshot;
  if (snap && typeof snap === "object" && !Array.isArray(snap)) {
    const url = mediaUrlFromNodeData(snap as Record<string, unknown>);
    if (url) {
      push(
        url,
        str((snap as Record<string, unknown>).label) || asset.displayName,
        "nodeSnapshot",
      );
    }
  }

  const slots = payload.slots;
  if (slots && typeof slots === "object" && !Array.isArray(slots)) {
    for (const [key, value] of Object.entries(slots as Record<string, unknown>)) {
      push(value, key, `slot-${key}`);
    }
  }

  const refUrls = payload.refUrls;
  if (Array.isArray(refUrls)) {
    refUrls.forEach((url, i) => {
      push(url, `参考 ${i + 1}`, `refUrl-${i}`);
    });
  }

  return out;
}

export function mediaUrlFromAssetPayload(
  payload: Record<string, unknown> | null | undefined,
  kind: ProjectAssetKind = "STORYBOARD_IMAGE",
  displayName = "",
): string {
  return collectAssetMediaItems({
    kind,
    displayName,
    thumbnailUrl: "",
    refs: [],
    payload: payload ?? {},
  })[0]?.url ?? "";
}

export function resolveAssetMediaUrl(input: {
  thumbnailUrl?: string | null;
  refs?: Array<{ mediaUrl?: string | null }>;
  payload?: Record<string, unknown> | null;
  kind?: ProjectAssetKind;
  displayName?: string;
}): string {
  return collectAssetMediaItems({
    kind: input.kind ?? "STORYBOARD_IMAGE",
    displayName: input.displayName ?? "",
    thumbnailUrl: input.thumbnailUrl ?? "",
    refs: (input.refs ?? []).map((r, i) => ({
      id: `ref-${i}`,
      slotKey: `ref-${i}`,
      label: "",
      mediaUrl: r.mediaUrl ?? "",
      mimeType: null,
      meta: null,
      sortOrder: i,
    })),
    payload: input.payload ?? {},
  })[0]?.url ?? "";
}

/** 列表/详情：用 payload 补全缺失的 thumbnail 与 refs（不改库，仅展示） */
export function enrichAssetMediaDisplay(
  record: ProjectAssetRecord,
): ProjectAssetRecord {
  const items = collectAssetMediaItems(record);
  if (items.length === 0) return record;

  const thumbnailUrl = isHttpMediaUrl(record.thumbnailUrl)
    ? record.thumbnailUrl.trim()
    : items[0]!.url;

  const existingUrls = new Set(
    record.refs.map((r) => r.mediaUrl.trim()).filter(isHttpMediaUrl),
  );
  const extraRefs: ProjectAssetRefRecord[] = [];

  for (const item of items) {
    if (existingUrls.has(item.url)) continue;
    existingUrls.add(item.url);
    extraRefs.push({
      id: item.id.startsWith("layout-") ? item.id : `computed-${item.id}`,
      slotKey: item.id,
      label: item.label,
      mediaUrl: item.url,
      mimeType: item.mimeType,
      meta: null,
      sortOrder: record.refs.length + extraRefs.length,
    });
  }

  if (
    isHttpMediaUrl(record.thumbnailUrl) &&
    extraRefs.length === 0 &&
    record.refs.length > 0 &&
    record.kind !== "GROUP_BUNDLE"
  ) {
    return record;
  }

  return {
    ...record,
    thumbnailUrl,
    refs: [...record.refs, ...extraRefs],
  };
}

export function defaultRefSlotForKind(kind: string): string {
  switch (kind) {
    case "CHARACTER":
      return "three_view";
    case "STORYBOARD_VIDEO":
      return "video";
    case "STYLE":
      return "ref_0";
    default:
      return "main";
  }
}

export { isHttpMediaUrl, normalizePersistableMediaUrl, str };
