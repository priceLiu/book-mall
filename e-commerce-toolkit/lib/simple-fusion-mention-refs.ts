import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";

import {
  simpleFusionSlotFusionSuccess,
  type SimpleFusionPreviewSlot,
} from "@/lib/simple-fusion-preview-slots";

/** 简易融合短视频 · @模特 / @产品（服装）/ @场景，与顶栏参考图顺序一致 */
export function buildSimpleFusionMentionRefs(
  references: SimpleFusionProject["references"],
): EcomPromptImageRef[] {
  const out: EcomPromptImageRef[] = [];
  let globalIndex = 0;

  const modelUrl = references.model?.ossUrl?.trim();
  if (modelUrl) {
    globalIndex += 1;
    out.push({
      index: globalIndex,
      token: `@模特1`,
      kind: "model",
      kindIndex: 1,
      url: modelUrl,
      label: references.model?.label?.trim() || "模特",
      role: "sfv-model",
    });
  }

  const garments = references.garments ?? [];
  let garmentIdx = 0;
  for (const g of garments) {
    const url = g.ossUrl?.trim();
    if (!url) continue;
    garmentIdx += 1;
    globalIndex += 1;
    out.push({
      index: globalIndex,
      token: `@服装${garmentIdx}`,
      kind: "product",
      kindIndex: garmentIdx,
      url,
      label: g.label?.trim() || `服装${garmentIdx}`,
      role: "sfv-garment",
    });
  }

  const scene = references.scene;
  const sceneUrl = scene?.ossUrl?.trim();
  const sceneText = scene?.scenePrompt?.trim();
  if (sceneUrl || sceneText) {
    globalIndex += 1;
    out.push({
      index: globalIndex,
      token: `@场景1`,
      kind: "style",
      kindIndex: 1,
      url: sceneUrl ?? "",
      label:
        scene?.libraryEntryName?.trim() ||
        (sceneText ? sceneText.slice(0, 24) : "") ||
        "场景",
      role: sceneUrl ? "sfv-scene" : "scene-text",
    });
  }

  return out;
}

/** 图生视频步骤 · 仅引用已成功生成的融合图（@融合1 …） */
export function buildSimpleFusionVideoMentionRefs(
  slots: SimpleFusionPreviewSlot[],
): EcomPromptImageRef[] {
  const success = slots.filter(simpleFusionSlotFusionSuccess);
  return success.map((slot, i) => ({
    index: i + 1,
    token: `@融合${i + 1}`,
    kind: "product" as const,
    kindIndex: i + 1,
    url: slot.fusedImageUrl!,
    label: slot.caption || `融合${i + 1}`,
    role: "sfv-fusion-result",
  }));
}
