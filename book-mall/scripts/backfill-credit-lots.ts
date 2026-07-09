/**
 * 历史余额回填为积分批次（CreditLot）。
 *
 * 对每个 CreditAccount 的可用余额（balanceCredits / videoBalanceCredits）各建 1 个
 * 「永久」批次（source=TOPUP, expiresAt=null），避免上线即清零老用户；reserved 不计
 * （已从余额扣出，独立追踪）。
 *
 * 幂等：对已存在 refType='legacy_backfill' 批次的 (account, pool) 跳过。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/backfill-credit-lots.ts [--confirm]
 */
import { prisma } from "../lib/prisma";

const CONFIRM = process.argv.includes("--confirm");

async function backfillPool(
  accountId: string,
  pool: "GENERAL" | "VIDEO",
  balance: number,
): Promise<"skip" | "create" | "zero"> {
  if (balance <= 0) return "zero";
  const existing = await prisma.creditLot.findFirst({
    where: { accountId, pool, refType: "legacy_backfill" },
    select: { id: true },
  });
  if (existing) return "skip";
  if (!CONFIRM) return "create";
  await prisma.creditLot.create({
    data: {
      accountId,
      pool,
      source: "TOPUP",
      originalCredits: balance,
      remainingCredits: balance,
      expiresAt: null,
      refType: "legacy_backfill",
    },
  });
  return "create";
}

async function main() {
  const accounts = await prisma.creditAccount.findMany({
    select: { id: true, balanceCredits: true, videoBalanceCredits: true },
  });
  let created = 0;
  let skipped = 0;
  for (const a of accounts) {
    const g = await backfillPool(a.id, "GENERAL", a.balanceCredits);
    const v = await backfillPool(a.id, "VIDEO", a.videoBalanceCredits);
    for (const r of [g, v]) {
      if (r === "create") created += 1;
      else if (r === "skip") skipped += 1;
    }
  }
  console.log(
    `${CONFIRM ? "APPLIED" : "DRY-RUN"}: accounts=${accounts.length} lotsToCreate/created=${created} skipped=${skipped}`,
  );
  if (!CONFIRM) console.log("（预演，加 --confirm 实际写入）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
