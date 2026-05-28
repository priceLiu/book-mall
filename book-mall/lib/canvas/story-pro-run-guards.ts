import { assertStoryModelCapabilities, modelHasStoryCapabilities } from "./story-model-capabilities";
import { resolveStoryRowRefUrls } from "./story-row-ref-urls";

function batchModelKey(
  data: Record<string, unknown>,
  field: "batchImage" | "batchVideo" | "batchTts",
): string {
  const batch = (data[field] as { modelKey?: string } | undefined) ?? {};
  return String(batch.modelKey ?? "").trim();
}

function pickRow(
  data: Record<string, unknown>,
  rowKey: string | undefined,
): Record<string, unknown> | undefined {
  if (!rowKey) return undefined;
  const rows = (data.rows as Record<string, unknown>[] | undefined) ?? [];
  return rows.find((r) => String(r.key ?? "") === rowKey);
}

/** 影视专业版 run 前 · 模型能力校验 */
export function assertStoryProRunModelCapabilities(args: {
  nodeType: string;
  mediaKind?: string;
  nodeData: Record<string, unknown>;
  rowKey?: string;
}): void {
  const { nodeType, mediaKind, nodeData, rowKey } = args;

  if (nodeType === "story-pro-frame" && mediaKind === "frameImage") {
    const modelKey = batchModelKey(nodeData, "batchImage");
    const row = pickRow(nodeData, rowKey);
    let refCount = row ? resolveStoryRowRefUrls(row).length : 0;
    if (nodeData.injectStyleRefs === true && Array.isArray(nodeData.styleRefImageUrls)) {
      refCount += nodeData.styleRefImageUrls.filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
      ).length;
    }
    assertStoryModelCapabilities(
      modelKey,
      refCount > 0 ? ["image_multi_ref"] : ["image_t2i"],
      "分镜静帧",
    );
    return;
  }

  if (nodeType === "story-pro-video" && mediaKind === "video") {
    const modelKey = batchModelKey(nodeData, "batchVideo");
    if (
      modelHasStoryCapabilities(modelKey, ["video_i2v"]) ||
      modelHasStoryCapabilities(modelKey, ["video_r2v"])
    ) {
      return;
    }
    assertStoryModelCapabilities(modelKey, ["video_i2v"], "分镜视频");
    return;
  }

  if (nodeType === "story-pro-character" && mediaKind === "threeView") {
    const row = pickRow(nodeData, rowKey);
    const locked = (row?.lockedRefIds as string[] | undefined) ?? [];
    assertStoryModelCapabilities(
      batchModelKey(nodeData, "batchImage"),
      locked.length ? ["image_multi_ref"] : ["image_t2i"],
      "角色三视图",
    );
    return;
  }

  if (nodeType === "story-pro-scene" && mediaKind === "sceneRef") {
    assertStoryModelCapabilities(
      batchModelKey(nodeData, "batchImage"),
      ["image_t2i"],
      "场景参考",
    );
  }
}
