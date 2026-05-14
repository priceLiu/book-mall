import { prisma } from "@/lib/prisma";

export type EffectiveBillableRow = {
  toolKey: string;
  action: string | null;
  pricePoints: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
};

/**
 * 前台公示：当前仍处于生效区间内的按次标价；每个 (toolKey, action) 仅保留最近生效的一条。
 */
export async function getEffectiveBillablePricesForDisclosure(
  now = new Date(),
): Promise<EffectiveBillableRow[]> {
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [
      { toolKey: "asc" },
      { effectiveFrom: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const seen = new Set<string>();
  const out: EffectiveBillableRow[] = [];
  for (const r of rows) {
    const k = `${r.toolKey}\0${r.action ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      toolKey: r.toolKey,
      action: r.action,
      pricePoints: r.pricePoints,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      note: r.note,
    });
  }

  out.sort((a, b) => {
    const tk = a.toolKey.localeCompare(b.toolKey, "zh-CN");
    if (tk !== 0) return tk;
    if (a.action == null && b.action != null) return 1;
    if (a.action != null && b.action == null) return -1;
    if (a.action == null && b.action == null) return 0;
    return (a.action ?? "").localeCompare(b.action ?? "", "zh-CN");
  });

  return out;
}
