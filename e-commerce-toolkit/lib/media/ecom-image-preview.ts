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

export function findEcomImagePreviewIndex(
  items: readonly EcomImagePreviewItem[],
  src: string,
): number {
  const trimmed = src.trim();
  return items.findIndex((it) => it.src.trim() === trimmed);
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
