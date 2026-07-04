import {
  MINIMAX_LANGUAGE_BOOST_OPTIONS,
  MINIMAX_VOICE_CLONE_SPEECH_MODELS,
  isMinimaxVoiceCloneSpeechModelKey,
  resolveMinimaxUpstreamSpeechModel,
} from "@/lib/gateway/minimax-speech-models";

export const QR_VOICE_CLONE_PROMPT_MAX_LENGTH = 1000;
export const QR_VOICE_CLONE_TEXT_VALIDATION_MAX_LENGTH = 200;
export const QR_VOICE_EMOTION_MAX_TOTAL = 1.5;

/** UI 标签 → MiniMax T2A emotion 值 */
export const QR_VOICE_EMOTION_DEFS = [
  { id: "happy", label: "Happy" },
  { id: "angry", label: "Angry" },
  { id: "sad", label: "Sad" },
  { id: "fearful", label: "Fear" },
  { id: "disgusted", label: "Hate" },
  { id: "calm", label: "Low" },
  { id: "surprised", label: "Surprise" },
  { id: "neutral", label: "Neutral" },
] as const;

export type QrVoiceEmotionId = (typeof QR_VOICE_EMOTION_DEFS)[number]["id"];

export function getQrVoiceCloneModelDef(modelKey: string) {
  const key = modelKey.trim();
  const hit = MINIMAX_VOICE_CLONE_SPEECH_MODELS.find((m) => m.modelKey === key);
  if (hit) return hit;
  return MINIMAX_VOICE_CLONE_SPEECH_MODELS[0]!;
}

export function validateVoiceCloneDraft(args: {
  modelKey: string;
  referenceAudioUrl?: string;
  sourceAudioUrl?: string;
  prompt: string;
}): string | null {
  const ref = (args.referenceAudioUrl ?? args.sourceAudioUrl ?? "").trim();
  if (!ref) return "请上传待复刻的参考音频";
  if (!isMinimaxVoiceCloneSpeechModelKey(args.modelKey)) {
    return "请选择支持的复刻模型";
  }
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写复刻的文字";
  if (prompt.length > QR_VOICE_CLONE_PROMPT_MAX_LENGTH) {
    return `复刻文字最多 ${QR_VOICE_CLONE_PROMPT_MAX_LENGTH} 字`;
  }
  return null;
}

export function generateQrCloneVoiceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `QrClone_${ts}${rand}`;
}

export function resolveDominantVoiceEmotion(
  weights: Record<string, number> | undefined,
): string | undefined {
  if (!weights) return undefined;
  let bestId: string | undefined;
  let bestVal = 0;
  for (const [id, raw] of Object.entries(weights)) {
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) continue;
    if (id === "neutral") continue;
    if (val > bestVal) {
      bestVal = val;
      bestId = id;
    }
  }
  return bestId;
}

export function normalizeVoiceEmotionWeights(
  input: Record<string, number> | undefined,
): Record<QrVoiceEmotionId, number> {
  const base = Object.fromEntries(
    QR_VOICE_EMOTION_DEFS.map((d) => [d.id, 0]),
  ) as Record<QrVoiceEmotionId, number>;
  if (!input) return base;
  for (const def of QR_VOICE_EMOTION_DEFS) {
    const val = Number(input[def.id] ?? 0);
    base[def.id] = Number.isFinite(val) ? Math.max(0, Math.min(1.5, val)) : 0;
  }
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  if (total <= QR_VOICE_EMOTION_MAX_TOTAL) return base;
  const scale = QR_VOICE_EMOTION_MAX_TOTAL / total;
  for (const def of QR_VOICE_EMOTION_DEFS) {
    base[def.id] = Math.round(base[def.id] * scale * 100) / 100;
  }
  return base;
}

export function listQrVoiceCloneCatalogModels() {
  return MINIMAX_VOICE_CLONE_SPEECH_MODELS.map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    subtitle: m.subtitle,
    upstreamModel: m.upstreamModel,
  }));
}

export function listQrLanguageBoostOptions() {
  return [...MINIMAX_LANGUAGE_BOOST_OPTIONS];
}

export function resolveQrVoiceCloneUpstreamModel(modelKey: string): string {
  return resolveMinimaxUpstreamSpeechModel(modelKey);
}
