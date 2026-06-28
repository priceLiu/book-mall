import {
  buildSbv1ImageEngineParams,
  pickDefaultSbv1ImageEngine,
} from "./sbv1-image-models";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { Pro2ThreeViewBatchImagePick } from "./pro2-three-view-batch-image";
import type { StoryPro2ThreeViewNodeData } from "./story-pro2-workspace-types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";

/** Pro2 角色三视图 · 与 2.0 图片节点一致的 SBV1 模型白名单 */
export { SBV1_IMAGE_MODEL_KEYS as PRO2_CHARACTER_IMAGE_MODEL_KEYS } from "./sbv1-image-models";

export function pickDefaultPro2CharacterImageEngine(
  providers: CanvasProviderDto[],
): Pro2ThreeViewBatchImagePick | null {
  const pick = pickDefaultSbv1ImageEngine(providers);
  if (!pick) return null;
  return sbv1EngineToBatchImage({
    engine: pick,
    aspectRatio: "16:9",
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
  });
}

export function pro2ThreeViewAsSbv1Settings(
  nodeData: StoryPro2ThreeViewNodeData,
  batchImage?: {
    providerId?: string;
    modelKey?: string;
    params?: Record<string, unknown>;
  } | null,
): Sbv1ImageNodeData {
  const engine =
    nodeData.engine ??
    (batchImage?.providerId?.trim() && batchImage.modelKey?.trim()
      ? {
          providerId: batchImage.providerId,
          modelKey: batchImage.modelKey,
          params: batchImage.params ?? {},
        }
      : undefined);

  return {
    label: nodeData.label,
    dockInput: nodeData.dockInput,
    engine,
    aspectRatio: nodeData.aspectRatio ?? "16:9",
    imageQuality: nodeData.imageQuality ?? "standard",
    resolution: nodeData.resolution ?? "2K",
    outputCount: nodeData.outputCount ?? 1,
  };
}

export function sbv1EngineToBatchImage(
  data: Pick<
    Sbv1ImageNodeData,
    "engine" | "aspectRatio" | "imageQuality" | "resolution" | "outputCount"
  >,
): Pro2ThreeViewBatchImagePick | null {
  const engine = data.engine;
  if (!engine?.providerId?.trim() || !engine.modelKey?.trim()) return null;
  const built = buildSbv1ImageEngineParams({
    aspectRatio: data.aspectRatio,
    imageQuality: data.imageQuality,
    resolution: data.resolution,
    outputCount: data.outputCount,
  });
  return {
    providerId: engine.providerId,
    modelKey: engine.modelKey,
    params: { ...engine.params, ...built },
  };
}

export function sbv1PatchToThreeViewNodeData(
  patch: Partial<Sbv1ImageNodeData>,
): Partial<StoryPro2ThreeViewNodeData> {
  return {
    engine: patch.engine,
    aspectRatio: patch.aspectRatio,
    imageQuality: patch.imageQuality,
    resolution: patch.resolution,
    outputCount: patch.outputCount,
  };
}
