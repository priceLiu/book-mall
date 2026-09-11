import { normalizeOutfitModelGalleryRefs } from "@/lib/ecom/ecom-outfit-model-gallery";
import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

export type OutfitVideoMentionEntry = {
  index: number;
  token: string;
  label: string;
  url: string;
  role: "outfit-primary" | "outfit-ref" | "scene";
};

/** 穿搭视频 · @图片N 目录（模特/穿搭参考优先，场景参考在后） */
export function listOutfitVideoMentionEntries(refs: WorkflowRefs): OutfitVideoMentionEntry[] {
  const normalized = normalizeOutfitModelGalleryRefs(refs);
  const out: OutfitVideoMentionEntry[] = [];
  let index = 1;

  const gallery = normalized.modelGallery ?? [];
  for (const item of gallery) {
    const url = item.ossUrl?.trim();
    if (!url) continue;
    out.push({
      index,
      token: `@图片${index}`,
      label: item.label?.trim() || (index === 1 ? "模特/穿搭参考" : `穿搭参考 ${index}`),
      url,
      role: index === 1 ? "outfit-primary" : "outfit-ref",
    });
    index += 1;
  }

  const sceneUrl = refs.sceneRef?.ossUrl?.trim();
  if (sceneUrl) {
    out.push({
      index,
      token: `@图片${index}`,
      label: refs.sceneRef?.label?.trim() || "场景参考",
      url: sceneUrl,
      role: "scene",
    });
  }

  return out;
}

export function buildOutfitVideoMentionTokenCatalog(refs: WorkflowRefs): string {
  const entries = listOutfitVideoMentionEntries(refs);
  if (entries.length === 0) {
    const preset = refs.sceneLibraryPreset?.visualPromptFragment?.trim();
    if (preset) {
      return `（无带图参考；场景库文字：${preset.slice(0, 120)}${preset.length > 120 ? "…" : ""}）`;
    }
    return "（暂无带图 @ 引用；服装描述须基于 cloth_profile，场景须基于场景库文字或策划文案）";
  }
  return entries.map((e) => `${e.token} = ${e.label}`).join("\n");
}

/** 视频厂商 API 不识别 @图片N；提交前替换为自然语言占位 */
export function stripOutfitVideoMentionTokensForVideoApi(prompt: string): string {
  return prompt
    .replace(/@图片(\d+)/g, "参考图$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
