import { prisma } from "@/lib/prisma";

/**
 * 解析当前生效的按次单价（分）。
 * 匹配同一 toolKey 下 effectiveFrom ≤ now ≤ effectiveTo（或 effectiveTo 为空），
 * 且 action 等于给定 action，或定价行为 null（通配该工具下 action）。
 * 优先采用「action 精确匹配」的行；否则采用 action 为 null 的行。
 */
export async function resolveBillablePriceMinor(
  toolKey: string,
  action: string,
): Promise<number | undefined> {
  const now = new Date();
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      toolKey,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const applicable = rows.filter(
    (r) => r.action == null || r.action === action,
  );
  if (applicable.length === 0) return undefined;

  const exact = applicable.find((r) => r.action === action);
  const row = exact ?? applicable.find((r) => r.action == null);
  const v = row?.priceMinor;
  return typeof v === "number" && v > 0 ? v : undefined;
}
