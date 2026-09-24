"use client";

import { resolveImageLayerAssistantHeader } from "@/lib/image-layer-assistant-header";
import type { ImageLayerCanvasToolMode } from "@/lib/image-layer-tool-mode";

export { resolveImageLayerAssistantHeader } from "@/lib/image-layer-assistant-header";

export function ImageLayerAssistantHeader({
  toolMode,
  hasStack,
}: {
  toolMode: ImageLayerCanvasToolMode;
  hasStack: boolean;
}) {
  const { title, description } = resolveImageLayerAssistantHeader(toolMode, hasStack);
  return (
    <>
      <h1 className="text-base font-semibold text-[#111827]">{title}</h1>
      <p className="mt-0.5 text-xs text-[#6b7280]">{description}</p>
    </>
  );
}
