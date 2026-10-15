/**
 * 订阅价页「每月可生成数量」矩阵：只展示与实扣一致的报价行。
 * 会跳过「账单归口到另一 active 分档」的影子行（如 seedance-2.0 @ 6.25
 * 实扣走 seedance-2.0-720p-real @ 49.5）。
 */
import { prisma } from "@/lib/prisma";
import { sbv1VideoCanonicalFromParams } from "@/lib/billing/sbv1-video-canonical";
import { sanitizeModelCreditDisplayName } from "./model-credit-display-name";

export type PricingPageModelRow = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
};

/** 仅裸别名会归口到分档实扣 key；已分档 / mini / KIE 等保持自身 */
const SEEDANCE_BARE_ALIAS_RE =
  /^(doubao-)?seedance-2(\.0)?(-i2v)?$/i;

function settlementKeyForPriceRow(input: {
  canonicalModelKey: string;
  unit: string;
}): string | null {
  if (input.unit !== "PER_SEC") return null;
  const k = input.canonicalModelKey;
  if (!SEEDANCE_BARE_ALIAS_RE.test(k)) return null;
  return sbv1VideoCanonicalFromParams({ modelKey: k });
}

export async function listPricingPageModels(): Promise<PricingPageModelRow[]> {
  const rows = await prisma.modelCreditPrice.findMany({
    where: { active: true },
    orderBy: { creditsPerUnit: "asc" },
  });

  const activeKeys = new Set(rows.map((r) => r.canonicalModelKey));
  const out: PricingPageModelRow[] = [];
  const emitted = new Set<string>();

  for (const row of rows) {
    const settlementKey =
      settlementKeyForPriceRow({
        canonicalModelKey: row.canonicalModelKey,
        unit: row.unit,
      }) ?? row.canonicalModelKey;

    // 影子行：裸别名归口到另一已发布分档 → 不在矩阵展示，避免虚低「每次消耗」
    if (
      settlementKey !== row.canonicalModelKey &&
      activeKeys.has(settlementKey)
    ) {
      continue;
    }

    const emitKey = `${row.canonicalModelKey}::${row.tierRaw}::${row.unit}`;
    if (emitted.has(emitKey)) continue;
    emitted.add(emitKey);

    out.push({
      canonicalModelKey: row.canonicalModelKey,
      displayName: sanitizeModelCreditDisplayName(row.displayName, row.tierRaw),
      unit: row.unit,
      creditsPerUnit: Number(row.creditsPerUnit),
    });
  }

  return out;
}
