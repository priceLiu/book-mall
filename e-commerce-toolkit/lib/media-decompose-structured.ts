/** 客户端围栏解析（与 book-mall ecom-media-decompose-structured 一致） */

import type { MediaDecomposePatch } from "@/lib/media-decompose-types";

export function stripMediaDecomposeFence(text: string): string {
  return text
    .replace(/```media-decompose[\s\S]*?```/gi, "")
    .replace(/```media-decompose[\s\S]*$/gi, "")
    .trim();
}

export function extractMediaDecomposePatch(text: string): MediaDecomposePatch | null {
  const closed = text.match(/```media-decompose\s*([\s\S]*?)```/i);
  const body = closed?.[1]?.trim();
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as MediaDecomposePatch;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.mediaType === "video" && Array.isArray(parsed.storyboardTable)) {
      return parsed;
    }
    if (parsed.mediaType === "image" && parsed.positivePrompt) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function toMediaDecomposeDisplayMarkdown(fullText: string, streaming?: boolean): string {
  const patch = extractMediaDecomposePatch(fullText);
  if (patch) {
    return stripMediaDecomposeFence(fullText) || fullText.trim();
  }
  const stripped = stripMediaDecomposeFence(fullText);
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = /```media-decompose[\s\S]*?```/i.test(fullText);
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped || fullText.trim();
  }
  return stripped || fullText.trim();
}
