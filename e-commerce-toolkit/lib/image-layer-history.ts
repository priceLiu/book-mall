import type {
  ImageLayerGenerationKind,
  ImageLayerGenerationRef,
  ImageLayerProjectGeneration,
} from "@/lib/image-layer-types";

export function imageLayerGenerationKindLabel(kind: ImageLayerGenerationKind): string {
  switch (kind) {
    case "upload":
      return "上传";
    case "decompose":
      return "图层分离";
    case "edit":
      return "图层编辑";
    case "export":
      return "导出";
    case "bg-replace":
      return "背景与主体";
    case "retouch":
      return "局部重绘";
    default:
      return "处理";
  }
}

export function formatImageLayerGenerationAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resolveImageLayerHistoryPreview(item: ImageLayerProjectGeneration): {
  beforeUrl: string | null;
  afterUrl: string;
  prompt: string;
  refs: ImageLayerGenerationRef[];
} {
  const afterUrl = item.ossUrl.trim();
  const beforeUrl =
    item.compareFromUrl?.trim() ||
    item.workspace?.originalImageUrl?.trim() ||
    null;
  const prompt =
    item.prompt?.trim() ||
    item.workspace?.bgReplace?.refPrompt?.trim() ||
    "";
  const fromEntry = (item.refImages ?? []).filter((row) => row.url.trim());
  const fallback: ImageLayerGenerationRef[] = [];
  const refUrl = item.workspace?.bgReplace?.refImageUrl?.trim();
  if (refUrl && !fromEntry.some((row) => row.url === refUrl)) {
    fallback.push({ url: refUrl, label: "图2参考" });
  }
  return {
    beforeUrl: beforeUrl || null,
    afterUrl,
    prompt,
    refs: [...fromEntry, ...fallback].slice(0, 8),
  };
}
