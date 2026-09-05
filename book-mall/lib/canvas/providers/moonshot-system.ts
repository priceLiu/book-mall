/**
 * Moonshot / Kimi · 系统 Provider 已知模型（OpenAI 兼容 chat/completions）。
 * 见 https://platform.kimi.com/docs/api/overview
 */

import type { CanvasGatewayListedModel } from "./types";

export const MOONSHOT_SYSTEM_BASE_URL = "https://api.moonshot.cn/v1";

/** Moonshot 直连仅保留 legacy v1；Kimi K* 已迁至百炼 BAILIAN 路由 */
export const MOONSHOT_KNOWN_MODELS: CanvasGatewayListedModel[] = [];

/** Story / 漫剧默认 Kimi 模型（经百炼代销） */
export const MOONSHOT_STORY_DEFAULT_MODEL_KEY = "kimi-k3";
