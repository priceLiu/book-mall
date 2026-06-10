/**
 * 将 target 账号的计费/BYOK/积分状态对齐到 source（运维用）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/align-user-billing.ts \
 *     --source=13808816802@126.com --target=123456789@126.com [--confirm]
 */
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { BYOK_SCOPE_PERSONAL } from "../lib/billing/byok-pricing";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function zeroCreditAccount(userId: string, email: string, billingPersona: string | null) {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
  });
  if (!account) return;

  const idemBase = `align_zero:${userId}:${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    const acc = await tx.creditAccount.findUniqueOrThrow({ where: { id: account.id } });

    if (acc.balanceCredits !== 0) {
      await tx.creditLedger.create({
        data: {
          accountId: acc.id,
          type: "EXPIRE",
          credits: -acc.balanceCredits,
          balanceAfter: 0,
          pool: "GENERAL",
          refType: "admin_align",
          idempotencyKey: `${idemBase}:general`,
          description: `对齐清零：通用池（${email}）`,
          billingPersonaSnap: billingPersona as "BYOK" | "PLATFORM_CREDIT" | null,
        },
      });
    }

    if (acc.videoBalanceCredits !== 0) {
      await tx.creditLedger.create({
        data: {
          accountId: acc.id,
          type: "EXPIRE",
          credits: -acc.videoBalanceCredits,
          balanceAfter: 0,
          pool: "VIDEO",
          refType: "admin_align",
          idempotencyKey: `${idemBase}:video`,
          description: `对齐清零：视频池（${email}）`,
          billingPersonaSnap: billingPersona as "BYOK" | "PLATFORM_CREDIT" | null,
        },
      });
    }

    await tx.creditAccount.update({
      where: { id: acc.id },
      data: {
        balanceCredits: 0,
        videoBalanceCredits: 0,
        reservedCredits: 0,
        videoReservedCredits: 0,
        monthlyGrantCredits: 0,
        videoMonthlyGrant: 0,
        planId: null,
        currentPeriodEnd: null,
        pricePerCreditYuan: null,
        perSeatCapCredits: null,
      },
    });
  });
}

async function main() {
  const sourceEmail = arg("source")?.trim();
  const targetEmail = arg("target")?.trim();
  if (!sourceEmail || !targetEmail) {
    throw new Error("用法: --source=... --target=... [--confirm]");
  }

  const confirm = hasFlag("confirm");

  const [source, target] = await Promise.all([
    prisma.user.findUnique({
      where: { email: sourceEmail },
      select: {
        id: true,
        email: true,
        role: true,
        billingPersona: true,
        billingPersonaLockedAt: true,
        gatewayApiKeyId: true,
      },
    }),
    prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        role: true,
        billingPersona: true,
        billingPersonaLockedAt: true,
        gatewayApiKeyId: true,
      },
    }),
  ]);

  if (!source) throw new Error(`未找到 source: ${sourceEmail}`);
  if (!target) throw new Error(`未找到 target: ${targetEmail}`);

  const [sourceCredit, sourceByok] = await Promise.all([
    prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: source.id } },
    }),
    prisma.byokSubscription.findFirst({
      where: { ownerType: "USER", ownerId: source.id, status: "ACTIVE" },
      orderBy: { periodEnd: "desc" },
    }),
  ]);

  const [targetCredit, targetByok] = await Promise.all([
    prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: target.id } },
    }),
    prisma.byokSubscription.findFirst({
      where: { ownerType: "USER", ownerId: target.id, status: "ACTIVE" },
      orderBy: { periodEnd: "desc" },
    }),
  ]);

  console.log(`[align] ${confirm ? "执行" : "DRY-RUN"}: ${targetEmail} ← ${sourceEmail}`);
  console.log("[align] source:", {
    role: source.role,
    billingPersona: source.billingPersona,
    gatewayLinked: Boolean(source.gatewayApiKeyId),
    credit: sourceCredit
      ? `${sourceCredit.balanceCredits}/${sourceCredit.videoBalanceCredits}`
      : "none",
    byok: sourceByok
      ? `${sourceByok.scopeKey} → ${sourceByok.periodEnd.toISOString()}`
      : "none",
  });
  console.log("[align] target (before):", {
    role: target.role,
    billingPersona: target.billingPersona,
    gatewayLinked: Boolean(target.gatewayApiKeyId),
    credit: targetCredit
      ? `${targetCredit.balanceCredits}/${targetCredit.videoBalanceCredits}`
      : "none",
    byok: targetByok
      ? `${targetByok.scopeKey} → ${targetByok.periodEnd.toISOString()}`
      : "none",
  });

  console.log("[align] 将执行:");
  console.log(`  · role → ${source.role}`);
  console.log(`  · billingPersona → ${source.billingPersona}`);
  console.log("  · 积分清零 + 清除历史套餐 planId");
  if (sourceByok) {
    console.log(
      `  · BYOK ${sourceByok.scopeKey}，有效期至 ${sourceByok.periodEnd.toISOString()}`,
    );
  } else {
    console.log("  · 无 BYOK 订阅（target 若有则过期）");
  }
  if (source.gatewayApiKeyId && !target.gatewayApiKeyId) {
    console.log("  · 警告：source 已关联 Gateway，target 未关联（不自动复制 sk-gw）");
  }

  if (!confirm) {
    console.log("[align] 预览完成。加 --confirm 执行。");
    return;
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      role: source.role,
      billingPersona: source.billingPersona,
      billingPersonaLockedAt: source.billingPersonaLockedAt ?? new Date(),
    },
  });

  await zeroCreditAccount(target.id, target.email ?? target.id, source.billingPersona);

  await prisma.byokSubscription.updateMany({
    where: { ownerType: "USER", ownerId: target.id, status: "ACTIVE" },
    data: { status: "EXPIRED" },
  });

  if (sourceByok) {
    await prisma.byokSubscription.create({
      data: {
        ownerType: "USER",
        ownerId: target.id,
        scopeKey: sourceByok.scopeKey,
        status: "ACTIVE",
        seats: sourceByok.seats,
        techServiceFeeYuan: sourceByok.techServiceFeeYuan,
        periodStart: sourceByok.periodStart,
        periodEnd: sourceByok.periodEnd,
        lastOrderId: `align_from_${source.id}_${randomUUID().slice(0, 8)}`,
      },
    });
  }

  const after = await prisma.user.findUnique({
    where: { id: target.id },
    select: { role: true, billingPersona: true, gatewayApiKeyId: true },
  });
  const afterCredit = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: target.id } },
  });
  const afterByok = await prisma.byokSubscription.findFirst({
    where: { ownerType: "USER", ownerId: target.id, status: "ACTIVE" },
  });

  console.log("[align] target (after):", {
    role: after?.role,
    billingPersona: after?.billingPersona,
    gatewayLinked: Boolean(after?.gatewayApiKeyId),
    credit: afterCredit
      ? `${afterCredit.balanceCredits}/${afterCredit.videoBalanceCredits}`
      : "none",
    byok: afterByok
      ? `${afterByok.scopeKey} → ${afterByok.periodEnd.toISOString()}`
      : "none",
  });
  console.log("[align] 完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
