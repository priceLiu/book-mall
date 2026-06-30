export const HAPPYHORSE_R2V_MODEL_KEY = "happyhorse-1-1/reference-to-video";

export function isHappyHorseR2vModel(modelKey: string): boolean {
  return modelKey.trim() === HAPPYHORSE_R2V_MODEL_KEY;
}

export function isKlingMotionControlModel(modelKey: string): boolean {
  const m = modelKey.trim();
  return m === "kling-2.6/motion-control" || m === "kling-3.0/motion-control";
}

/** HappyHorse 参考图：优先 sceneImageUrls，否则回退 targetImageUrl（模板复制） */
export function resolveMotionSyncReferenceImageUrls(args: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  const fromScene = args.sceneImageUrls.map((u) => u.trim()).filter(Boolean);
  if (fromScene.length) return fromScene;
  const target = args.targetImageUrl.trim();
  return target ? [target] : [];
}

/** prompt 内 [Image N] 指代，N 与 reference_image 数组下标 +1 对应；同一序号可重复出现 */
export const HAPPYHORSE_IMAGE_REF_TOKEN_RE = /\[Image\s+(\d+)\]/gi;

export function parseHappyHorsePromptImageIndices(prompt: string): number[] {
  const indices: number[] = [];
  const re = new RegExp(HAPPYHORSE_IMAGE_REF_TOKEN_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const n = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) indices.push(n);
  }
  return indices;
}

export function maxHappyHorsePromptImageIndex(prompt: string): number {
  const indices = parseHappyHorsePromptImageIndices(prompt);
  return indices.length ? Math.max(...indices) : 0;
}

export function formatHappyHorseImageRefToken(index: number): string {
  return `[Image ${index}]`;
}

/** 校验 HappyHorse 运动同步提交；通过返回 null */
export function validateHappyHorseMotionSyncDraft(args: {
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const refs = resolveMotionSyncReferenceImageUrls(args);
  if (!refs.length) return "参考图生视频需要至少一张参考图";
  const prompt = args.prompt.trim();
  if (!prompt) return "参考图生视频需要填写提示词";
  const maxIdx = maxHappyHorsePromptImageIndex(prompt);
  if (maxIdx > refs.length) {
    return `提示词引用了 [Image ${maxIdx}]，但只有 ${refs.length} 张参考图（[Image 1]～[Image ${refs.length}]）`;
  }
  return null;
}

export const HAPPYHORSE_R2V_MAX_REFS = 9;

export const HAPPYHORSE_R2V_RESOLUTIONS = ["720p", "1080p"] as const;

export const HAPPYHORSE_R2V_ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "1:1",
] as const;
