import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";
import catalog from "@/config/tools-scheme-a-catalog.json";

const PATH = "/api/sso/tools/scheme-a-retail-multiplier";
const CACHE_TTL_MS = 30_000;

export type SchemeAMultiplierOpts = {
  toolKey?: string;
  modelKey?: string;
};

type CacheEntry = {
  at: number;
  multiplier: number;
  billablePriceId: string | null;
  source: string;
};
const cache = new Map<string, CacheEntry>();

function cacheKey(opts?: SchemeAMultiplierOpts): string {
  const tk = opts?.toolKey?.trim() || "";
  const mk = opts?.modelKey?.trim() || "";
  if (!tk || !mk) return "__global__";
  return `${tk}::${mk}`;
}

function catalogFallbackMultiplier(): number {
  const m = (catalog as { retailMultiplier?: unknown }).retailMultiplier;
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 2;
}

/**
 * 方案 A 零售系数：优先读主站（短缓存，按 toolKey+modelKey 分桶）；失败回落 catalog。
 * 须在可读 cookies（tools_token）的 Route Handler 中调用。
 */
export async function getSchemeARetailMultiplierServer(
  opts?: SchemeAMultiplierOpts,
): Promise<{
  multiplier: number;
  /** 命中的主站 ToolBillablePrice.id */
  billablePriceId: string | null;
  /** @deprecated 保留字段；已无全局规则，与 billablePriceId 二选一语义 */
  ruleId: string | null;
  /** @deprecated 保留字段；已无按模型覆盖表 */
  overrideId: string | null;
  source: "main" | "catalog_fallback" | "cache";
}> {
  const key = cacheKey(opts);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return {
      multiplier: hit.multiplier,
      billablePriceId: hit.billablePriceId,
      ruleId: hit.billablePriceId,
      overrideId: null,
      source: "cache",
    };
  }

  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!token || !origin?.length) {
    const mult = catalogFallbackMultiplier();
    return {
      multiplier: mult,
      billablePriceId: null,
      ruleId: null,
      overrideId: null,
      source: "catalog_fallback",
    };
  }

  const params = new URLSearchParams();
  const tk = opts?.toolKey?.trim();
  const mk = opts?.modelKey?.trim();
  if (tk) params.set("toolKey", tk);
  if (mk) params.set("modelKey", mk);
  const qs = params.toString();
  const url = `${origin}${PATH}${qs ? `?${qs}` : ""}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = (await r.json().catch(() => null)) as
      | {
          multiplier?: unknown;
          billablePriceId?: unknown;
          ruleId?: unknown;
          overrideId?: unknown;
          source?: unknown;
        }
      | null;
    const multRaw = data?.multiplier;
    const mult =
      typeof multRaw === "number" && Number.isFinite(multRaw) && multRaw > 0
        ? multRaw
        : catalogFallbackMultiplier();
    const billablePriceId =
      typeof data?.billablePriceId === "string" && data.billablePriceId.length > 0
        ? data.billablePriceId
        : typeof data?.ruleId === "string" && data.ruleId.length > 0
          ? data.ruleId
          : null;
    const ent: CacheEntry = {
      at: now,
      multiplier: mult,
      billablePriceId,
      source: "main",
    };
    cache.set(key, ent);
    return {
      multiplier: mult,
      billablePriceId,
      ruleId: billablePriceId,
      overrideId: null,
      source: "main",
    };
  } catch {
    const mult = catalogFallbackMultiplier();
    return {
      multiplier: mult,
      billablePriceId: null,
      ruleId: null,
      overrideId: null,
      source: "catalog_fallback",
    };
  }
}
