/**
 * Dock / 模型选择列表 · 类型标签（替代 modelKey 副行）。
 * 对齐快速复制分类语义：文生图、图生图、图生视频、视频理解…
 */

import {
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
} from "./story-llm-vision-models";
import { getSbv1VideoModelTypeLabels } from "./story-model-capabilities";

export function getGatewayModelTypeLabels(args: {
  modelKey: string;
  role?: string | null;
}): string[] {
  const key = args.modelKey.trim();
  if (!key) return [];
  const role = (args.role ?? "").toUpperCase();
  const k = key.toLowerCase();

  if (isStoryLlmVideoUnderstandingModel(key)) {
    if (k === "qwen3.8-max") {
      return ["文本模型", "图片反推", "视频理解"];
    }
    return ["视频理解", "图片反推"];
  }
  if (isStoryLlmVisionModel(key)) {
    return ["图片反推", "视觉理解"];
  }

  if (
    role === "IMAGE" ||
    /wan2\.\d+-image/.test(k) ||
    k === "kling-3.0-image" ||
    k.includes("seedream") ||
    k.includes("flux") ||
    k.includes("nano-banana") ||
    k.includes("gpt-image") ||
    k.includes("t2i") ||
    (k.includes("image") && !k.includes("video") && !k.includes("i2v"))
  ) {
    const labels: string[] = [];
    const isDedicatedEdit =
      k.includes("image-edit") ||
      k === "google/nano-banana-edit" ||
      (k.includes("nano-banana") && k.includes("-edit")) ||
      k.includes("i2i") ||
      k.includes("img2img");

    if (isDedicatedEdit) {
      labels.push("图片编辑");
    } else {
      labels.push("文生图");
      if (
        k.includes("seedream") ||
        k.includes("edit") ||
        k.includes("kontext") ||
        k.includes("nano-banana") ||
        /wan2\.\d+-image/.test(k) ||
        k === "kling-3.0-image" ||
        k === "wan2.6-image" ||
        k === "qwen-image-3.0-pro"
      ) {
        labels.push("图生图");
      }
    }
    return labels;
  }

  if (
    role === "VIDEO" ||
    k.includes("seedance") ||
    (k.includes("kling") && !k.includes("-image")) ||
    k.includes("veo") ||
    (/wan2\./.test(k) && !/-image/.test(k)) ||
    (/wan3\./.test(k) && !/-image/.test(k)) ||
    k.includes("happyhorse") ||
    k.includes("video")
  ) {
    const video = getSbv1VideoModelTypeLabels(key);
    return video.length > 0 ? video : ["文生视频"];
  }

  if (role === "LLM" || role === "CHAT" || role === "TEXT") {
    return ["文本模型"];
  }

  return [];
}

export function formatGatewayModelTypeLabelLine(args: {
  modelKey: string;
  role?: string | null;
}): string {
  const labels = getGatewayModelTypeLabels(args);
  return labels.length > 0 ? labels.join(" · ") : args.modelKey;
}
