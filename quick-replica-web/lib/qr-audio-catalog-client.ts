"use client";

import { useEffect, useState } from "react";

import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

export type QrAudioCatalogModel = {
  modelKey: string;
  label: string;
  subtitle: string;
  provider: string;
};

export type QrAudioCatalogVoice = {
  voiceId: string;
  label: string;
  subtitle: string;
  gender: "female" | "male" | "neutral";
  accent?: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
};

export type QrVoiceCatalogItem = {
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
};

export type QrAudioCatalogStyleTag = {
  id: string;
  label: string;
  labelEn?: string;
  content?: string;
};

export type QrAudioPromptTemplateDef = {
  id: string;
  name: string;
  content: string;
};

export type QrAudioCatalog = {
  models: QrAudioCatalogModel[];
  voiceChangerModels?: QrAudioCatalogModel[];
  sfxModels?: QrAudioCatalogModel[];
  voiceCloneModels?: QrAudioCatalogModel[];
  languageBoostOptions?: string[];
  voices: QrAudioCatalogVoice[];
  styleTags: QrAudioCatalogStyleTag[];
  sfxStyleTags?: QrAudioCatalogStyleTag[];
  musicStyleTags?: QrAudioCatalogStyleTag[];
  promptTemplates?: {
    "create-voiceover": QrAudioPromptTemplateDef[];
    "voice-changer": QrAudioPromptTemplateDef[];
    "create-sfx"?: QrAudioPromptTemplateDef[];
    "create-music"?: QrAudioPromptTemplateDef[];
  };
  voicesPaged?: boolean;
  elevenVoicesLive?: boolean;
  defaults: {
    modelKey: string;
    voiceChangerModelKey?: string;
    sfxModelKey?: string;
    musicModelKey?: string;
    voiceId: string;
    elevenVoiceId?: string;
    styleTag: string;
    voiceSpeed: number;
    voiceVolume: number;
    voicePitch: number;
    voiceTone: number;
    voiceIntensity: number;
    voiceTimbre: number;
    voiceStability: number;
    voiceSimilarityBoost: number;
    voiceStyleExaggeration: number;
    sfxLoop?: boolean;
    sfxDurationAuto?: boolean;
    sfxDurationSeconds?: number;
    sfxPromptInfluence?: number;
    musicClipMode?: "quick" | "full";
    musicInstrumental?: boolean;
    musicDurationAuto?: boolean;
    musicDurationSeconds?: number;
    musicBpmAuto?: boolean;
    musicBpm?: number;
    musicIntensityAuto?: boolean;
    musicIntensity?: string;
    musicKeyAuto?: boolean;
    musicKey?: string;
    languageBoost?: string;
  };
};

let cachedCatalog: QrAudioCatalog | null = null;
let inflight: Promise<QrAudioCatalog> | null = null;

export function invalidateQrAudioCatalogClientCache(): void {
  cachedCatalog = null;
  inflight = null;
}

function normalizeClientFetchError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "连接超时，请稍后重试";
  }
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (
      msg === "signal is aborted without reason" ||
      msg === "The user aborted a request." ||
      msg.toLowerCase().includes("aborted")
    ) {
      return "连接超时，请稍后重试";
    }
    return msg || "加载失败";
  }
  return "加载失败";
}

async function fetchAudioCatalogResponse(force = false): Promise<Response> {
  return fetch("/api/audio-catalog", {
    cache: force ? "no-store" : "default",
    credentials: "same-origin",
  });
}

export async function fetchQrAudioCatalog(force = false): Promise<QrAudioCatalog> {
  if (inflight) return inflight;
  if (!force && cachedCatalog) return cachedCatalog;
  if (force) cachedCatalog = null;

  inflight = fetchAudioCatalogResponse(force)
    .then(async (res) => {
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          data?.error === "audio_catalog_timeout"
            ? "连接主站超时，请稍后重试"
            : `加载声音目录失败（${res.status}）`,
        );
      }
      const data = (await res.json()) as QrAudioCatalog;
      cachedCatalog = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useQrAudioCatalog() {
  const [catalog, setCatalog] = useState<QrAudioCatalog | null>(cachedCatalog);
  const [loading, setLoading] = useState(!cachedCatalog);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const retry = () => {
    invalidateQrAudioCatalogClientCache();
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const load = (force: boolean) => {
      if (cancelled) return;
      if (!cachedCatalog) setLoading(true);
      setError(null);
      void fetchQrAudioCatalog(force)
        .then((data) => {
          if (!cancelled) {
            setCatalog(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(normalizeClientFetchError(err));
            if (cachedCatalog) setCatalog(cachedCatalog);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    if (cachedCatalog) {
      setCatalog(cachedCatalog);
      setLoading(false);
      setError(null);
    } else {
      load(retryKey > 0);
    }

    const onInvalidate = () => load(true);
    window.addEventListener("qr-audio-catalog-invalidate", onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("qr-audio-catalog-invalidate", onInvalidate);
    };
  }, [retryKey]);

  return { catalog, loading, error, retry };
}

export function filterCatalogSeedVoices(
  catalog: QrAudioCatalog,
  provider: "minimax" | "elevenlabs",
): QrVoiceCatalogItem[] {
  const items = catalog.voices.map((v) => ({
    voiceId: v.voiceId,
    label: v.label,
    subtitle: v.subtitle,
    language: v.language,
    previewUrl: v.previewUrl,
    tags: v.tags,
    avatarLetter: v.avatarLetter,
  }));
  if (provider === "elevenlabs") {
    return items.filter((v) => v.tags?.includes("elevenlabs"));
  }
  return items.filter((v) => !v.tags?.includes("elevenlabs"));
}

export async function fetchQrVoicePage(
  page: number,
  pageSize = 40,
  provider: "minimax" | "elevenlabs" = "minimax",
): Promise<{
  items: QrVoiceCatalogItem[];
  total: number;
  hasMore: boolean;
}> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (provider === "elevenlabs") qs.set("provider", "elevenlabs");

  const res = await fetch(`/api/voices?${qs.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    const detail = data?.error?.trim();
    throw new Error(
      data?.error === "voices_timeout"
        ? "连接主站超时，请稍后重试"
        : detail || `加载音色失败（${res.status}）`,
    );
  }
  return (await res.json()) as {
    items: QrVoiceCatalogItem[];
    total: number;
    hasMore: boolean;
    warning?: string;
    live?: boolean;
  };
}

export function getQrAudioModelFromCatalog(catalog: QrAudioCatalog, modelKey: string) {
  const all = [
    ...catalog.models,
    ...(catalog.voiceChangerModels ?? []),
    ...(catalog.sfxModels ?? []),
    ...(catalog.voiceCloneModels ?? []),
  ];
  return all.find((m) => m.modelKey === modelKey.trim()) ?? catalog.models[0]!;
}

export function isElevenLabsStsModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "eleven/english-sts-v2" || k === "eleven/multilingual-sts-v2";
}

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

export const QR_VOICE_EMOTION_MAX_TOTAL = 1.5;
export const QR_VOICE_CLONE_PROMPT_MAX = 1000;

export function getQrVoiceCloneModelsFromCatalog(catalog: QrAudioCatalog): QrAudioCatalogModel[] {
  if (catalog.voiceCloneModels?.length) return catalog.voiceCloneModels;
  return catalog.models.filter((m) =>
    [
      "MiniMax/speech-2.8-hd",
      "MiniMax/speech-2.8-turbo",
      "MiniMax/speech-2.6-hd",
      "MiniMax/speech-2.6-turbo",
    ].includes(m.modelKey),
  );
}

export function getQrVoiceCloneModelFromCatalog(catalog: QrAudioCatalog, modelKey: string) {
  const models = getQrVoiceCloneModelsFromCatalog(catalog);
  return models.find((m) => m.modelKey === modelKey.trim()) ?? models[0]!;
}

export function getQrAudioVoiceFromCatalog(catalog: QrAudioCatalog, voiceId: string) {
  return catalog.voices.find((v) => v.voiceId === voiceId.trim()) ?? catalog.voices[0]!;
}

export function validateTextToAudioDraft(args: {
  modelKey: string;
  voiceId?: string;
  prompt: string;
}): string | null {
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";
  if (prompt.length > 10_000) return "提示词最多 10000 字";
  return null;
}
