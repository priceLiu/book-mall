"use client";

import type { ImageLayerCanvasToolMode } from "@/lib/image-layer-tool-mode";

export function resolveImageLayerAssistantHeader(
  toolMode: ImageLayerCanvasToolMode,
  hasStack: boolean,
): { title: string; description: string } {
  switch (toolMode) {
    case "retouch":
      return {
        title: "局部重绘",
        description: "画布标记选区 → 选模型与参数 → 填写替换描述 → 生成",
      };
    case "erase":
      return {
        title: "擦除",
        description: "画布标记选区 → 选模型与参数 → 生成（自动补全背景）",
      };
    case "decompose-bbox":
      return {
        title: "图片分层",
        description: "框选拆分区域（无需提示词）→ 顶栏「拆层」",
      };
    case "layer-view":
      if (hasStack) {
        return {
          title: "图片分层",
          description: "点击图层编辑卡片 → 填写描述 → 底部一次提交",
        };
      }
      return {
        title: "图片分层",
        description: "上传图片后可框选拆分，或切换局部重绘 / 擦除",
      };
    default:
      return { title: "图片分层", description: "" };
  }
}

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
