"use client";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { cn } from "@/lib/utils";

type Props = {
  generating: boolean;
  label?: string;
  children: React.ReactNode;
  className?: string;
  /** 生成中保证遮罩有足够高度 */
  minHeightClass?: string;
};

/** 与拆图 ReplicaProductBriefCard / 卖点卡片一致的扫光 + 中央旋转图标 */
export function IpMasterTemplateGeneratingShell({
  generating,
  label = "正在生成结构化模板…",
  children,
  className,
  minHeightClass = "min-h-[12rem]",
}: Props) {
  return (
    <div
      className={cn(
        "relative",
        generating && [
          "ecom-media-generating-sweep rounded-xl border border-[#0071e3]/30 bg-white",
          minHeightClass,
        ],
        className,
      )}
      aria-busy={generating || undefined}
    >
      {children}
      {generating ? <EcomMediaGeneratingBusy label={label} background="light" /> : null}
    </div>
  );
}
