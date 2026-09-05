import { isMinimaxSpeechModelKey } from "@/lib/canvas/libtv-qr-audio-models";
import { isQwen3TtsModelKey } from "@/lib/canvas/qwen3-tts-voice-catalog";

/** Dock 音色触发钮最大展示宽度（配合 truncate + title 悬停看全名） */
export const LIBTV_DOCK_VOICE_TRIGGER_MAX_WIDTH_CLASS = "max-w-[8rem]";

export function truncateLibtvDockVoiceLabel(label: string, maxLen = 12): string {
  const text = label.trim();
  if (!text) return "音色";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1))}…`;
}

export function resolveLibtvDockVoiceFullLabel(args: {
  voiceId: string;
  savedLabel?: string;
  catalogLabel?: string;
}): string {
  const saved = args.savedLabel?.trim();
  if (saved) return saved;
  const fromCatalog = args.catalogLabel?.trim();
  if (fromCatalog) return fromCatalog;
  const id = args.voiceId.trim();
  if (!id) return "音色";
  return id.length > 24 ? `${id.slice(0, 22)}…` : id;
}

export type LibtvTtsVoiceKind = "minimax" | "qwen";

const STORAGE_KEYS: Record<LibtvTtsVoiceKind, string> = {
  minimax: "libtv:tts-voice-pref:minimax",
  qwen: "libtv:tts-voice-pref:qwen",
};

export type LibtvTtsVoicePreference = {
  voiceId: string;
  label: string;
};

export function resolveLibtvTtsVoiceKind(
  modelKey: string,
): LibtvTtsVoiceKind | null {
  if (isMinimaxSpeechModelKey(modelKey)) return "minimax";
  if (isQwen3TtsModelKey(modelKey)) return "qwen";
  return null;
}

export function readLibtvTtsVoicePreference(
  kind: LibtvTtsVoiceKind,
): LibtvTtsVoicePreference | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[kind]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LibtvTtsVoicePreference>;
    const voiceId = String(parsed.voiceId ?? "").trim();
    if (!voiceId) return null;
    const label = String(parsed.label ?? "").trim() || voiceId;
    return { voiceId, label };
  } catch {
    return null;
  }
}

export function writeLibtvTtsVoicePreference(
  kind: LibtvTtsVoiceKind,
  pref: LibtvTtsVoicePreference,
): void {
  if (typeof localStorage === "undefined") return;
  const voiceId = pref.voiceId.trim();
  if (!voiceId) return;
  const label = pref.label.trim() || voiceId;
  try {
    localStorage.setItem(
      STORAGE_KEYS[kind],
      JSON.stringify({ voiceId, label } satisfies LibtvTtsVoicePreference),
    );
  } catch {
    /* quota / private mode */
  }
}

export function libtvTtsVoiceParamKey(kind: LibtvTtsVoiceKind): "voice_id" | "voice" {
  return kind === "qwen" ? "voice" : "voice_id";
}

export function applyLibtvTtsVoicePreferenceToParams(
  modelKey: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const kind = resolveLibtvTtsVoiceKind(modelKey);
  if (!kind) return params;
  const paramKey = libtvTtsVoiceParamKey(kind);
  if (String(params[paramKey] ?? "").trim()) return params;
  const pref = readLibtvTtsVoicePreference(kind);
  if (!pref) return params;
  return {
    ...params,
    [paramKey]: pref.voiceId,
    voice_label: pref.label,
  };
}

export function buildLibtvTtsVoiceParamsPatch(args: {
  modelKey: string;
  voiceId: string;
  label: string;
  prevParams?: Record<string, unknown>;
}): Record<string, unknown> {
  const kind = resolveLibtvTtsVoiceKind(args.modelKey);
  const paramKey =
    kind != null ? libtvTtsVoiceParamKey(kind) : ("voice_id" as const);
  const label = args.label.trim() || args.voiceId.trim();
  if (kind) {
    writeLibtvTtsVoicePreference(kind, {
      voiceId: args.voiceId.trim(),
      label,
    });
  }
  return {
    ...(args.prevParams ?? {}),
    [paramKey]: args.voiceId.trim(),
    voice_label: label,
  };
}
