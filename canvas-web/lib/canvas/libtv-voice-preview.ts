import { isQwen3TtsModelKey } from "@/lib/canvas/qwen3-tts-voice-catalog";

/** MiniMax 系统音色试听 MP3（与 book-mall buildMinimaxVoicePreviewOssKey 一致） */
const MINIMAX_VOICE_PREVIEW_OSS_BASE =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/voices";

export function buildMinimaxVoicePreviewOssUrl(voiceId: string): string | undefined {
  const id = voiceId.trim();
  if (!id) return undefined;
  const safeId = id.replace(/[^a-zA-Z0-9_().-]/g, "_");
  return `${MINIMAX_VOICE_PREVIEW_OSS_BASE}/${safeId}.mp3`;
}

/** MiniMax OSS 样音合成文案（与 book-mall sync-minimax-voice-catalog 一致） */
export const MINIMAX_VOICE_PREVIEW_TEXT_ZH = "你好，这是 MiniMax 语音试听。";
export const MINIMAX_VOICE_PREVIEW_TEXT_EN = "Hello, this is a MiniMax voice preview.";

export function resolveMinimaxVoicePreviewText(language?: string): string {
  const lang = (language ?? "").trim().toLowerCase();
  if (!lang) return MINIMAX_VOICE_PREVIEW_TEXT_ZH;
  if (
    lang.includes("中文") ||
    lang.includes("mandarin") ||
    lang.includes("cantonese")
  ) {
    return MINIMAX_VOICE_PREVIEW_TEXT_ZH;
  }
  if (lang.includes("english") || lang.includes("英语")) {
    return MINIMAX_VOICE_PREVIEW_TEXT_EN;
  }
  return MINIMAX_VOICE_PREVIEW_TEXT_EN;
}

export function resolveQwenTtsPreviewText(params?: Record<string, unknown>): string {
  const lang = String(params?.language_type ?? "Chinese").trim();
  if (lang === "English") return MINIMAX_VOICE_PREVIEW_TEXT_EN;
  return MINIMAX_VOICE_PREVIEW_TEXT_ZH;
}

/** 行内试听文案：优先该音色自己的样音，避免所有行合成同一句 */
export function resolveLibtvRowPreviewText(args: {
  sampleText?: string;
  voiceLanguage?: string;
  modelKey?: string;
  params?: Record<string, unknown>;
}): string {
  const own = args.sampleText?.trim();
  if (own) return own.slice(0, 120);
  if (args.modelKey && isQwen3TtsModelKey(args.modelKey)) {
    return resolveQwenTtsPreviewText(args.params);
  }
  return resolveMinimaxVoicePreviewText(args.voiceLanguage);
}

/** 解析可试听 URL：优先 catalog 返回的 previewUrl；仅 MiniMax 可 OSS 回退 */
export function resolveLibtvVoicePreviewUrl(args: {
  previewUrl?: string | null;
  voiceId?: string;
  /** Qwen 等无 OSS 试听的音色须为 false */
  minimaxOssFallback?: boolean;
}): string | undefined {
  const direct = args.previewUrl?.trim();
  if (direct && (/^https?:\/\//i.test(direct) || direct.startsWith("data:"))) {
    return direct;
  }
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

const LIBTV_VOICE_PREVIEW_STOP_EVENT = "libtv-voice-preview-stop";

type LibtvVoicePreviewStopDetail = { exceptSessionId?: string };

/** 停止所有 LibTV 音色试听（列表 / 参数面板 / 全局 fallback） */
export function stopAllLibtvVoicePreviews(exceptSessionId?: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<LibtvVoicePreviewStopDetail>(LIBTV_VOICE_PREVIEW_STOP_EVENT, {
        detail: { exceptSessionId },
      }),
    );
  }
  if (activePreviewAudio) {
    activePreviewAudio.pause();
    activePreviewAudio.currentTime = 0;
    activePreviewAudio = null;
  }
}

export function subscribeLibtvVoicePreviewStop(
  onStop: (exceptSessionId?: string) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<LibtvVoicePreviewStopDetail>).detail;
    onStop(detail?.exceptSessionId);
  };
  window.addEventListener(LIBTV_VOICE_PREVIEW_STOP_EVENT, handler);
  return () => window.removeEventListener(LIBTV_VOICE_PREVIEW_STOP_EVENT, handler);
}

/** @deprecated 使用 stopAllLibtvVoicePreviews */
export function stopLibtvVoicePreview(): void {
  stopAllLibtvVoicePreviews();
}

/** 播放音色试听；同时只保留一条在播（失败静默，不打开新标签页） */
export function playLibtvVoicePreview(
  previewUrl: string,
  options?: { exceptSessionId?: string },
): HTMLAudioElement | null {
  const url = previewUrl.trim();
  if (!url || typeof window === "undefined") return null;

  stopAllLibtvVoicePreviews(options?.exceptSessionId);

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
  return el;
}

export type QwenTtsLanguageType = "Chinese" | "English";

export { QWEN_TTS_LANGUAGE_OPTIONS } from "@/lib/canvas/qwen3-tts-voice-catalog";

export function qwenTtsLanguageLabel(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (v === "Chinese") return "中文";
  if (v === "English") return "English";
  return "中文";
}
