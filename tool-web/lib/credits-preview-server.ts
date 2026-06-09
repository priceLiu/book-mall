import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

const PATH = "/api/sso/tools/credits-preview";
const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; data: CreditsPreviewResponse };
const cache = new Map<string, CacheEntry>();

export type CreditsPreviewOpts = {
  modelKey: string;
  durationSec?: number;
  imageCount?: number;
};

export type CreditsPreviewResponse = {
  scheme: string;
  credits: number;
  creditsPerUnit: number;
  pricePerCreditYuan: number;
  estimatedYuan: number;
  canonicalModelKey: string;
  unit: string;
};

function cacheKey(opts: CreditsPreviewOpts): string {
  return `${opts.modelKey}:${opts.durationSec ?? ""}:${opts.imageCount ?? ""}`;
}

export async function fetchCreditsPreview(
  opts: CreditsPreviewOpts,
): Promise<CreditsPreviewResponse | null> {
  const key = cacheKey(opts);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.data;

  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!token || !origin) return null;

  const params = new URLSearchParams({ modelKey: opts.modelKey });
  if (opts.durationSec != null) params.set("durationSec", String(opts.durationSec));
  if (opts.imageCount != null) params.set("imageCount", String(opts.imageCount));

  try {
    const r = await fetch(`${origin}${PATH}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = (await r.json()) as CreditsPreviewResponse;
    cache.set(key, { at: now, data });
    return data;
  } catch {
    return null;
  }
}
