/**
 * 电商工具箱 · 图片放大预览公共类型与工具。
 * 规范组件：`components/media/ecom-image-preview-dialog.tsx` + `ecom-image-preview-host.tsx`
 * 跨子应用同步：`node scripts/sync-image-zoom-pan.mjs`（含本文件）
 */

export type EcomImagePreviewItem = {
  src: string;
  title: string;
  thumbSrc?: string;
};

export type EcomImagePreviewOpenState = {
  initialIndex: number;
  fallbackSrc: string;
  fallbackTitle: string;
};

/** 预览画廊匹配：忽略 query/hash，避免 OSS 处理参数导致索引错位 */
export function normalizeEcomImagePreviewUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    return `${u.origin}${u.pathname}`;
  } catch {
    return trimmed.split(/[?#]/)[0] ?? trimmed;
  }
}

export function findEcomImagePreviewIndex(
  items: readonly EcomImagePreviewItem[],
  src: string,
): number {
  const needle = normalizeEcomImagePreviewUrl(src);
  return items.findIndex(
    (it) => normalizeEcomImagePreviewUrl(it.src) === needle,
  );
}

export function buildEcomImagePreviewOpenState(
  src: string,
  title: string,
  items: readonly EcomImagePreviewItem[],
): EcomImagePreviewOpenState {
  const trimmed = src.trim();
  const idx = findEcomImagePreviewIndex(items, trimmed);
  return {
    initialIndex: idx >= 0 ? idx : 0,
    fallbackSrc: trimmed,
    fallbackTitle: title,
  };
}

export function mapPreviewItemsFromEntries(
  entries: readonly {
    url: string;
    title: string;
    thumbUrl?: string | null;
  }[],
): EcomImagePreviewItem[] {
  return entries
    .map((e) => {
      const src = e.url.trim();
      if (!src) return null;
      return {
        src,
        title: e.title,
        ...(e.thumbUrl?.trim() ? { thumbSrc: e.thumbUrl.trim() } : {}),
      };
    })
    .filter((item): item is EcomImagePreviewItem => item != null);
}

/** 分镜 sheet 各镜已生成分镜图 */
export function buildStoryboardPanelPreviewItems(
  panels: readonly { index: number; imageUrl?: string | null }[],
): EcomImagePreviewItem[] {
  return panels
    .filter((p) => p.imageUrl?.trim())
    .map((p) => ({
      src: p.imageUrl!.trim(),
      title: `镜头 ${p.index}`,
    }));
}

/** 成片区预览画廊：各镜在前，合成完整分镜 PNG 在最后（可选） */
export function buildStoryboardSheetPreviewGalleryItems(
  panels: readonly { index: number; imageUrl?: string | null }[],
  sheetPngUrl?: string | null,
  opts?: { includeSheetPng?: boolean },
): EcomImagePreviewItem[] {
  const items = buildStoryboardPanelPreviewItems(panels);
  if (opts?.includeSheetPng === false) return items;
  const png = sheetPngUrl?.trim();
  if (png) {
    items.push({ src: png, title: "完整分镜图" });
  }
  return items;
}

export function buildStoryboardReferencePreviewItems(
  references: readonly { role: string; label: string; ossUrl: string }[],
): EcomImagePreviewItem[] {
  return references
    .filter((r) => r.ossUrl?.trim())
    .map((r) => ({
      src: r.ossUrl.trim(),
      title: `${r.role === "product" ? "产品" : r.role === "character" ? "角色" : "场景"} · ${r.label}`,
    }));
}

/** 分镜表 Dialog 内点击放大：参考图 + 各镜（不含易过期的合成 PNG） */
export function buildStoryboardSheetDialogPreviewGalleryItems(
  panels: readonly { index: number; imageUrl?: string | null }[],
  references: readonly { role: string; label: string; ossUrl: string }[],
  _sheetPngUrl?: string | null,
): EcomImagePreviewItem[] {
  return [
    ...buildStoryboardReferencePreviewItems(references),
    ...buildStoryboardSheetPreviewGalleryItems(panels, null, { includeSheetPng: false }),
  ];
}

/** 模特姿势各姿势已生成图（含历史版本） */
export function buildModelShotPosePreviewItems(
  items: readonly {
    index: number;
    imageUrl?: string | null;
    title?: string | null;
    imageHistory?: readonly { url: string }[] | null;
  }[],
): EcomImagePreviewItem[] {
  const out: EcomImagePreviewItem[] = [];
  for (const p of items) {
    const titleBase = p.title?.trim() || `姿势 ${p.index}`;
    const history =
      Array.isArray(p.imageHistory) && p.imageHistory.length > 0
        ? p.imageHistory.map((v) => v.url?.trim()).filter(Boolean)
        : p.imageUrl?.trim()
          ? [p.imageUrl.trim()]
          : [];
    history.forEach((src, i) => {
      out.push({
        src: src!,
        title: history.length > 1 ? `${titleBase} · v${i + 1}` : titleBase,
      });
    });
  }
  return out;
}
