"use client";

import { Eraser, Layers, Loader2, Paintbrush } from "lucide-react";

import { EcomGenerateCreditsBeside } from "@/components/billing/ecom-generate-credits-beside";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { IMAGE_LAYER_ERASE_MODEL_KEY } from "@/lib/image-layer-local-edit-constants";
import type { ImageLayerCanvasToolMode } from "@/lib/image-layer-tool-mode";

export function ImageLayerAssistantFooter({
  toolMode,
  busy,
  retouchBusy,
  eraseBusy,
  retouchPrompt,
  retouchModelKey,
  onRetouchSubmit,
  onEraseSubmit,
}: {
  toolMode: ImageLayerCanvasToolMode;
  busy: boolean;
  retouchBusy: boolean;
  eraseBusy: boolean;
  retouchPrompt: string;
  retouchModelKey?: string;
  onRetouchSubmit: () => void;
  onEraseSubmit: () => void;
}) {
  const creditsModel =
    toolMode === "erase" ? IMAGE_LAYER_ERASE_MODEL_KEY : retouchModelKey;
  if (toolMode === "retouch" || toolMode === "erase") {
    const button =
      toolMode === "retouch" ? (
      <EcomButtonPrimary
        type="button"
        fullWidth
        className="!max-w-none"
        disabled={busy || retouchBusy || !retouchPrompt.trim()}
        onClick={onRetouchSubmit}
      >
          {retouchBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Paintbrush className="mr-1.5 h-4 w-4" />
          )}
        开始重绘
      </EcomButtonPrimary>
      ) : (
      <EcomButtonPrimary
        type="button"
        fullWidth
        className="!max-w-none"
        disabled={busy || eraseBusy}
        onClick={onEraseSubmit}
      >
          {eraseBusy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Eraser className="mr-1.5 h-4 w-4" />
          )}
        开始擦除补全
      </EcomButtonPrimary>
      );
    return (
      <div className="flex items-center gap-3">
        <EcomGenerateCreditsBeside modelKey={creditsModel} imageCount={1} />
        <div className="min-w-0 flex-1">{button}</div>
      </div>
    );
  }

  if (toolMode === "decompose-bbox") {
    return (
      <div className="border-t border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs text-[#6b7280]">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          框选完成后，点击顶栏拆层按钮
        </p>
      </div>
    );
  }

  return null;
}
