/** MiniMax 系统音色试听 MP3（与 book-mall buildMinimaxVoicePreviewOssKey 一致） */
const MINIMAX_VOICE_PREVIEW_OSS_BASE =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/voices";

export function buildMinimaxVoicePreviewOssUrl(voiceId: string): string | undefined {
  const id = voiceId.trim();
  if (!id) return undefined;
  const safeId = id.replace(/[^a-zA-Z0-9_().-]/g, "_");
  return `${MINIMAX_VOICE_PREVIEW_OSS_BASE}/${safeId}.mp3`;
}

/** 解析可试听 URL：优先 catalog 返回的 previewUrl；仅 MiniMax 可 OSS 回退 */
export function resolveLibtvVoicePreviewUrl(args: {
  previewUrl?: string | null;
  voiceId?: string;
  /** Qwen 等无 OSS 试听的音色须为 false */
  minimaxOssFallback?: boolean;
}): string | undefined {
  const direct = args.previewUrl?.trim();
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  if (args.minimaxOssFallback && args.voiceId?.trim()) {
    return buildMinimaxVoicePreviewOssUrl(args.voiceId);
  }
  return undefined;
}

/** @deprecated 使用 resolveLibtvVoicePreviewUrl */
export function buildMinimaxVoicePreviewUrl(
  voiceId: string,
  previewUrl?: string | null,
): string | undefined {
  return resolveLibtvVoicePreviewUrl({
    previewUrl,
    voiceId,
    minimaxOssFallback: true,
  });
}

let activePreviewAudio: HTMLAudioElement | null = null;

/** 播放音色试听；同时只保留一条在播（失败静默，不打开新标签页） */
export function playLibtvVoicePreview(previewUrl: string): void {
  const url = previewUrl.trim();
  if (!url || typeof window === "undefined") return;

  if (activePreviewAudio) {
    activePreviewAudio.pause();
    activePreviewAudio = null;
  }

  const el = new Audio(url);
  el.preload = "auto";
  activePreviewAudio = el;
  void el.play().catch(() => {
    if (activePreviewAudio === el) activePreviewAudio = null;
  });
  el.addEventListener(
    "ended",
    () => {
      if (activePreviewAudio === el) activePreviewAudio = null;
    },
    { once: true },
  );
}

export type QwenTtsLanguageType = "Chinese" | "English";

export { QWEN_TTS_LANGUAGE_OPTIONS } from "@/lib/canvas/qwen3-tts-voice-catalog";

export function qwenTtsLanguageLabel(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (v === "Chinese") return "中文";
  if (v === "English") return "English";
  return "中文";
}
