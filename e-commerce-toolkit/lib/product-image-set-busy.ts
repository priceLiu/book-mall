import type { ProductImageSetProject } from "@/lib/product-image-set-types";
import { totalStructureCount } from "@/lib/product-image-set-types";

export function isProductImageSetPlanning(project: ProductImageSetProject): boolean {
  return project.status === "planning" || project.meta.phase === "planning";
}

export function isProductImageSetGenerating(project: ProductImageSetProject): boolean {
  return project.status === "generating" || project.meta.phase === "generating";
}

export function isProductImageSetBusy(project: ProductImageSetProject): boolean {
  return isProductImageSetPlanning(project) || isProductImageSetGenerating(project);
}

export function productImageSetPlanBusyDetail(project: ProductImageSetProject): string {
  const n = totalStructureCount(project.settings.structure);
  return `视觉模型正在读取商品实拍、卖点与套图结构，并为 ${n} 个槽位撰写文生图 Prompt。通常需 1～3 分钟，请勿关闭页面；刷新后仍会显示进度。`;
}

export function productImageSetGenerateBusyDetail(
  project: ProductImageSetProject,
  generatingCount?: number,
): string {
  const n =
    generatingCount ??
    project.output.slots.filter((s) => s.status === "generating").length ??
    1;
  return `Gateway 生图进行中（约 ${n} 张），商品实拍与槽位 Prompt 一并传入模型。刷新后仍会同步进度。`;
}

export function formatProductImageSetElapsed(startedAt?: string): string | null {
  if (!startedAt?.trim()) return null;
  const ms = Date.now() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `已等待 ${sec} 秒`;
  return `已等待 ${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
}
