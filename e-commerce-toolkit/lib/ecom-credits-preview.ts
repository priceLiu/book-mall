import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type EcomCreditsPreview = {
  credits: number | null;
  creditsPerUnit: number;
  unit: string;
  canonicalModelKey: string;
};

const cache = new Map<string, { at: number; data: EcomCreditsPreview }>();
const TTL_MS = 30_000;

function cacheKey(opts: {
  modelKey: string;
  durationSec?: number;
  imageCount?: number;
  resolution?: string;
}): string {
  return `${opts.modelKey}:${opts.durationSec ?? ""}:${opts.imageCount ?? ""}:${opts.resolution ?? ""}`;
}

/** 主站统一积分预览（与画布 `/api/sso/tools/credits-preview` 同一接口）。 */
export async function fetchEcomCreditsPreview(opts: {
  modelKey: string;
  durationSec?: number;
  imageCount?: number;
  resolution?: string;
}): Promise<EcomCreditsPreview | null> {
  const modelKey = opts.modelKey.trim();
  if (!modelKey) return null;

  const key = cacheKey({ ...opts, modelKey });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const params = new URLSearchParams({ modelKey });
  if (opts.durationSec != null && Number.isFinite(opts.durationSec)) {
    params.set("durationSec", String(Math.max(1, Math.round(opts.durationSec))));
  }
  if (opts.imageCount != null && Number.isFinite(opts.imageCount)) {
    params.set("imageCount", String(Math.max(1, Math.round(opts.imageCount))));
  }
  if (opts.resolution?.trim()) params.set("resolution", opts.resolution.trim());

  try {
    const data = await ecomBookFetch(`api/sso/tools/credits-preview?${params}`, {
      cache: "no-store",
    });
    const creditsRaw = data.credits;
    const preview: EcomCreditsPreview = {
      credits:
        typeof creditsRaw === "number" && Number.isFinite(creditsRaw)
          ? Math.max(0, Math.round(creditsRaw * 100) / 100)
          : null,
      creditsPerUnit:
        typeof data.creditsPerUnit === "number" ? data.creditsPerUnit : 0,
      unit: typeof data.unit === "string" ? data.unit : "PER_IMAGE",
      canonicalModelKey:
        typeof data.canonicalModelKey === "string" ? data.canonicalModelKey : modelKey,
    };
    cache.set(key, { at: Date.now(), data: preview });
    return preview;
  } catch {
    return null;
  }
}

export function ecomCreditsUnitLabel(unit: string): string {
  const u = unit.toUpperCase();
  if (u.includes("IMAGE")) return "张";
  if (u.includes("SEC")) return "秒";
  if (u.includes("TOKEN")) return "千 token";
  return "次";
}
