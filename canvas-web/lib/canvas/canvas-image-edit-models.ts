/**
 * 画布 · Gateway 图像编辑模型（平台代付 · DashScope）
 */
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import {
  buildSbv1ImageEngineParams,
  type Sbv1ImageResolution,
} from "./sbv1-image-models";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import type { CanvasEnginePick } from "./types";

export const CANVAS_IMAGE_EDIT_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wan2.7-image-pro",
] as const;

export type CanvasImageEditModelKey = (typeof CANVAS_IMAGE_EDIT_MODEL_KEYS)[number];

export function isQwenImageEditModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    k === "qwen-image-edit" ||
    k === "qwen-image-edit-max" ||
    k.startsWith("qwen-image-edit")
  );
}

export function isCanvasImageEditModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return isQwenImageEditModelKey(k) || k === "wan2.7-image-pro";
}

export function canvasImageEditRequiresRefs(
  modelKey: string,
  opts?: { imageMode?: string | null },
): boolean {
  const k = modelKey.trim().toLowerCase();
  if (isQwenImageEditModelKey(k)) return true;
  if (k === "wan2.7-image-pro") {
    return opts?.imageMode === "img2img";
  }
  return false;
}

export function canvasImageEditModelLabel(modelKey: string): string {
  const k = modelKey.trim().toLowerCase();
  if (k === "qwen-image-edit") return "千问 · 图像编辑";
  if (k === "qwen-image-edit-max") return "千问 · 图像编辑 Max";
  if (k === "wan2.7-image-pro") return "万相 2.7 Pro · 编辑";
  return modelKey;
}

export function pickCanvasImageEditEngine(
  providers: CanvasProviderDto[],
  preferredModelKey: CanvasImageEditModelKey = "qwen-image-edit",
): CanvasEnginePick | null {
  for (const key of [
    preferredModelKey,
    ...CANVAS_IMAGE_EDIT_MODEL_KEYS.filter((k) => k !== preferredModelKey),
  ]) {
    for (const provider of providers.filter((p) => p.active)) {
      const model = provider.models.find(
        (m) => m.enabled && m.role === "IMAGE" && m.modelKey === key,
      );
      if (model) {
        return {
          providerId: provider.id,
          modelKey: model.modelKey,
          params: buildSbv1ImageEngineParams({ resolution: "2K", outputCount: 1 }),
        };
      }
    }
  }
  return null;
}

export function buildPro2ImageEditNodeData(opts: {
  modelKey: CanvasImageEditModelKey;
  label?: string;
  dockInput?: string;
  resolution?: Sbv1ImageResolution;
}): Record<string, unknown> {
  return buildPro2ImageNodeData({
    label: opts.label ?? canvasImageEditModelLabel(opts.modelKey),
    imageMode: "img2img",
    dockInput:
      opts.dockInput ??
      "根据参考图进行图像编辑：保持主体与构图一致，按指令修改画面细节。",
    engine: {
      providerId: "",
      modelKey: opts.modelKey,
      params: buildSbv1ImageEngineParams({
        resolution: opts.resolution ?? "2K",
        outputCount: 1,
      }),
    },
  });
}

export function isDirectCanvasImageEditMenuId(
  menuId: string,
): menuId is CanvasImageEditModelKey {
  return (CANVAS_IMAGE_EDIT_MODEL_KEYS as readonly string[]).includes(menuId);
}
