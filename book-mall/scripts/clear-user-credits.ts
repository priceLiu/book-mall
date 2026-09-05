/**
 * 指定用户积分账户清零（余额 + 冻结），并写入 EXPIRE 流水。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/clear-user-credits.ts --email=user@example.com [--confirm]
 */
import { prisma } from "../lib/prisma";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const email = arg("email")?.trim();
  if (!email) throw new Error("请指定 --email=user@example.com");

  const confirm = hasFlag("confirm");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, billingPersona: true },
  });
  if (!user) throw new Error(`未找到用户 ${email}`);

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
  });

  if (!account) {
    console.log(`[clear-credits] ${email} 无积分账户，无需清零`);
    return;
  }

  console.log(`[clear-credits] ${confirm ? "执行" : "DRY-RUN"} · ${email}`);
  console.log(
    `[clear-credits] 当前：余额 ${account.balanceCredits} · 冻结 ${account.reservedCredits}`,
  );
  console.log(
    `[clear-credits] 将清除 planId=${account.planId ?? "—"} monthlyGrant=${account.monthlyGrantCredits}`,
  );

  if (!confirm) {
    console.log("[clear-credits] 预览完成。加 --confirm 执行。");
    return;
  }

  const idemBase = `admin_zero:${user.id}:${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    const acc = await tx.creditAccount.findUniqueOrThrow({ where: { id: account.id } });

    if (acc.balanceCredits !== 0) {
      await tx.creditLedger.create({
        data: {
          accountId: acc.id,
          type: "EXPIRE",
          credits: -acc.balanceCredits,
          balanceAfter: 0,
          refType: "admin_zero",
          idempotencyKey: `${idemBase}:balance`,
          description: `运维清零（${user.email}）`,
          billingPersonaSnap: user.billingPersona,
        },
      });
    }

    await tx.creditAccount.update({
      where: { id: acc.id },
      data: {
        balanceCredits: 0,
        reservedCredits: 0,
        monthlyGrantCredits: 0,
        planId: null,
        currentPeriodEnd: null,
        pricePerCreditYuan: null,
        perSeatCapCredits: null,
      },
    });
  });

  console.log(`[clear-credits] 已清零 ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
