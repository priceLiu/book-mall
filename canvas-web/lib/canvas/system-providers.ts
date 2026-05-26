import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "./builtin-prompt-templates";
import { STORY_LLM_MODEL_KEYS, STORY_VIDEO_MODEL_KEYS } from "./types";

export const SYSTEM_KIE_PROVIDER_ID = "system:kie";
export const SYSTEM_DEEPSEEK_PROVIDER_ID = "system:deepseek";
/** 与 story-web 初始化大纲一致，走 KIE gemini-3-flash 端点 */
export const STORY_LLM_PREFERRED_MODEL_KEY = "google/gemini-3-flash-preview";

const STORY_LLM_ALLOWED = new Set<string>(STORY_LLM_MODEL_KEYS);

function findLlmOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
): { providerId: string; modelKey: string } | null {
  const m = provider.models.find(
    (x) =>
      x.role === "LLM" &&
      x.enabled &&
      x.modelKey === modelKey &&
      STORY_LLM_ALLOWED.has(x.modelKey),
  );
  if (!m) return null;
  return { providerId: provider.id, modelKey: m.modelKey };
}

/** 漫剧 Story LLM 默认：KIE · google/gemini-3-flash-preview（story 大纲同款），其次 gemini-3-flash / DeepSeek。 */
export function pickDefaultStoryLlmEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const active = providers.filter((p) => p.active);

  const kie = active.find((p) => p.id === SYSTEM_KIE_PROVIDER_ID);
  if (kie) {
    const preferred = findLlmOnProvider(kie, STORY_LLM_PREFERRED_MODEL_KEY);
    if (preferred) return preferred;
    const legacy = findLlmOnProvider(kie, "gemini-3-flash");
    if (legacy) return legacy;
  }

  const deepseek = active.find((p) => p.id === SYSTEM_DEEPSEEK_PROVIDER_ID);
  if (deepseek) {
    const v4Flash = findLlmOnProvider(deepseek, "deepseek-v4-flash");
    if (v4Flash) return v4Flash;
    const v4Pro = findLlmOnProvider(deepseek, "deepseek-v4-pro");
    if (v4Pro) return v4Pro;
    const legacy = findLlmOnProvider(deepseek, "deepseek-chat");
    if (legacy) return legacy;
  }

  for (const provider of active) {
    for (const m of provider.models) {
      if (
        m.role === "LLM" &&
        m.enabled &&
        STORY_LLM_ALLOWED.has(m.modelKey)
      ) {
        return { providerId: provider.id, modelKey: m.modelKey };
      }
    }
  }

  return null;
}

const STORY_IMAGE_ALLOWED = new Set<string>(THREE_VIEW_ENGINE_MODEL_KEYS);

function findImageOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
): { providerId: string; modelKey: string } | null {
  const m = provider.models.find(
    (x) =>
      x.role === "IMAGE" &&
      x.enabled &&
      x.modelKey === modelKey &&
      STORY_IMAGE_ALLOWED.has(x.modelKey),
  );
  if (!m) return null;
  return { providerId: provider.id, modelKey: m.modelKey };
}

/** 漫剧分镜图 / 三视图 · 默认 IMAGE 模型（KIE nano-banana-pro 等） */
export function pickDefaultStoryImageEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const active = providers.filter((p) => p.active);

  const kie = active.find((p) => p.id === SYSTEM_KIE_PROVIDER_ID);
  if (kie) {
    for (const key of THREE_VIEW_ENGINE_MODEL_KEYS) {
      const hit = findImageOnProvider(kie, key);
      if (hit) return hit;
    }
  }

  for (const provider of active) {
    for (const m of provider.models) {
      if (
        m.role === "IMAGE" &&
        m.enabled &&
        STORY_IMAGE_ALLOWED.has(m.modelKey)
      ) {
        return { providerId: provider.id, modelKey: m.modelKey };
      }
    }
  }

  return null;
}

const STORY_VIDEO_ALLOWED = new Set<string>(STORY_VIDEO_MODEL_KEYS);

function findVideoOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
): { providerId: string; modelKey: string } | null {
  const m = provider.models.find(
    (x) =>
      x.role === "VIDEO" &&
      x.enabled &&
      x.modelKey === modelKey &&
      STORY_VIDEO_ALLOWED.has(x.modelKey),
  );
  if (!m) return null;
  return { providerId: provider.id, modelKey: m.modelKey };
}

/** 漫剧分镜视频 · 默认 VIDEO 模型（KIE seedance / wan 等） */
export function pickDefaultStoryVideoEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const active = providers.filter((p) => p.active);

  const kie = active.find((p) => p.id === SYSTEM_KIE_PROVIDER_ID);
  if (kie) {
    for (const key of STORY_VIDEO_MODEL_KEYS) {
      const hit = findVideoOnProvider(kie, key);
      if (hit) return hit;
    }
  }

  for (const provider of active) {
    for (const m of provider.models) {
      if (
        m.role === "VIDEO" &&
        m.enabled &&
        STORY_VIDEO_ALLOWED.has(m.modelKey)
      ) {
        return { providerId: provider.id, modelKey: m.modelKey };
      }
    }
  }

  return null;
}
