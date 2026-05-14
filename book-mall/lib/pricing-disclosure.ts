import { prisma } from "@/lib/prisma";

export type EffectiveBillableRow = {
  toolKey: string;
  action: string | null;
  schemeARefModelKey: string | null;
  pricePoints: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
};

/**
 * 前台公示：当前仍处于生效区间内的按次标价。
 * 同一 (toolKey, action) 若有多行（如分析室按参考模型分行），按 schemeARefModelKey 区分各保留一条最新生效的。
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
      { action: "asc" },
      { schemeARefModelKey: "asc" },
      { effectiveFrom: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const seen = new Set<string>();
  const out: EffectiveBillableRow[] = [];
  for (const r of rows) {
    const ref = r.schemeARefModelKey ?? "";
    const k = `${r.toolKey}\0${r.action ?? ""}\0${ref}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      toolKey: r.toolKey,
      action: r.action,
      schemeARefModelKey: r.schemeARefModelKey ?? null,
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
    if (a.action == null && b.action == null) {
      return (a.schemeARefModelKey ?? "").localeCompare(
        b.schemeARefModelKey ?? "",
        "zh-CN",
      );
    }
    const ac = (a.action ?? "").localeCompare(b.action ?? "", "zh-CN");
    if (ac !== 0) return ac;
    return (a.schemeARefModelKey ?? "").localeCompare(
      b.schemeARefModelKey ?? "",
      "zh-CN",
    );
  });

  return out;
}
