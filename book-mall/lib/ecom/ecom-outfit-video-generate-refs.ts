import { bailianR2vMaxRefs } from "@/lib/canvas/bailian-r2v-body";

/** 百炼 R2V · 穿搭逐镜：身份参考前置，旧视频 preview/片段关键帧仅作运镜辅助置后 */
export function buildOutfitBailianR2vReferenceUrlOrder(opts: {
  modelImageUrl: string;
  clothingImageUrl: string;
  previewImageUrl?: string;
  clipKeyframeUrls?: readonly string[];
  maxRefs?: number;
}): string[] {
  const max = opts.maxRefs ?? 9;
  const urls: string[] = [];
  const push = (raw?: string) => {
    const url = raw?.trim();
    if (!url || urls.includes(url) || urls.length >= max) return;
    urls.push(url);
  };

  push(opts.modelImageUrl);
  const clothing = opts.clothingImageUrl.trim();
  const model = opts.modelImageUrl.trim();
  if (clothing && clothing !== model) {
    push(clothing);
  }
  push(opts.previewImageUrl);
  for (const frame of opts.clipKeyframeUrls ?? []) {
    push(frame);
  }
  return urls;
}

export const OUTFIT_BAILIAN_R2V_IDENTITY_PROMPT_PREFIX_ZH =
  "人物五官、发型、身形以参考图1为准，全片同一人，禁止换脸；";

/** 提交百炼 R2V 前补强身份锁（与 referenceImageUrls[0]=模特/融图 对齐） */
export function enrichOutfitBailianR2vGeneratePrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return OUTFIT_BAILIAN_R2V_IDENTITY_PROMPT_PREFIX_ZH.slice(0, -1);
  if (/参考图1/.test(trimmed) && /同一人|禁止换脸|五官/.test(trimmed)) {
    return trimmed;
  }
  return `${OUTFIT_BAILIAN_R2V_IDENTITY_PROMPT_PREFIX_ZH}${trimmed}`;
}

export function outfitBailianR2vMaxRefs(modelKey: string): number {
  return bailianR2vMaxRefs(modelKey);
}
