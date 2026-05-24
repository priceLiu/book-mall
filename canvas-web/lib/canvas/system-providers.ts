import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { STORY_LLM_MODEL_KEYS } from "./types";

export const SYSTEM_DEEPSEEK_PROVIDER_ID = "system:deepseek";
export const STORY_LLM_DEFAULT_MODEL_KEY = "deepseek-chat";

const STORY_LLM_ALLOWED = new Set<string>(STORY_LLM_MODEL_KEYS);

/** 漫剧 Story LLM 默认引擎：优先系统 DeepSeek，其次其它可用 LLM。 */
export function pickDefaultStoryLlmEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  for (const provider of providers) {
    if (!provider.active) continue;
    if (provider.id !== SYSTEM_DEEPSEEK_PROVIDER_ID) continue;
    const deepseek = provider.models.find(
      (m) =>
        m.role === "LLM" &&
        m.enabled &&
        m.modelKey === STORY_LLM_DEFAULT_MODEL_KEY &&
        STORY_LLM_ALLOWED.has(m.modelKey),
    );
    if (deepseek) {
      return { providerId: provider.id, modelKey: deepseek.modelKey };
    }
  }

  for (const provider of providers) {
    if (!provider.active) continue;
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
