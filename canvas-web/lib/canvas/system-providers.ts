import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "./builtin-prompt-templates";
import {
  REF_VIDEO_DEFAULT_MODEL_KEY,
  REF_VIDEO_MODEL_KEYS,
  REF_VIDEO_MODEL_META,
  isRefVideoModelKey,
} from "./ref-video-models";
import {
  STORY_LLM_MODEL_KEYS,
  STORY_PRO_VIDEO_MODEL_KEYS,
  STORY_PRO_VIDEO_VOLCENGINE_MODEL_KEYS,
  STORY_TTS_MODEL_KEYS,
} from "./types";
import {
  STORY_LLM_VISION_MODEL_KEYS,
} from "./story-llm-vision-models";

export const SYSTEM_KIE_PROVIDER_ID = "system:kie";
export const SYSTEM_DEEPSEEK_PROVIDER_ID = "system:deepseek";
export const SYSTEM_BAILIAN_R2V_PROVIDER_ID = "system:bailian-r2v";
export const GATEWAY_KIE_PROVIDER_ID = "gateway:kie";
export const GATEWAY_DEEPSEEK_PROVIDER_ID = "gateway:deepseek";
export const GATEWAY_MOONSHOT_PROVIDER_ID = "gateway:moonshot";
export const GATEWAY_BAILIAN_PROVIDER_ID = "gateway:bailian";
export const GATEWAY_HUNYUAN_PROVIDER_ID = "gateway:hunyuan";
export const GATEWAY_VOLCENGINE_PROVIDER_ID = "gateway:volcengine";
/** 分镜视频 1.0 画布专用 Gateway Provider（仅 VIDEO） */
export const GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID = "gateway:sbv1-volcengine";
/** Topaz Labs · 高清视频增强 */
export const GATEWAY_TOPAZ_PROVIDER_ID = "gateway:topaz";
/** 与 story-web 初始化大纲一致，走 KIE gemini-3-flash 端点 */
export const STORY_LLM_PREFERRED_MODEL_KEY = "google/gemini-3-flash-preview";

const DEEPSEEK_BASE_URL_MARK = "deepseek.com";

const STORY_LLM_ALLOWED = new Set<string>(STORY_LLM_MODEL_KEYS);
const STORY_LLM_VISION_ALLOWED = new Set<string>(STORY_LLM_VISION_MODEL_KEYS);

export function isSystemProviderId(id: string): boolean {
  return id.startsWith("system:");
}

export function isGatewayProviderId(id: string): boolean {
  return id.startsWith("gateway:");
}

function activeCanvasProviders(providers: CanvasProviderDto[]): CanvasProviderDto[] {
  return providers.filter(
    (p) =>
      p.active && (isGatewayProviderId(p.id) || !isSystemProviderId(p.id)),
  );
}

function findProviderByKind(
  providers: CanvasProviderDto[],
  kind: CanvasProviderDto["kind"],
): CanvasProviderDto | undefined {
  const active = activeCanvasProviders(providers);
  const gateway = active.find(
    (p) => isGatewayProviderId(p.id) && p.kind === kind,
  );
  if (gateway) return gateway;
  return active.find((p) => p.kind === kind);
}

function findDeepSeekProvider(
  providers: CanvasProviderDto[],
): CanvasProviderDto | undefined {
  const active = activeCanvasProviders(providers);
  const gateway = active.find(
    (p) =>
      isGatewayProviderId(p.id) &&
      p.kind === "OPENAI_COMPAT" &&
      (p.baseUrl?.includes(DEEPSEEK_BASE_URL_MARK) ?? true),
  );
  if (gateway) return gateway;
  return active.find(
    (p) =>
      p.kind === "OPENAI_COMPAT" &&
      (p.baseUrl?.includes(DEEPSEEK_BASE_URL_MARK) ?? false),
  );
}

function findLlmOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
  allowed: Set<string> = STORY_LLM_ALLOWED,
): { providerId: string; modelKey: string } | null {
  const m = provider.models.find(
    (x) =>
      x.role === "LLM" &&
      x.enabled &&
      x.modelKey === modelKey &&
      allowed.has(x.modelKey),
  );
  if (!m) return null;
  return { providerId: provider.id, modelKey: m.modelKey };
}

/** 图片/视频反推 · 多模态 LLM（Doubao Seed 2.0 / Gemini / GPT-5.5） */
export function pickDefaultStoryVisionLlmEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const active = activeCanvasProviders(providers);
  for (const key of STORY_LLM_VISION_MODEL_KEYS) {
    for (const provider of active) {
      const pick = findLlmOnProvider(provider, key, STORY_LLM_VISION_ALLOWED);
      if (pick) return pick;
    }
  }
  return null;
}

/** 漫剧 Story LLM 默认：Gateway KIE · gemini-3-flash-preview，其次 Gateway / 用户 DeepSeek。 */
export function pickDefaultStoryLlmEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const active = activeCanvasProviders(providers);

  const kie = findProviderByKind(providers, "KIE");
  if (kie) {
    const preferred = findLlmOnProvider(kie, STORY_LLM_PREFERRED_MODEL_KEY);
    if (preferred) return preferred;
    const legacy = findLlmOnProvider(kie, "gemini-3-flash");
    if (legacy) return legacy;
  }

  const deepseek = findDeepSeekProvider(providers);
  if (deepseek) {
    const v4Flash = findLlmOnProvider(deepseek, "deepseek-v4-flash");
    if (v4Flash) return v4Flash;
    const v4Pro = findLlmOnProvider(deepseek, "deepseek-v4-pro");
    if (v4Pro) return v4Pro;
    const legacy = findLlmOnProvider(deepseek, "deepseek-chat");
    if (legacy) return legacy;
  }

  for (const provider of activeCanvasProviders(providers)) {
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

/** 漫剧分镜图 / 三视图 · 默认 Gateway / 用户 KIE IMAGE 模型 */
export function pickDefaultStoryImageEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const kie = findProviderByKind(providers, "KIE");
  if (kie) {
    for (const key of THREE_VIEW_ENGINE_MODEL_KEYS) {
      const hit = findImageOnProvider(kie, key);
      if (hit) return hit;
    }
  }

  for (const provider of activeCanvasProviders(providers)) {
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

const STORY_VIDEO_ALLOWED = new Set<string>(STORY_PRO_VIDEO_MODEL_KEYS);

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

/** 漫剧分镜视频 · 默认 Gateway · 火山方舟 Seedance 2.0，其次 KIE */
export function pickDefaultStoryVideoEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const volc = activeCanvasProviders(providers).find(
    (p) => p.id === GATEWAY_VOLCENGINE_PROVIDER_ID,
  );
  if (volc) {
    for (const key of STORY_PRO_VIDEO_VOLCENGINE_MODEL_KEYS) {
      const hit = findVideoOnProvider(volc, key);
      if (hit) return hit;
    }
  }

  const kie = findProviderByKind(providers, "KIE");
  if (kie) {
    for (const key of STORY_PRO_VIDEO_MODEL_KEYS) {
      const hit = findVideoOnProvider(kie, key);
      if (hit) return hit;
    }
  }

  for (const provider of activeCanvasProviders(providers)) {
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

const STORY_TTS_ALLOWED = new Set<string>(STORY_TTS_MODEL_KEYS);

function findTtsOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
): { providerId: string; modelKey: string } | null {
  const m = provider.models.find(
    (x) =>
      x.role === "LLM" &&
      x.enabled &&
      x.modelKey === modelKey &&
      STORY_TTS_ALLOWED.has(x.modelKey),
  );
  if (!m) return null;
  return { providerId: provider.id, modelKey: m.modelKey };
}

/** 漫剧分镜配音 · 默认 Gateway · 百炼 TTS */
export function pickDefaultStoryTtsEngine(
  providers: CanvasProviderDto[],
): { providerId: string; modelKey: string } | null {
  const bailian = findProviderByKind(providers, "ALI_BAILIAN");
  if (bailian) {
    for (const key of STORY_TTS_MODEL_KEYS) {
      const hit = findTtsOnProvider(bailian, key);
      if (hit) return hit;
    }
  }

  for (const provider of activeCanvasProviders(providers)) {
    for (const m of provider.models) {
      if (
        m.role === "LLM" &&
        m.enabled &&
        STORY_TTS_ALLOWED.has(m.modelKey)
      ) {
        return { providerId: provider.id, modelKey: m.modelKey };
      }
    }
  }

  return null;
}

const REF_VIDEO_ALLOWED = new Set<string>(REF_VIDEO_MODEL_KEYS);

function findRefVideoOnProvider(
  provider: CanvasProviderDto,
  modelKey: string,
): {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
} | null {
  const m = provider.models.find(
    (x) =>
      x.role === "VIDEO" &&
      x.enabled &&
      x.modelKey === modelKey &&
      REF_VIDEO_ALLOWED.has(x.modelKey),
  );
  if (!m) return null;
  const defaults = isRefVideoModelKey(modelKey)
    ? REF_VIDEO_MODEL_META[modelKey].defaultParams
    : (m.defaultParams ?? {});
  return {
    providerId: provider.id,
    modelKey: m.modelKey,
    params: defaults,
  };
}

/** 参考生视频 · 默认 Gateway / 用户百炼 HappyHorse R2V，其次 KIE Seedance */
export function pickDefaultRefVideoEngine(
  providers: CanvasProviderDto[],
): {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
} | null {
  const bailian = findProviderByKind(providers, "ALI_BAILIAN");
  if (bailian) {
    const preferred = findRefVideoOnProvider(
      bailian,
      REF_VIDEO_DEFAULT_MODEL_KEY,
    );
    if (preferred) return preferred;
    for (const key of REF_VIDEO_MODEL_KEYS) {
      if (REF_VIDEO_MODEL_META[key].providerKind !== "BAILIAN_R2V") continue;
      const hit = findRefVideoOnProvider(bailian, key);
      if (hit) return hit;
    }
  }

  const kie = findProviderByKind(providers, "KIE");
  if (kie) {
    const seedance = findRefVideoOnProvider(kie, "bytedance/seedance-2");
    if (seedance) return seedance;
  }

  for (const provider of activeCanvasProviders(providers)) {
    for (const key of REF_VIDEO_MODEL_KEYS) {
      const hit = findRefVideoOnProvider(provider, key);
      if (hit) return hit;
    }
  }

  return null;
}
