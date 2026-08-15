/**
 * 我的 AI 空间 · 音频库 TTS 可选模型与音色
 *
 * 模型真源仍是 Gateway 注册表（ModelCatalog + GatewayModelRoute）；
 * 本文件只描述「界面可选项 + 默认音色」，不承担路由职责。
 */

export type AiSpaceTtsModelDef = {
  modelKey: string;
  label: string;
  description: string;
  voices: Array<{ id: string; label: string }>;
};

export const AI_SPACE_TTS_MODELS: AiSpaceTtsModelDef[] = [
  {
    modelKey: "cosyvoice-v3-flash",
    label: "CosyVoice v3 Flash",
    description: "百炼非实时合成，音色丰富、速度快，适合口播台词",
    voices: [
      { id: "longanyang", label: "龙安洋 · 沉稳男声" },
      { id: "longxiaochun_v2", label: "龙小淳 · 亲和女声" },
      { id: "longanrou", label: "龙安柔 · 温柔女声" },
      { id: "longanxuan", label: "龙安宣 · 播报男声" },
    ],
  },
  {
    modelKey: "qwen3-tts",
    label: "Qwen3 TTS",
    description: "通义千问语音合成，中英自适应",
    voices: [
      { id: "Cherry", label: "Cherry · 明亮女声" },
      { id: "Serena", label: "Serena · 温柔女声" },
      { id: "Ryan", label: "Ryan · 磁性男声" },
    ],
  },
];

export const AI_SPACE_TTS_DEFAULT_MODEL_KEY = "cosyvoice-v3-flash";

export function getAiSpaceTtsModelDef(modelKey: string): AiSpaceTtsModelDef {
  const key = modelKey.trim();
  return (
    AI_SPACE_TTS_MODELS.find((m) => m.modelKey === key) ??
    AI_SPACE_TTS_MODELS[0]
  );
}

export function isAiSpaceTtsModelKey(modelKey: unknown): boolean {
  return (
    typeof modelKey === "string" &&
    AI_SPACE_TTS_MODELS.some((m) => m.modelKey === modelKey.trim())
  );
}

/** 音频库 TTS 单次台词上限（字符） */
export const AI_SPACE_TTS_TEXT_MAX = 2000;
