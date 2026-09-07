/**
 * ModelCreditPrice 读写：与 DB 唯一键 (canonicalModelKey, tierRaw) 对齐。
 */
import type { ModelCostProfile, ModelCreditPrice } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function normalizeModelCreditTierRaw(tierRaw: string | null | undefined): string {
  return tierRaw?.trim() ?? "";
}

/** resolution / 720p / 1080P → 报价 tierRaw */
export function tierRawFromResolution(resolution?: string | null): string | null {
  if (!resolution?.trim()) return null;
  const r = resolution.trim().toUpperCase();
  if (r.endsWith("P") || r.endsWith("K")) return r;
  if (r.includes("1080")) return "1080P";
  if (r.includes("720")) return "720P";
  if (r.includes("480")) return "480P";
  if (r.includes("4K")) return "4K";
  if (r.includes("2K")) return "2K";
  if (r.includes("768")) return "768P";
  return r;
}

export function modelCreditPriceCompositeKey(input: {
  canonicalModelKey: string;
  tierRaw?: string | null;
}) {
  return {
    canonicalModelKey: input.canonicalModelKey,
    tierRaw: normalizeModelCreditTierRaw(input.tierRaw),
  };
}

/** 与 publishModelCreditPrice 相同：CHANNEL 优先，同档取净成本最低 */
export function pickActiveCostProfile<T extends Pick<ModelCostProfile, "channel" | "netCostYuan">>(
  profiles: T[],
): T | null {
  if (profiles.length === 0) return null;
  const channelRank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const num = (v: unknown) => {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(v.toString());
    return Number.isFinite(n) ? n : 0;
  };
  return [...profiles].sort((a, b) => {
    const r = (channelRank[a.channel] ?? 9) - (channelRank[b.channel] ?? 9);
    if (r !== 0) return r;
    return num(a.netCostYuan) - num(b.netCostYuan);
  })[0]!;
}

export async function findModelCreditPrice(input: {
  canonicalModelKey: string;
  tierRaw?: string | null;
  resolution?: string | null;
}): Promise<ModelCreditPrice | null> {
  const canonical = input.canonicalModelKey.trim();
  if (!canonical) return null;

  const preferredTier =
    normalizeModelCreditTierRaw(input.tierRaw) ||
    normalizeModelCreditTierRaw(tierRawFromResolution(input.resolution));

  if (preferredTier) {
    const exact = await prisma.modelCreditPrice.findUnique({
      where: {
        canonicalModelKey_tierRaw: {
          canonicalModelKey: canonical,
          tierRaw: preferredTier,
        },
      },
    });
    if (exact) return exact;

    const rows = await prisma.modelCreditPrice.findMany({
      where: { canonicalModelKey: canonical, active: true },
      orderBy: { publishedAt: "desc" },
    });
    const ci = preferredTier.toUpperCase();
    const matched = rows.find(
      (r) => normalizeModelCreditTierRaw(r.tierRaw).toUpperCase() === ci,
    );
    if (matched) return matched;
  }

  const emptyTier = await prisma.modelCreditPrice.findUnique({
    where: {
      canonicalModelKey_tierRaw: { canonicalModelKey: canonical, tierRaw: "" },
    },
  });
  if (emptyTier) return emptyTier;

  return prisma.modelCreditPrice.findFirst({
    where: { canonicalModelKey: canonical, active: true },
    orderBy: { publishedAt: "desc" },
  });
}

export async function findModelCreditPriceDisplayName(
  canonicalModelKey: string,
): Promise<string | null> {
  const row = await findModelCreditPrice({ canonicalModelKey });
  return row?.displayName ?? null;
}
