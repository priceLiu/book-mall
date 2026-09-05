/** 我的 AI 空间 · 收藏目标类型 */

export const AI_SPACE_FAVORITE_TARGET_KINDS = [
  "audio",
  "digital_human",
  "tts_voice",
] as const;

export type AiSpaceFavoriteTargetKind = (typeof AI_SPACE_FAVORITE_TARGET_KINDS)[number];

export function isAiSpaceFavoriteTargetKind(v: unknown): v is AiSpaceFavoriteTargetKind {
  return (
    typeof v === "string" &&
    (AI_SPACE_FAVORITE_TARGET_KINDS as readonly string[]).includes(v)
  );
}

export type AiSpaceTtsVoiceFavoriteMeta = {
  label: string;
  language?: string | null;
  previewUrl?: string | null;
  modelKey?: string | null;
  avatarLetter?: string | null;
};

export type AiSpaceFavoriteDto = {
  id: string;
  targetKind: AiSpaceFavoriteTargetKind;
  targetId: string;
  meta: AiSpaceTtsVoiceFavoriteMeta | null;
  sortOrder: number;
  createdAt: string;
};

export const AI_SPACE_FAVORITE_KIND_LABEL: Record<AiSpaceFavoriteTargetKind, string> = {
  audio: "个人音频",
  digital_human: "数字人形象",
  tts_voice: "TTS 音色",
};
