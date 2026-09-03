/**
 * Gateway 已接入百炼/DashScope 模型 · 华北2 官方挂牌价（docs/price/ali.md @ 2026-08-08）
 * discountRate 统一 0；listCost 为原价（非限时折扣）。
 */
import type { CreditCostUnit } from "@prisma/client";

export type GatewayAliPriceSpec =
  | {
      kind: "token";
      inputYuanPerMillion: number;
      outputYuanPerMillion: number;
      section?: string;
    }
  | {
      kind: "image";
      yuanPerImage: number;
      section?: string;
    }
  | {
      kind: "video";
      yuanPerSecondByTier: Record<string, number>;
      section?: string;
    }
  | {
      kind: "audio";
      yuanPerSecond: number;
      section?: string;
    };

/** modelKey（Gateway 路由）→ 价目；canonical 另表映射 */
export const GATEWAY_ALI_PRICE_BY_MODEL_KEY: Record<string, GatewayAliPriceSpec> = {
  // —— LLM · 千问 ——
  "qwen3.5-flash": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2, section: "千问Flash" },
  "qwen-vl-max": { kind: "token", inputYuanPerMillion: 1.6, outputYuanPerMillion: 4, section: "千问VL" },
  "qwen-vl-plus": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2, section: "千问VL" },
  "qwen3-vl-plus": { kind: "token", inputYuanPerMillion: 1.6, outputYuanPerMillion: 4, section: "千问VL" },
  "qwen3-vl-flash": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2, section: "千问VL" },
  "qwen3.7-plus": { kind: "token", inputYuanPerMillion: 2, outputYuanPerMillion: 8, section: "千问Plus" },
  "qwen3.5-plus": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2, section: "千问Plus" },
  "qwen3.5-27b": { kind: "token", inputYuanPerMillion: 0.6, outputYuanPerMillion: 2, section: "千问Plus" },
  "qwen3.6-plus": { kind: "token", inputYuanPerMillion: 2, outputYuanPerMillion: 8, section: "千问Plus" },
  "qwen3.8-max": { kind: "token", inputYuanPerMillion: 12, outputYuanPerMillion: 36, section: "千问Max" },
  "qwen3-omni-flash": { kind: "token", inputYuanPerMillion: 1.8, outputYuanPerMillion: 15.8, section: "千问Omni" },
  "qwen2.5-vl-72b-instruct": { kind: "token", inputYuanPerMillion: 16, outputYuanPerMillion: 48, section: "千问VL" },
  "ZHIPU/GLM-5.3-Flash": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2.8, section: "智谱GLM" },
  "glm-5.3-flash": { kind: "token", inputYuanPerMillion: 0.8, outputYuanPerMillion: 2.8, section: "智谱GLM" },
  "qwen3.6-flash": { kind: "token", inputYuanPerMillion: 1.2, outputYuanPerMillion: 3.6, section: "千问Flash" },
  // Kimi · 百炼 Kimi-月之暗面
  "kimi/kimi-k3": { kind: "token", inputYuanPerMillion: 20, outputYuanPerMillion: 100, section: "Kimi-月之暗面" },
  "kimi-k3": { kind: "token", inputYuanPerMillion: 20, outputYuanPerMillion: 100, section: "Kimi-月之暗面" },
  "kimi/kimi-k2.6": { kind: "token", inputYuanPerMillion: 6.5, outputYuanPerMillion: 27, section: "Kimi-月之暗面" },
  "kimi-k2.6": { kind: "token", inputYuanPerMillion: 6.5, outputYuanPerMillion: 27, section: "Kimi-月之暗面" },
  "kimi/kimi-k2.7-code": { kind: "token", inputYuanPerMillion: 6.5, outputYuanPerMillion: 27, section: "Kimi-月之暗面" },
  "kimi-k2.7-code": { kind: "token", inputYuanPerMillion: 6.5, outputYuanPerMillion: 27, section: "Kimi-月之暗面" },

  // —— 生图 ——
  "wan2.7-image": { kind: "image", yuanPerImage: 0.2, section: "万相图像生成" },
  "wan2.7-image-pro": { kind: "image", yuanPerImage: 0.5, section: "万相图像生成" },
  "wan2.6-image": { kind: "image", yuanPerImage: 0.2, section: "万相图像编辑" },
  "kling-3.0-image": { kind: "image", yuanPerImage: 0.2, section: "图像生成-第三方" },
  "kling-3.0/video": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 0.8 }, section: "可灵-视频生成" },
  "kling/kling-v3-video-generation": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 0.8 }, section: "可灵-视频生成" },
  "kling/kling-v3-omni-video-generation": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 0.8 }, section: "可灵-视频生成" },
  "qwen-image-3.0-pro": { kind: "image", yuanPerImage: 0.5, section: "千问图像生成" },
  "z-image-turbo": { kind: "image", yuanPerImage: 0.1, section: "千问图像生成" },
  "qwen-image-edit": { kind: "image", yuanPerImage: 0.2, section: "千问图像编辑" },
  "qwen-image-edit-max": { kind: "image", yuanPerImage: 0.5, section: "千问图像编辑" },
  "image-out-painting": { kind: "image", yuanPerImage: 0.2, section: "图像画面扩展" },
  "wanx-x-painting": { kind: "image", yuanPerImage: 0.2, section: "万相涂鸦作画" },
  "wan2.5-i2i-preview": { kind: "image", yuanPerImage: 0.2, section: "万相通用图像编辑" },
  "wanx2.1-t2i-plus": { kind: "image", yuanPerImage: 0.2, section: "万相文生图" },
  "wanx2.1-t2i-turbo": { kind: "image", yuanPerImage: 0.14, section: "万相文生图" },

  // —— 试衣 ——
  aitryon: { kind: "image", yuanPerImage: 0.2, section: "AI试衣" },
  "aitryon-plus": { kind: "image", yuanPerImage: 0.5, section: "AI试衣" },
  "aitryon-parsing-v1": { kind: "image", yuanPerImage: 0.004, section: "AI试衣" },
  "aitryon-refiner": { kind: "image", yuanPerImage: 0.3, section: "AI试衣" },

  // —— HappyHorse 视频（原价）——
  "happyhorse-1.0-t2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.9, "1080P": 1.6 }, section: "HappyHorse-T2V" },
  "happyhorse-1.0-i2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.9, "1080P": 1.6 }, section: "HappyHorse-I2V" },
  "happyhorse-1.0-r2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.9, "1080P": 1.6 }, section: "HappyHorse-R2V" },
  "happyhorse-1.1-t2v": { kind: "video", yuanPerSecondByTier: { "480P": 0.45, "720P": 0.9, "1080P": 1.2 }, section: "HappyHorse-T2V" },
  "happyhorse-1.1-i2v": { kind: "video", yuanPerSecondByTier: { "480P": 0.45, "720P": 0.9, "1080P": 1.2 }, section: "HappyHorse-I2V" },
  "happyhorse-1.1-r2v": { kind: "video", yuanPerSecondByTier: { "480P": 0.45, "720P": 0.9, "1080P": 1.2 }, section: "HappyHorse-R2V" },
  "happyhorse-1.0-video-edit": { kind: "video", yuanPerSecondByTier: { "720P": 0.9, "1080P": 1.6 }, section: "HappyHorse-视频编辑" },

  // —— 万相 2.x 视频 ——
  "wan2.7-t2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-文生视频" },
  "wan2.7-t2v-2026-04-25": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-文生视频" },
  "wan2.7-i2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-图生视频" },
  "wan2.7-i2v-2026-04-25": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-图生视频" },
  "wan2.7-r2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-参考生视频" },
  "wan2.6-t2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-文生视频" },
  "wan2.6-i2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-图生视频" },
  "wan2.6-r2v": { kind: "video", yuanPerSecondByTier: { "720P": 0.6, "1080P": 1.0 }, section: "万相-参考生视频" },
  "wan2.6-i2v-flash": { kind: "video", yuanPerSecondByTier: { "720P": 0.15, "1080P": 0.25 }, section: "万相-图生视频" },
  "wan2.6-r2v-flash": { kind: "video", yuanPerSecondByTier: { "1080P": 0.25 }, section: "万相-参考生视频" },
  "wan2.5-t2v-preview": { kind: "video", yuanPerSecondByTier: { "480P": 0.3, "720P": 0.6, "1080P": 1.0 }, section: "万相-文生视频" },
  "wan2.5-i2v-preview": { kind: "video", yuanPerSecondByTier: { "480P": 0.3, "720P": 0.6, "1080P": 1.0 }, section: "万相-图生视频" },

  // —— 万相 3.0 ——
  "wan3.0-video": { kind: "video", yuanPerSecondByTier: { "480P": 0.3, "720P": 0.6, "1080P": 1.2 }, section: "万相3.0-视频生成" },
  "wan3.0-video-prime": { kind: "video", yuanPerSecondByTier: { "480P": 0.45, "720P": 0.9, "1080P": 1.8 }, section: "万相3.0-视频生成" },

  // —— 万相 2.2 数字人 ——
  "wan2.2-s2v": { kind: "video", yuanPerSecondByTier: { "480P": 0.5, "720P": 0.9 }, section: "万相-数字人" },
  "wan2.2-s2v-detect": { kind: "image", yuanPerImage: 0.004, section: "万相-数字人" },

  // —— CosyVoice TTS（元/万字符 · PER_IMAGE 槽折算）——
  "cosyvoice-v3-flash": { kind: "image", yuanPerImage: 1, section: "CosyVoice" },
  "cosyvoice-v3-plus": { kind: "image", yuanPerImage: 2, section: "CosyVoice" },

  // —— Pixverse ——
  "pixverse-c1-t2v": { kind: "video", yuanPerSecondByTier: { "360P": 0.24 }, section: "视频生成-第三方" },
  "pixverse-c1-it2v": { kind: "video", yuanPerSecondByTier: { "360P": 0.24 }, section: "视频生成-第三方" },
  "pixverse-v6-t2v": { kind: "video", yuanPerSecondByTier: { "360P": 0.21 }, section: "视频生成-第三方" },
  "pixverse-v6-it2v": { kind: "video", yuanPerSecondByTier: { "360P": 0.21 }, section: "视频生成-第三方" },

  // —— TTS（按次折算 PER_IMAGE 槽）——
  "qwen3-tts-flash": { kind: "image", yuanPerImage: 0.08, section: "Qwen-TTS" },
  "qwen3-tts": { kind: "image", yuanPerImage: 0.08, section: "Qwen-TTS" },

  // —— ASR ——
  "qwen3-asr-flash-filetrans": { kind: "audio", yuanPerSecond: 0.00022, section: "千问ASR" },
  "qwen3-asr-flash": { kind: "audio", yuanPerSecond: 0.00022, section: "千问ASR" },
};

export function ktokenFromMillion(yuanPerMillion: number): number {
  return yuanPerMillion / 1000;
}

export function unitForAliSpec(spec: GatewayAliPriceSpec): CreditCostUnit {
  switch (spec.kind) {
    case "token":
      return "PER_KTOKEN";
    case "video":
    case "audio":
      return "PER_SEC";
    case "image":
      return "PER_IMAGE";
  }
}
