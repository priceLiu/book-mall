import { cn } from "@/lib/utils";

/**
 * 工作区成片网格 · 标杆：模特试衣 `VtonResultsGrid`
 * 用于简易融合、主图套图、换背景选片、种草成片等（**不含**详情页点位格、分镜表单元格）。
 */
export const ECOM_WORKSPACE_RESULT_GRID_CLASS =
  "grid grid-cols-2 items-start gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export const ECOM_WORKSPACE_RESULT_LABEL_CLASS =
  "mt-0.5 h-4 shrink-0 truncate px-1 text-[10px] leading-4 text-[#6e6e73]";

export const ECOM_WORKSPACE_RESULT_COLUMN_CLASS = "flex min-w-0 flex-col gap-2";

/** 单格外壳（与试衣 `vtonTryonResultShellClass` 默认态一致） */
export function ecomWorkspaceResultShellClass(opts?: { running?: boolean; selected?: boolean }): string {
  return cn(
    "group/image relative overflow-hidden rounded-lg border bg-[#fafafa]",
    opts?.running && "ecom-media-generating-sweep border-[#0071e3]/40",
    opts?.selected && "border-[#0071e3] ring-2 ring-[#0071e3]/30",
    !opts?.running && !opts?.selected && "border-[#e8e8ed]",
  );
}

/** 静态图 / 融合图 · 3:4（默认 720×960，与试衣成片一致） */
export const ECOM_WORKSPACE_RESULT_IMAGE_ASPECT = "3 / 4";

/** 工作区内竖屏视频格 · 9:16 满列宽 */
export const ECOM_WORKSPACE_RESULT_VIDEO_ASPECT = "9 / 16";
