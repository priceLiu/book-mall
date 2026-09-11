import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";

function collectModelGalleryUrls(refs: WorkflowRefs): Array<{ url: string; label: string }> {
  const items: Array<{ url: string; label: string }> = [];
  const gallery = refs.modelGallery ?? [];
  if (gallery.length > 0) {
    for (const [i, item] of gallery.entries()) {
      const url = item.ossUrl?.trim();
      if (!url) continue;
      items.push({
        url,
        label: item.label?.trim() || (i === 0 ? "模特/穿搭参考" : `穿搭参考 ${i + 1}`),
      });
    }
    return items;
  }
  const modelUrl = refs.model?.ossUrl?.trim();
  if (modelUrl) {
    items.push({
      url: modelUrl,
      label: refs.model?.label?.trim() || "穿搭参考",
    });
  }
  const dressedUrl = refs.dressedImage?.ossUrl?.trim();
  if (dressedUrl && !items.some((x) => x.url === dressedUrl)) {
    items.push({
      url: dressedUrl,
      label: refs.dressedImage?.label?.trim() || "穿搭成片",
    });
  }
  return items;
}

/** 穿搭视频分镜制作表 · @图片N 引用（穿搭参考 → 场景参考） */
export function buildOutfitVideoMentionRefs(refs: WorkflowRefs): EcomPromptImageRef[] {
  const out: EcomPromptImageRef[] = [];
  let index = 1;

  for (const item of collectModelGalleryUrls(refs)) {
    out.push({
      index,
      token: `@图片${index}`,
      kind: index === 1 ? "model" : "product",
      kindIndex: index,
      url: item.url,
      label: item.label,
      role: index === 1 ? "outfit-primary" : "outfit-ref",
    });
    index += 1;
  }

  const sceneUrl = refs.sceneRef?.ossUrl?.trim();
  if (sceneUrl) {
    out.push({
      index,
      token: `@图片${index}`,
      kind: "style",
      kindIndex: 1,
      url: sceneUrl,
      label: refs.sceneRef?.label?.trim() || "场景参考",
      role: "scene",
    });
  }

  return out;
}
