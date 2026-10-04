"use client";

import type { ReactNode } from "react";

import {
  ECOM_WORKSPACE_RESULT_IMAGE_ASPECT,
  ECOM_WORKSPACE_RESULT_VIDEO_ASPECT,
} from "@/lib/ecom-workspace-result-grid";
import { vtonTryonResultAspectStyle, type VtonModelImageSize } from "@/lib/vton-image-quality";
import { cn } from "@/lib/utils";

type AspectKind = "tryon-image" | "3/4" | "9/16";

type Props = {
  aspect?: AspectKind;
  /** tryon-image 时与模特试衣底图尺寸一致 */
  modelImageSize?: VtonModelImageSize;
  className?: string;
  children?: ReactNode;
};

/** 工作区成片比例框 · 列宽内 w-full（标杆：模特试衣 `VtonTryonResultAspectFrame`） */
export function EcomWorkspaceResultFrame({
  aspect = "tryon-image",
  modelImageSize,
  className,
  children,
}: Props) {
  const style =
    aspect === "tryon-image"
      ? vtonTryonResultAspectStyle(modelImageSize)
      : aspect === "9/16"
        ? { aspectRatio: ECOM_WORKSPACE_RESULT_VIDEO_ASPECT }
        : { aspectRatio: ECOM_WORKSPACE_RESULT_IMAGE_ASPECT };

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-[#fafafa]", className)}
      style={style}
    >
      {children}
    </div>
  );
}
