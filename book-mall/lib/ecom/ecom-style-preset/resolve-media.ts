import {
  buildEcomStylePresetOssKey,
  buildEcomStylePresetThumbOssKey,
} from "@/lib/canvas/canvas-constants";
import { ossObjectExists, ossPublicUrlForKeyFromEnv } from "@/lib/canvas/canvas-oss";

import type { EcomStylePresetRow } from "./db-mapper";

const RESOLVE_CACHE_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { thumbUrl?: string; at: number }>();

async function firstExistingPublicUrl(keys: string[]): Promise<string | undefined> {
  for (const key of keys) {
    try {
      if (await ossObjectExists(key)) {
        return ossPublicUrlForKeyFromEnv(key);
      }
    } catch {
      /* env / network */
    }
  }
  return undefined;
}

/** 仅当 OSS 上确有对象时才返回 URL，避免前端坏图。 */
export async function resolveStylePresetThumbUrlForRow(
  row: EcomStylePresetRow,
): Promise<string | undefined> {
  const cached = resolveCache.get(row.id);
  if (cached && Date.now() - cached.at < RESOLVE_CACHE_MS) {
    return cached.thumbUrl;
  }

  let thumbUrl: string | undefined;
  if (row.thumbUrl?.trim()) {
    thumbUrl = row.thumbUrl.trim();
  } else {
    thumbUrl = await firstExistingPublicUrl([
      buildEcomStylePresetThumbOssKey(row.id),
      buildEcomStylePresetOssKey(row.id, "png"),
      buildEcomStylePresetOssKey(row.id, "webp"),
      buildEcomStylePresetOssKey(row.id, "jpg"),
    ]);
  }

  resolveCache.set(row.id, { thumbUrl, at: Date.now() });
  return thumbUrl;
}

export function invalidateStylePresetMediaResolveCache(): void {
  resolveCache.clear();
}
