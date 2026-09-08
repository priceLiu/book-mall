import type { CanvasRunNodeInput } from "./canvas-task-service";
import { isLikelyVideoUrl } from "./media-url-kind";

const DOCK_IMAGE_REF_TOKEN_RE = /(?:\[Image\s+\d+\]|图\s*\d+)/i;

/** 与现网正确 nano-banana-pro Gateway 日志一致的参考图脚注（含沈昭昭 4 图 / 四视图 1 图） */
export function appendImageEngineRefFooter(
  prompt: string,
  refCount: number,
): string {
  if (refCount <= 0) return prompt.trim();
  const base = prompt.trim();
  if (base.includes("上游附带") && base.includes("参考图")) return base;
  return `${base}\n\n\n# 上游附带 ${refCount} 张参考图（已作为 image_url 附在本条消息）\n- 第 1 张为产品主体（必保），其余为风格 / 灵感参考。`;
}

/**
 * 生图引擎 prompt 组装（对齐 canvas 现网正确 Gateway 日志）：
 * - 正文绑定由业务 prompt 承担（【资产名】叙事 / 图N 指代等），此处不 prepend 额外 guide
 * - 参考图走 image_input，prompt 末尾附标准脚注
 */
export function expandImageEnginePrompt(
  prompt: string,
  node: CanvasRunNodeInput,
  opts?: { refCount?: number },
): string {
  const segs: string[] = [prompt.trim()].filter(Boolean);
  const txts = (node.textInputs ?? []).filter((s) => s && s.trim());
  if (txts.length > 0) {
    segs.push(
      "\n\n# 用户提供的产品 / 文本输入",
      ...txts.map((t, i) => `${i + 1}. ${t.trim()}`),
    );
  }

  const imgs = (node.imageInputs ?? []).filter(Boolean);
  const videoCount = imgs.filter((u) => isLikelyVideoUrl(String(u))).length;
  const imageCount = opts?.refCount ?? imgs.length - videoCount;
  const merged = segs.join("\n");
  if (imageCount > 0) {
    return appendImageEngineRefFooter(merged, imageCount);
  }

  return merged;
}

/** dock 已含 图N / [Image N] 指代时，跳过上游全文重复 */
export function shouldSkipUpstreamTextForImageRefs(
  dockInput: string,
  hasRefs: boolean,
): boolean {
  return hasRefs && DOCK_IMAGE_REF_TOKEN_RE.test(dockInput);
}
