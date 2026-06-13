/**
 * 项目资产 · 从节点 data / payload 提取可持久化的媒体 URL
 */

import type { ProjectAssetKind, ProjectAssetRecord } from "./project-asset-types";

export function normalizePersistableMediaUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return "";
}

export function isHttpMediaUrl(v: unknown): v is string {
  return Boolean(normalizePersistableMediaUrl(v));
}

export function firstHttpMediaUrl(...candidates: unknown[]): string {
  for (const c of candidates) {
    const url = normalizePersistableMediaUrl(c);
    if (url) return url;
  }
  return "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 从任意画布节点 data 提取可入库的媒体 URL（Pro2/sbv1/列节点字段不一） */
export function mediaUrlFromNodeData(data: Record<string, unknown>): string {
  const runtime =
    data.runtime && typeof data.runtime === "object" && !Array.isArray(data.runtime)
      ? (data.runtime as Record<string, unknown>)
      : undefined;
  return firstHttpMediaUrl(
    data.ossUrl,
    data.blobUrl,
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

export type ProjectAssetMediaItem = {
  id: string;
  url: string;
  label: string;
  mimeType: string | null;
};

/** 汇总资产全部可预览媒体（列表缩略图 / 悬停 / 多格条） */
export function collectProjectAssetMediaItems(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "displayName" | "thumbnailUrl" | "refs" | "payload"
  >,
): ProjectAssetMediaItem[] {
  const payload = asset.payload ?? {};

  /** 组资产：以 layout 子节点为准（每张角色/分镜一格） */
  if (asset.kind === "GROUP_BUNDLE") {
    const layoutItems = collectLayoutNodeMediaItems(payload);
    if (layoutItems.length > 0) return layoutItems;
  }

  const out: ProjectAssetMediaItem[] = [];
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

const GROUP_LAYOUT_MEDIA_TYPES = new Set([
  "story-pro2-three-view",
  "story-pro2-image",
  "sbv1-image",
  "sbv1-video-engine",
  "image-engine",
  "three-view-engine",
  "video-engine",
]);

/** 组 layout 内各子节点的媒体（按节点 id 去重，不按 URL） */
export function collectLayoutNodeMediaItems(
  payload: Record<string, unknown>,
): ProjectAssetMediaItem[] {
  const out: ProjectAssetMediaItem[] = [];
  const seenIds = new Set<string>();

  for (const node of readLayoutNodes(payload)) {
    const nodeType = str(node.type);
    if (nodeType === "group") continue;
    if (nodeType && !GROUP_LAYOUT_MEDIA_TYPES.has(nodeType)) continue;

    const url = mediaUrlFromNodeData(node.data ?? {});
    if (!url) continue;

    const normalized = normalizePersistableMediaUrl(url);
    if (!normalized) continue;

    const id = `layout-${node.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    out.push({
      id,
      url: normalized,
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

/** 保存对话框预览：组资产允许 blob 本地 URL，layout 子节点全量展示 */
export function collectProjectAssetDraftPreviewItems(
  asset: Pick<
    ProjectAssetRecord,
    "kind" | "displayName" | "thumbnailUrl" | "refs" | "payload"
  >,
): ProjectAssetMediaItem[] {
  const persisted = collectProjectAssetMediaItems(asset).filter((i) => i.url);
  if (asset.kind !== "GROUP_BUNDLE") return persisted;

  const layoutPreview = collectLayoutNodeMediaItemsForPreview(asset.payload ?? {});
  return layoutPreview.length > persisted.length ? layoutPreview : persisted;
}

function collectLayoutNodeMediaItemsForPreview(
  payload: Record<string, unknown>,
): ProjectAssetMediaItem[] {
  const out: ProjectAssetMediaItem[] = [];
  const seenIds = new Set<string>();

  for (const node of readLayoutNodes(payload)) {
    const nodeType = str(node.type);
    if (nodeType === "group") continue;
    if (nodeType && !GROUP_LAYOUT_MEDIA_TYPES.has(nodeType)) continue;

    const raw = mediaUrlFromNodeData(node.data ?? {});
    if (!raw) continue;

    const id = `layout-${node.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    out.push({
      id,
      url: normalizePersistableMediaUrl(raw) || raw,
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

/** 从已保存 payload 回退读取首个媒体 URL */
export function mediaUrlFromAssetPayload(
  payload: Record<string, unknown> | null | undefined,
  kind: ProjectAssetKind = "STORYBOARD_IMAGE",
  displayName = "",
): string {
  return collectProjectAssetMediaItems({
    kind,
    displayName,
    thumbnailUrl: "",
    refs: [],
    payload: payload ?? {},
  })[0]?.url ?? "";
}
