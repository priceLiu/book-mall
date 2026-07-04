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

export async function fetchQrAudioCatalog(force = false): Promise<QrAudioCatalog> {
  if (!force && cachedCatalog) return cachedCatalog;
  if (!force && inflight) return inflight;
  inflight = fetchQrPlatform("/api/book-mall/api/platform/v1/quick-replica/audio-catalog")
    .then(async (res) => {
      if (!res.ok) throw new Error(`加载声音目录失败（${res.status}）`);
      const data = (await res.json()) as QrAudioCatalog;
      cachedCatalog = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function fetchQrVoicePage(page: number, pageSize = 40): Promise<{
  items: QrVoiceCatalogItem[];
  total: number;
  hasMore: boolean;
}> {
  const res = await fetchQrPlatform(
    `/api/book-mall/api/platform/v1/quick-replica/voices?page=${page}&pageSize=${pageSize}`,
  );
  if (!res.ok) throw new Error(`加载音色失败（${res.status}）`);
  return (await res.json()) as {
    items: QrVoiceCatalogItem[];
    total: number;
    hasMore: boolean;
  };
}

export function useQrAudioCatalog() {
  const [catalog, setCatalog] = useState<QrAudioCatalog | null>(cachedCatalog);
  const [loading, setLoading] = useState(!cachedCatalog);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => {
      invalidateQrAudioCatalogClientCache();
      void fetchQrAudioCatalog(true)
        .then((data) => {
          if (!cancelled) setCatalog(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
        });
    };
    let cancelled = false;
    if (!cachedCatalog) {
      void fetchQrAudioCatalog()
        .then((data) => {
          if (!cancelled) setCatalog(data);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "加载失败");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    window.addEventListener("qr-audio-catalog-invalidate", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("qr-audio-catalog-invalidate", reload);
    };
  }, []);

  return { catalog, loading, error };
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
