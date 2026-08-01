/**
 * Gateway 注册表内尚未录入 ModelCostProfile 的 81 个 canonical。
 * 价格来源：help.aliyun.com/model-pricing · kie.ai/pricing · 厂商公开价（2026-08）。
 *
 * PER_IMAGE 用于「按次」TTS/音乐（schema 无 PER_CALL）。
 * PER_KTOKEN：listCostYuan = 元/百万 tokens ÷ 1000（取输入价，偏保守）。
 */
export type ModelCostSeedRow = {
  canonicalModelKey: string;
  vendor: string;
  unit: "PER_KTOKEN" | "PER_IMAGE" | "PER_SEC";
  tierRaw?: string;
  listCostYuan: number;
  discountRate: number;
  note?: string;
};

/** 元/百万 tokens → PER_KTOKEN */
export function ktokenFromMillion(yuanPerMillion: number): number {
  return yuanPerMillion / 1000;
}

const ALI = 0.1;
const KIE = 0.05;
const VOLC = 0.08;
const MOON = 0.05;
const TENCENT = 0.1;

/** 与 GATEWAY_CANONICAL_REGISTRY 缺成本档的 81 项一一对应 */
export const MISSING_MODEL_COST_SEEDS: ModelCostSeedRow[] = [
  // —— CORE · TEXT_LLM ——
  { canonicalModelKey: "kimi-k3", vendor: "moonshot", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(20), discountRate: MOON, note: "百炼 kimi/kimi-k3 输入" },
  { canonicalModelKey: "kimi-k2.6", vendor: "moonshot", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(6.5), discountRate: MOON },
  { canonicalModelKey: "kimi-k2.7-code", vendor: "moonshot", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(6.5), discountRate: MOON },
  { canonicalModelKey: "gpt-5-5-chat", vendor: "kie", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(2.8), discountRate: KIE, note: "kie.ai gpt-5.6 档输入约 $0.56/M" },
  { canonicalModelKey: "doubao-seed-2.1-pro", vendor: "volcengine", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(8), discountRate: VOLC },
  { canonicalModelKey: "doubao-seed-2.0", vendor: "volcengine", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(8), discountRate: VOLC },
  { canonicalModelKey: "qwen3-tts", vendor: "aliyun", unit: "PER_IMAGE", listCostYuan: 0.08, discountRate: ALI, note: "0.8元/万字符 · 按次折算" },

  // —— LEGACY · TEXT_LLM（百炼）——
  { canonicalModelKey: "qwen-vl-max", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(1.6), discountRate: ALI },
  { canonicalModelKey: "qwen-vl-plus", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(0.8), discountRate: ALI },
  { canonicalModelKey: "qwen3.7-plus", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(2), discountRate: ALI },
  { canonicalModelKey: "qwen3.5-plus", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(0.8), discountRate: ALI },
  { canonicalModelKey: "qwen3.5-27b", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(0.6), discountRate: ALI },
  { canonicalModelKey: "qwen3.6-plus", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(2), discountRate: ALI },
  { canonicalModelKey: "qwen3.6-flash", vendor: "aliyun", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(1.2), discountRate: ALI },

  // —— LEGACY · TEXT_LLM（KIE Chat）——
  { canonicalModelKey: "claude-opus-4-8", vendor: "kie", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(14), discountRate: KIE, note: "kie $2/M input" },
  { canonicalModelKey: "claude-opus-4-5", vendor: "kie", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(14), discountRate: KIE },
  { canonicalModelKey: "gemini-3-5-flash", vendor: "kie", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(3.24), discountRate: KIE, note: "kie $0.45/M input" },
  { canonicalModelKey: "gemini-3-pro", vendor: "kie", unit: "PER_KTOKEN", listCostYuan: ktokenFromMillion(10), discountRate: KIE },

  // —— LEGACY · TTS / 音乐（按次 → PER_IMAGE）——
  { canonicalModelKey: "kie-suno-api", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.15, discountRate: KIE, note: "Suno 单次生成" },
  { canonicalModelKey: "kie-elevenlabs-v3", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.035, discountRate: KIE },
  { canonicalModelKey: "kie-elevenlabs-tts", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.025, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-2.8-hd", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.022, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-2.8-turbo", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.015, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-2.6-hd", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.02, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-2.6-turbo", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.014, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-02-hd", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.018, discountRate: KIE },
  { canonicalModelKey: "MiniMax/speech-02-turbo", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.012, discountRate: KIE },
  { canonicalModelKey: "MiniMax/music-1.5", vendor: "minimax", unit: "PER_IMAGE", listCostYuan: 0.12, discountRate: KIE },
  { canonicalModelKey: "Eleven/english-sts-v2", vendor: "elevenlabs", unit: "PER_IMAGE", listCostYuan: 0.03, discountRate: KIE },
  { canonicalModelKey: "Eleven/multilingual-sts-v2", vendor: "elevenlabs", unit: "PER_IMAGE", listCostYuan: 0.035, discountRate: KIE },
  { canonicalModelKey: "Eleven/sound-effects-v2", vendor: "elevenlabs", unit: "PER_IMAGE", listCostYuan: 0.02, discountRate: KIE },
  { canonicalModelKey: "Eleven/music-v2", vendor: "elevenlabs", unit: "PER_IMAGE", listCostYuan: 0.1, discountRate: KIE },

  // —— CORE · TEXT_TO_IMAGE ——
  { canonicalModelKey: "aitryon-refiner", vendor: "aliyun", unit: "PER_IMAGE", listCostYuan: 0.3, discountRate: ALI },
  { canonicalModelKey: "doubao-seedream-5-0-pro", vendor: "volcengine", unit: "PER_IMAGE", listCostYuan: 0.35, discountRate: VOLC },
  { canonicalModelKey: "portrait-virtual", vendor: "volcengine", unit: "PER_IMAGE", listCostYuan: 0.05, discountRate: VOLC, note: "Assets API 按次" },
  { canonicalModelKey: "portrait-real", vendor: "volcengine", unit: "PER_IMAGE", listCostYuan: 0.08, discountRate: VOLC },

  // —— LEGACY · TEXT_TO_IMAGE ——
  { canonicalModelKey: "wanx2.1-t2i-plus", vendor: "aliyun", unit: "PER_IMAGE", listCostYuan: 0.2, discountRate: ALI },
  { canonicalModelKey: "wanx2.1-t2i-turbo", vendor: "aliyun", unit: "PER_IMAGE", listCostYuan: 0.14, discountRate: ALI },
  { canonicalModelKey: "flux-2-pro", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.35, discountRate: KIE },
  { canonicalModelKey: "seedream-4.5", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.2, discountRate: KIE },
  { canonicalModelKey: "seedream-5-lite", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.18, discountRate: KIE },
  { canonicalModelKey: "google-nano-banana", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.14, discountRate: KIE },
  { canonicalModelKey: "google-nano-banana-i2i", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.14, discountRate: KIE },
  { canonicalModelKey: "nano-banana-2", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.06, discountRate: KIE },
  { canonicalModelKey: "kie-4o-image", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.14, discountRate: KIE },
  { canonicalModelKey: "qwen-text-to-image", vendor: "kie", unit: "PER_IMAGE", listCostYuan: 0.08, discountRate: KIE },
  { canonicalModelKey: "hunyuan-3d-express", vendor: "tencent", unit: "PER_IMAGE", listCostYuan: 0.3, discountRate: TENCENT },
  { canonicalModelKey: "hy-3d-express", vendor: "tencent", unit: "PER_IMAGE", listCostYuan: 0.3, discountRate: TENCENT },

  // —— CORE · IMAGE_TO_VIDEO（KIE）——
  { canonicalModelKey: "kling-3.0-turbo-i2v", vendor: "kie", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.42, discountRate: KIE, note: "kie ~$0.058/s" },
  { canonicalModelKey: "kling-3.0-turbo-t2v", vendor: "kie", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.42, discountRate: KIE },
  { canonicalModelKey: "kling-ai-avatar-standard", vendor: "kie", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.25, discountRate: KIE },
  { canonicalModelKey: "kling-ai-avatar-pro", vendor: "kie", unit: "PER_SEC", tierRaw: "1080P", listCostYuan: 0.35, discountRate: KIE },

  // —— CORE · VIDEO_TO_VIDEO ——
  { canonicalModelKey: "kling-3.0-motion-control", vendor: "kie", unit: "PER_SEC", tierRaw: "1080p", listCostYuan: 0.85, discountRate: KIE },
  { canonicalModelKey: "kling-2.6-motion-control", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 0.45, discountRate: KIE },

  // —— LEGACY · 百炼视频（华北2 官方 · 元/秒）——
  { canonicalModelKey: "happyhorse-1.0-i2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "happyhorse-1.0-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "happyhorse-1.1-i2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "happyhorse-1.1-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "happyhorse-1.0-video-edit", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "wan2.6-i2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.6-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.6-i2v-flash", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.3, discountRate: ALI, note: "有声 flash" },
  { canonicalModelKey: "wan2.7-i2v-2026-04-25", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.7-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.7-t2v-2026-04-25", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.5-i2v-preview", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "wan2.5-t2v-preview", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.6, discountRate: ALI },
  { canonicalModelKey: "pixverse-c1-it2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "360P", listCostYuan: 0.24, discountRate: ALI },
  { canonicalModelKey: "pixverse-c1-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "360P", listCostYuan: 0.24, discountRate: ALI },
  { canonicalModelKey: "pixverse-v6-it2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "360P", listCostYuan: 0.21, discountRate: ALI },
  { canonicalModelKey: "pixverse-v6-t2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "360P", listCostYuan: 0.21, discountRate: ALI },
  { canonicalModelKey: "happyhorse-1.1-r2v", vendor: "aliyun", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.9, discountRate: ALI },
  { canonicalModelKey: "wan2.6-r2v-flash", vendor: "aliyun", unit: "PER_SEC", tierRaw: "1080P", listCostYuan: 0.25, discountRate: ALI, note: "无声 flash" },

  // —— LEGACY · KIE 视频 ——
  { canonicalModelKey: "kie-seedance-2.0", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 0.125, discountRate: KIE },
  { canonicalModelKey: "veo-2", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 0.72, discountRate: KIE, note: "kie ~$0.10/s" },
  { canonicalModelKey: "veo-3", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 1.05, discountRate: KIE, note: "kie ~$0.15/s" },
  { canonicalModelKey: "veo-3.1", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 1.26, discountRate: KIE },
  { canonicalModelKey: "seedance-2.0-mini", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 0.09, discountRate: KIE },
  { canonicalModelKey: "hailuo-2.3-i2v", vendor: "kie", unit: "PER_SEC", tierRaw: "720p", listCostYuan: 0.29, discountRate: KIE },
  { canonicalModelKey: "kling-2.5-turbo-i2v", vendor: "kie", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.36, discountRate: KIE },

  // —— LEGACY · Topaz ——
  { canonicalModelKey: "topaz-labs/video-enhance", vendor: "topaz", unit: "PER_SEC", tierRaw: "2x", listCostYuan: 0.15, discountRate: KIE },
];
