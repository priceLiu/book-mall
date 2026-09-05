/**
 * 画布块引用的级联清理与引用计数。
 *
 * 单独成文件（只依赖 prisma）：删源路径与 refs/check 都要用，
 * 不必因此把整个画布服务拉进调用方的编译图。
 */

import { prisma } from "@/lib/prisma";

/**
 * 删源时清掉画布上的引用。**块本身保留**，变为空槽位并渲染「素材已删除」占位——
 * 删一张图不该让整页布局塌陷（见设计文档 §7.1）。
 */
export async function cascadeDeleteBlockRefsBySource(
  sourceType: string,
  sourceIds: string | string[],
): Promise<number> {
  const ids = (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(
    (v) => typeof v === "string" && v.length > 0,
  );
  if (ids.length === 0) return 0;
  try {
    const res = await prisma.aiSpaceBlockRef.deleteMany({
      where: { sourceType, sourceId: { in: ids } },
    });
    return res.count;
  } catch (e) {
    // 与 Pin 清理同策略：失败不阻断源删除，读时按「素材已删除」兜底
    console.error("[ai-space] cascadeDeleteBlockRefsBySource failed", {
      sourceType,
      ids,
      e,
    });
    return 0;
  }
}

/** 删源前检测：这些素材在本人画布上各被引用了多少次 */
export async function countBlockRefsBySource(args: {
  userId: string;
  sourceType: string;
  sourceIds: string[];
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const id of args.sourceIds) out[id] = 0;
  if (args.sourceIds.length === 0) return out;

  const rows = await prisma.aiSpaceBlockRef.findMany({
    where: {
      sourceType: args.sourceType,
      sourceId: { in: args.sourceIds },
      block: { userId: args.userId },
    },
    select: { sourceId: true },
  });
  for (const r of rows) {
    if (out[r.sourceId] !== undefined) out[r.sourceId] += 1;
  }
  return out;
}
