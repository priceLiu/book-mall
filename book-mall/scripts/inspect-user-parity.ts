/**
 * 对比两个用户的计费/ BYOK / 积分状态（只读）。
 *   tsx scripts/inspect-user-parity.ts source@example.com target@example.com
 */
import { prisma } from "../lib/prisma";

async function snapshot(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      billingPersona: true,
      billingPersonaLockedAt: true,
      gatewayApiKeyId: true,
    },
  });
  if (!user) return { email, found: false as const };

  const [credit, byokSub, toolPeriods] = await Promise.all([
    prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
    }),
    prisma.byokSubscription.findFirst({
      where: { ownerType: "USER", ownerId: user.id, status: "ACTIVE" },
      orderBy: { periodEnd: "desc" },
    }),
    prisma.userToolServicePeriod.count({ where: { userId: user.id, status: "ACTIVE" } }),
  ]);

  return {
    email,
    found: true as const,
    user,
    credit: credit
      ? {
          balanceCredits: credit.balanceCredits,
          videoBalanceCredits: credit.videoBalanceCredits,
          monthlyGrantCredits: credit.monthlyGrantCredits,
          planId: credit.planId,
          currentPeriodEnd: credit.currentPeriodEnd,
        }
      : null,
    byokSub: byokSub
      ? {
          scopeKey: byokSub.scopeKey,
          status: byokSub.status,
          periodEnd: byokSub.periodEnd,
          techServiceFeeYuan: Number(byokSub.techServiceFeeYuan),
        }
      : null,
    activeToolPeriods: toolPeriods,
  };
}

async function main() {
  const source = process.argv[2] ?? "13808816802@126.com";
  const target = process.argv[3] ?? "123456789@126.com";
  const [a, b] = await Promise.all([snapshot(source), snapshot(target)]);
  console.log(JSON.stringify({ source: a, target: b }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
