import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type ModelCreditsPreview = {
  credits: number | null;
  creditsPerUnit: number;
  unit: string;
  canonicalModelKey: string;
  billingPersona: "PLATFORM_CREDIT" | "BYOK" | null;
  /** BYOK 用户展示文案 */
  creditsLabel?: string;
};

const cache = new Map<string, { at: number; data: ModelCreditsPreview }>();
const TTL_MS = 30_000;

function cacheKey(
  modelKey: string,
  durationSec?: number,
  variantId?: string,
  imageCount?: number,
  resolution?: string,
): string {
  return `${modelKey}:${variantId ?? ""}:${durationSec ?? ""}:${imageCount ?? ""}:${resolution ?? ""}`;
}

/** 经 canvas BFF 拉主站统一积分预览（SSO Bearer / tools_token） */
export async function fetchModelCreditsPreview(
  base: string,
  opts: {
    modelKey: string;
    durationSec?: number;
    variantId?: string;
    imageCount?: number;
    resolution?: string;
  },
): Promise<ModelCreditsPreview | null> {
  const key = cacheKey(
    opts.modelKey,
    opts.durationSec,
    opts.variantId,
    opts.imageCount,
    opts.resolution,
  );
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const params = new URLSearchParams({ modelKey: opts.modelKey.trim() });
  if (opts.durationSec != null && Number.isFinite(opts.durationSec)) {
    params.set("durationSec", String(Math.round(opts.durationSec)));
  }
  if (opts.variantId?.trim()) {
    params.set("variantId", opts.variantId.trim());
  }
  if (opts.imageCount != null && Number.isFinite(opts.imageCount)) {
    params.set("imageCount", String(Math.max(1, Math.round(opts.imageCount))));
  }
  if (opts.resolution?.trim()) {
    params.set("resolution", opts.resolution.trim());
  }

  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/sso/tools/credits-preview?${params}`,
    { credentials: "same-origin", cache: "no-store" },
  );

  try {
    const r = await fetch(url, init);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      credits?: number;
      creditsPerUnit?: number;
      unit?: string;
      canonicalModelKey?: string;
      billingPersona?: "PLATFORM_CREDIT" | "BYOK";
      creditsLabel?: string;
    };
    const data: ModelCreditsPreview = {
      credits:
        typeof j.credits === "number" && Number.isFinite(j.credits)
          ? Math.max(0, Math.round(j.credits))
          : null,
      creditsPerUnit: j.creditsPerUnit ?? 0,
      unit: j.unit ?? "PER_SEC",
      canonicalModelKey: j.canonicalModelKey ?? opts.modelKey,
      billingPersona: j.billingPersona ?? null,
      creditsLabel: j.creditsLabel,
    };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}
