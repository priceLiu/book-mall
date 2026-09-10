"use client";

import { Loader2, Sparkles } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { SceneShot } from "@/lib/video-workflow/shot-spine";

type Props = {
  shot: SceneShot;
  clothReady?: boolean;
  adapting?: boolean;
  disabled?: boolean;
  onAdapt: (index: number) => Promise<void>;
};

function adaptStatusLabel(shot: SceneShot): { label: string; className: string } {
  const adapt = shot.outfitStoryboardAdapt;
  if (adapt?.status === "generating") {
    return { label: "适配中", className: "text-[#0071e3]" };
  }
  if (adapt?.status === "success") {
    return { label: "已适配", className: "text-[#34c759]" };
  }
  if (adapt?.status === "failed") {
    return { label: "失败", className: "text-[#ff3b30]" };
  }
  return { label: "未适配", className: "text-[#86868b]" };
}

export function OutfitShotStoryboardAdaptCell({
  shot,
  clothReady,
  adapting,
  disabled,
  onAdapt,
}: Props) {
  const status = adaptStatusLabel(shot);
  const adapt = shot.outfitStoryboardAdapt;
  const busy = adapting || adapt?.status === "generating";
  const canAdapt = Boolean(clothReady) && !disabled && !busy;

  return (
    <div className="flex min-w-[7.5rem] flex-col gap-1.5">
      <EcomButtonSecondary
        type="button"
        size="sm"
        className="h-7 px-2 text-[11px]"
        disabled={!canAdapt}
        onClick={() => void onAdapt(shot.index)}
      >
        {busy ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="mr-1 h-3 w-3" />
        )}
        {adapt?.status === "success" || adapt?.status === "failed" ? "重试适配" : "适配此镜"}
      </EcomButtonSecondary>
      <span className={`text-[10px] ${status.className}`}>{status.label}</span>
      {adapt?.status === "failed" && adapt.failReason ? (
        <p className="text-[10px] leading-snug text-[#ff3b30]">{adapt.failReason}</p>
      ) : null}
      {adapt?.status === "success" && adapt.adjustLogic ? (
        <p className="line-clamp-3 text-[10px] leading-snug text-[#6e6e73]" title={adapt.adjustLogic}>
          {adapt.adjustLogic}
        </p>
      ) : null}
    </div>
  );
}
