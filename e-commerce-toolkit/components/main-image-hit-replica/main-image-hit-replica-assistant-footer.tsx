"use client";

import { Cpu, Loader2 } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  refCount: number;
  busy?: boolean;
  busyDone?: number;
  disabled?: boolean;
  visionModels: StoryboardGatewayModel[];
  visionModelKey: string;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onOpenVisionPicker: () => void;
  onOpenImagePicker: () => void;
  onReplicate: () => void;
};

export function MainImageHitReplicaAssistantFooter({
  refCount,
  busy,
  busyDone,
  disabled,
  visionModels,
  visionModelKey,
  imageModels,
  imageModelKey,
  onOpenVisionPicker,
  onOpenImagePicker,
  onReplicate,
}: Props) {
  const visionLabel =
    visionModels.find((m) => m.modelKey === visionModelKey)?.displayName ?? visionModelKey;
  const imageLabel =
    imageModels.find((m) => m.modelKey === imageModelKey)?.displayName ?? imageModelKey;

  const primaryLabel = (() => {
    if (busy) {
      if (typeof busyDone === "number" && refCount > 0) {
        return `复刻进行中（${Math.min(busyDone, refCount)}/${refCount}）…`;
      }
      return "复刻进行中…";
    }
    if (refCount <= 0) return "一键复刻爆款图";
    return `一键复刻爆款图（${refCount}）`;
  })();

  return (
    <div className="space-y-2 border-t border-[var(--ecom-divider)] px-4 py-3">
      <EcomButtonSecondary
        size="sm"
        type="button"
        className="w-full justify-center gap-1.5 text-left"
        disabled={disabled || busy}
        onClick={onOpenVisionPicker}
      >
        <Cpu className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          拆解模型
          <span className="ml-1 font-normal text-[var(--ecom-subtle)]">{visionLabel}</span>
        </span>
      </EcomButtonSecondary>
      <EcomButtonSecondary
        size="sm"
        type="button"
        className="w-full justify-center gap-1.5 text-left"
        disabled={disabled || busy}
        onClick={onOpenImagePicker}
      >
        <Cpu className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          生图模型
          <span className="ml-1 font-normal text-[var(--ecom-subtle)]">{imageLabel}</span>
        </span>
      </EcomButtonSecondary>
      <EcomButtonPrimary
        type="button"
        className={cn("w-full", busy && "pointer-events-none opacity-90")}
        disabled={disabled || busy || refCount <= 0}
        onClick={onReplicate}
      >
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {primaryLabel}
      </EcomButtonPrimary>
      <p className="text-center text-[10px] leading-relaxed text-[var(--ecom-subtle)]">
        拆解模型用于理解参考图并撰写生图 Prompt；每次点击按当前参考图张数生成并追加到底部。
      </p>
    </div>
  );
}