import type { CSSProperties } from "react";

/** 编辑画布 / 合成预览共用外框尺寸（全屏工作台） */
export function overlayWorkbenchShellProps(opts: {
  aspectClassName: string;
  fillWorkbench: boolean;
  maxPreviewWidthPx: number;
  frameClassName: string;
  imageNatural: { w: number; h: number } | null;
}): { className: string; style: CSSProperties } {
  const { aspectClassName, fillWorkbench, maxPreviewWidthPx, frameClassName, imageNatural } =
    opts;
  const useNaturalAspect = imageNatural != null && imageNatural.w > 0 && imageNatural.h > 0;
  return {
    className: [
      "relative mx-auto overflow-visible rounded-xl border border-[#d2d2d7] bg-[#1d1d1f]/90",
      useNaturalAspect ? "" : aspectClassName,
      fillWorkbench ? "h-auto max-h-full w-full max-w-full shrink-0" : "w-full",
      frameClassName,
    ]
      .filter(Boolean)
      .join(" "),
    style: {
      maxWidth: maxPreviewWidthPx,
      maxHeight: "100%",
      ...(useNaturalAspect
        ? { aspectRatio: `${imageNatural.w} / ${imageNatural.h}` }
        : {}),
    },
  };
}
