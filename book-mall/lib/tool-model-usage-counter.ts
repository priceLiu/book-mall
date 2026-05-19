import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { usagePeriodKeyUtcMonth } from "@/lib/pricing/ai-tryon-cost";

type Tx = Prisma.TransactionClient;

/**
 * 读取账期内已累计用量（张数等整数单位）。
 */
export async function getCumulativeModelUsage(
  userId: string,
  modelKey: string,
  periodKey = usagePeriodKeyUtcMonth(),
  tx?: Tx,
): Promise<number> {
  const db = tx ?? prisma;
  const row = await db.toolModelUsageCounter.findUnique({
    where: {
      userId_modelKey_periodKey: { userId, modelKey, periodKey },
    },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

/**
 * 结算成功后递增累计用量（同事务）。
 */
export async function incrementModelUsage(
  tx: Tx,
  userId: string,
  modelKey: string,
  delta: number,
  periodKey = usagePeriodKeyUtcMonth(),
): Promise<number> {
  const inc = Math.max(0, Math.floor(delta));
  if (inc <= 0) return getCumulativeModelUsage(userId, modelKey, periodKey, tx);
  const row = await tx.toolModelUsageCounter.upsert({
    where: {
      userId_modelKey_periodKey: { userId, modelKey, periodKey },
    },
    create: { userId, modelKey, periodKey, quantity: inc },
    update: { quantity: { increment: inc } },
    select: { quantity: true },
  });
  return row.quantity;
}
