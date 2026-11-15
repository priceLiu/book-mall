"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import {
  ECOM_ADAPTIVE_BRAND_MARK_MAX_PX,
} from "@/lib/media/ecom-media-display-spec";
import { cn } from "@/lib/utils";

export type EcomAdaptiveBrandMarkAspect = "1:1" | "3:4" | "4:5" | "16:9" | "9:16";

const ASPECT_CSS: Record<EcomAdaptiveBrandMarkAspect, string> = {
  "1:1": "1 / 1",
  "3:4": "3 / 4",
  "4:5": "4 / 5",
  "16:9": "16 / 9",
  "9:16": "9 / 16",
};

type Props = {
  src?: string | null;
  alt?: string;
  aspect?: EcomAdaptiveBrandMarkAspect;
  /** 列内居中（默认） */
  layout?: "center" | "fill";
  maxWidthPx?: number;
  className?: string;
  children?: ReactNode;
  emptyLabel?: string;
};

/**
 * Logo / 方标 T2logo · 自适应宽度 + object-contain（禁止固定槽 px）
 */
export function EcomAdaptiveBrandMarkFrame({
  src,
  alt = "",
  aspect = "1:1",
  layout = "center",
  maxWidthPx = ECOM_ADAPTIVE_BRAND_MARK_MAX_PX,
  className,
  children,
  emptyLabel,
}: Props) {
  const hasSrc = Boolean(src?.trim());

  return (
    <div
      className={cn(
        layout === "center" && "mx-auto w-full",
        layout === "fill" && "w-full",
        className,
      )}
      style={{ maxWidth: maxWidthPx }}
    >
      <div
        className="relative w-full overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#fafafa]"
        style={{ aspectRatio: ASPECT_CSS[aspect] }}
      >
        {children}
        {!children && hasSrc ? (
          <Image
            src={src!.trim()}
            alt={alt}
            fill
            className="object-contain object-center"
            sizes={`(max-width: 768px) 50vw, ${maxWidthPx}px`}
            unoptimized
          />
        ) : null}
        {!children && !hasSrc && emptyLabel ? (
          <div className="flex h-full min-h-[80px] items-center justify-center px-2 text-center text-xs text-[#86868b]">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}