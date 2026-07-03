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
};

export type QrAudioCatalog = {
  models: QrAudioCatalogModel[];
  voices: QrAudioCatalogVoice[];
  styleTags: QrAudioCatalogStyleTag[];
  voicesPaged?: boolean;
  defaults: {
    modelKey: string;
    voiceId: string;
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
  };
};

let cachedCatalog: QrAudioCatalog | null = null;
let inflight: Promise<QrAudioCatalog> | null = null;

export async function fetchQrAudioCatalog(): Promise<QrAudioCatalog> {
  if (cachedCatalog) return cachedCatalog;
  if (inflight) return inflight;
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
    if (cachedCatalog) return;
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}

export function getQrAudioModelFromCatalog(catalog: QrAudioCatalog, modelKey: string) {
  return (
    catalog.models.find((m) => m.modelKey === modelKey.trim()) ?? catalog.models[0]!
  );
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
