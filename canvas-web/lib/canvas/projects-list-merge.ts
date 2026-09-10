import type { CanvasProjectSummary } from "@/lib/canvas-api";

/** 封面相关字段不变时保留旧对象引用，避免列表卡片媒体层重挂载 */
function coverFieldsEqual(a: CanvasProjectSummary, b: CanvasProjectSummary): boolean {
  return (
    a.thumbnailUrl === b.thumbnailUrl &&
    a.coverMediaKind === b.coverMediaKind &&
    a.coverVideoUrl === b.coverVideoUrl &&
    a.coverPosterUrl === b.coverPosterUrl
  );
}

function summaryEqual(a: CanvasProjectSummary, b: CanvasProjectSummary): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.description === b.description &&
    a.edition === b.edition &&
    a.collaborationLocked === b.collaborationLocked &&
    a.updatedAt === b.updatedAt &&
    coverFieldsEqual(a, b)
  );
}

/**
 * 后台刷新首屏：保留已有顺序与「加载更多」尾部，仅 patch 字段变化项；新项插入顶部。
 */
export function mergeProjectsListRefresh(
  prev: CanvasProjectSummary[],
  firstPage: CanvasProjectSummary[],
): CanvasProjectSummary[] {
  if (prev.length === 0) return firstPage;

  const freshById = new Map(firstPage.map((p) => [p.id, p]));
  const prevIds = new Set(prev.map((p) => p.id));

  const updated = prev.map((p) => {
    const fresh = freshById.get(p.id);
    if (!fresh) return p;
    return summaryEqual(p, fresh) ? p : fresh;
  });

  const newcomers = firstPage.filter((p) => !prevIds.has(p.id));
  if (newcomers.length === 0) return updated;
  return [...newcomers, ...updated];
}
