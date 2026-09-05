import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

import type { LibtvQrAudioCatalogModel } from "./libtv-qr-audio-models";

const CATALOG_PATH = "/api/platform/v1/quick-replica/audio-catalog";

export type LibtvQrAudioCatalog = {
  models: LibtvQrAudioCatalogModel[];
  defaults: {
    modelKey: string;
    voiceId: string;
    elevenVoiceId?: string;
  };
};

let cached: LibtvQrAudioCatalog | null = null;
let inflight: Promise<LibtvQrAudioCatalog> | null = null;

export async function fetchLibtvQrAudioCatalog(
  base: string,
  force = false,
): Promise<LibtvQrAudioCatalog> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { url, init } = resolveBookMallBrowserRequest(base, CATALOG_PATH);
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`加载声音目录失败（${res.status}）`);
    const data = (await res.json()) as LibtvQrAudioCatalog;
    cached = data;
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
