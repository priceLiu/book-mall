/**
 * 运维：将指定手机号用户的生成/扣费从误绑定的自有团队，迁移到 jane 团队共享池。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/migrate-user-billing-to-jane-team.ts [--confirm]
 */
import { prisma } from "../lib/prisma";
import type { CreditLedger, CreditPool } from "@prisma/client";

const PHONE = "15625904934";
const JANE_TENANT_ID = "cmqjtfu3d006lr0je53p8mwzj";
const JANE_SEAT_ID = "cmqjtfu5h006pr0jerabqtiaf";
const MIGRATION_TAG = "migrate:15625904934:to-jane-team:2026-06-22";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function simulatePools(
  ledgers: Pick<CreditLedger, "type" | "credits" | "pool" | "refId">[],
) {
  let balanceCredits = 0;
  let reservedCredits = 0;
  let videoBalanceCredits = 0;
  let videoReservedCredits = 0;
  const reserveAmtByRef = new Map<string, number>();

  for (const l of ledgers) {
    const isVideo = l.pool === "VIDEO";
    const bal = isVideo ? "video" : "general";

    if (bal === "video") {
      videoBalanceCredits += l.credits;
    } else {
      balanceCredits += l.credits;
    }

    if (l.type === "RESERVE" && l.refId) {
      const amt = Math.abs(l.credits);
      reserveAmtByRef.set(l.refId, amt);
      if (isVideo) videoReservedCredits += amt;
      else reservedCredits += amt;
    } else if (l.type === "SETTLE" && l.refId) {
      const amt = reserveAmtByRef.get(l.refId) ?? 0;
      if (isVideo) videoReservedCredits -= amt;
      else reservedCredits -= amt;
    } else if (l.type === "RELEASE" && l.refId) {
      const amt = reserveAmtByRef.get(l.refId) ?? Math.abs(l.credits);
      if (isVideo) videoReservedCredits -= amt;
      else reservedCredits -= amt;
    }
  }

  return {
    balanceCredits,
    reservedCredits: Math.max(0, reservedCredits),
    videoBalanceCredits,
    videoReservedCredits: Math.max(0, videoReservedCredits),
  };
}

async function recomputeBalanceAfter(accountId: string) {
  const ledgers = await prisma.creditLedger.findMany({
    where: { accountId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, credits: true, pool: true, refId: true, balanceAfter: true },
  });
  const running = new Map<CreditPool, number>();
  for (const l of ledgers) {
    const cur = running.get(l.pool) ?? 0;
    const next = cur + l.credits;
    running.set(l.pool, next);
    if (l.balanceAfter !== next) {
      await prisma.creditLedger.update({
        where: { id: l.id },
        data: { balanceAfter: next },
      });
    }
  }
  const pools = simulatePools(ledgers);
  await prisma.creditAccount.update({
    where: { id: accountId },
    data: pools,
  });
  return pools;
}

async function expireOwnerTeamPool(input: {
  accountId: string;
  pool: CreditPool;
  credits: number;
  idempotencyKey: string;
  description: string;
}) {
  if (input.credits <= 0) return;
  const account = await prisma.creditAccount.findUniqueOrThrow({
    where: { id: input.accountId },
  });
  const field = input.pool === "VIDEO" ? "videoBalanceCredits" : "balanceCredits";
  const cur = account[field] as number;
  if (cur <= 0) return;
  const amount = Math.min(cur, input.credits);
  const balanceAfter = cur - amount;
  await prisma.creditLedger.create({
    data: {
      accountId: input.accountId,
      type: "EXPIRE",
      credits: -amount,
      balanceAfter,
      pool: input.pool,
      refType: "admin_migrate",
      idempotencyKey: input.idempotencyKey,
      description: input.description,
    },
  });
}

async function main() {
  const confirm = hasFlag("confirm");

  const user = await prisma.user.findFirst({
    where: { phone: PHONE },
    select: {
      id: true,
      phone: true,
      name: true,
      primaryTenantId: true,
      tenantMemberships: {
        where: { status: "ACTIVE" },
        select: { tenantId: true, role: true, tenant: { select: { id: true, name: true, type: true } } },
      },
    },
  });
  if (!user) throw new Error(`未找到手机号 ${PHONE}`);

  const ownerMembership = user.tenantMemberships.find((m) => m.role === "OWNER" && m.tenant.type === "TEAM");
  if (!ownerMembership) throw new Error("用户无自有 TEAM 租户，无需迁移");

  const ownerTenantId = ownerMembership.tenantId;
  const janeMembership = user.tenantMemberships.find((m) => m.tenantId === JANE_TENANT_ID);
  if (!janeMembership) throw new Error(`用户不是 jane 团队成员 (${JANE_TENANT_ID})`);

  const ownerAccount = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: ownerTenantId } },
  });
  const janeAccount = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: JANE_TENANT_ID } },
  });
  if (!ownerAccount || !janeAccount) throw new Error("积分账户缺失");

  const logIds = (
    await prisma.gatewayRequestLog.findMany({
      where: { actorBookUserId: user.id, tenantId: ownerTenantId },
      select: { id: true },
    })
  ).map((l) => l.id);

  const ledgersToMove = await prisma.creditLedger.findMany({
    where: {
      accountId: ownerAccount.id,
      OR: [
        { actorUserId: user.id },
        { refType: "gateway_log", refId: { in: logIds } },
      ],
    },
    select: { id: true, type: true, pool: true, credits: true },
  });

  const projects = await prisma.canvasProject.count({
    where: { userId: user.id, tenantId: ownerTenantId },
  });

  console.log(`[migrate] ${confirm ? "执行" : "DRY-RUN"} · phone=${PHONE} user=${user.id}`);
  console.log("[migrate] 当前:", {
    name: user.name,
    primaryTenantId: user.primaryTenantId,
    ownerTeam: ownerMembership.tenant.name,
    janeTeam: janeMembership.tenant.name,
  });
  console.log("[migrate] 将执行:");
  console.log(`  · 用户 primaryTenantId → ${JANE_TENANT_ID}（不改显示名）`);
  console.log(`  · 画布项目 tenantId：${projects} 条 → jane 团队`);
  console.log(`  · Gateway 日志 tenantId：${logIds.length} 条 → jane 团队`);
  console.log(`  · 积分流水迁移：${ledgersToMove.length} 条（owner → jane）`);
  console.log(`  · 自有团队 ${ownerMembership.tenant.name}：成员移除 + 租户 SUSPENDED + 剩余套餐积分 EXPIRE`);
  console.log(`  · 撤销误补 TOPUP（ops_topup:15625904934:2026-06-22:video-restore）`);

  if (!confirm) {
    console.log("[migrate] 预览完成。加 --confirm 执行。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { primaryTenantId: JANE_TENANT_ID },
    });

    await tx.canvasProject.updateMany({
      where: { userId: user.id, tenantId: ownerTenantId },
      data: { tenantId: JANE_TENANT_ID },
    });

    await tx.gatewayRequestLog.updateMany({
      where: { actorBookUserId: user.id, tenantId: ownerTenantId },
      data: { tenantId: JANE_TENANT_ID, seatId: JANE_SEAT_ID },
    });

    await tx.billingSettlementLine.updateMany({
      where: {
        actorBookUserId: user.id,
        ownerType: "TENANT",
        ownerId: ownerTenantId,
      },
      data: { ownerId: JANE_TENANT_ID },
    });

    await tx.creditLedger.updateMany({
      where: { id: { in: ledgersToMove.map((l) => l.id) } },
      data: { accountId: janeAccount.id },
    });

    await tx.tenantMember.update({
      where: {
        tenantId_userId: { tenantId: ownerTenantId, userId: user.id },
      },
      data: { status: "REMOVED" },
    });

    await tx.tenant.update({
      where: { id: ownerTenantId },
      data: { status: "SUSPENDED" },
    });
  });

  // 撤销误补 TOPUP（若仍存在）
  await prisma.creditLedger.deleteMany({
    where: { idempotencyKey: "ops_topup:15625904934:2026-06-22:video-restore" },
  }).catch(() => undefined);

  await recomputeBalanceAfter(janeAccount.id);
  await recomputeBalanceAfter(ownerAccount.id);

  const ownerAfter = await prisma.creditAccount.findUniqueOrThrow({
    where: { id: ownerAccount.id },
  });

  await expireOwnerTeamPool({
    accountId: ownerAccount.id,
    pool: "GENERAL",
    credits: ownerAfter.balanceCredits,
    idempotencyKey: `${MIGRATION_TAG}:expire:general`,
    description: `迁移至 jane 团队：清零误开通自有团队通用池（${PHONE}）`,
  });
  await expireOwnerTeamPool({
    accountId: ownerAccount.id,
    pool: "VIDEO",
    credits: ownerAfter.videoBalanceCredits,
    idempotencyKey: `${MIGRATION_TAG}:expire:video`,
    description: `迁移至 jane 团队：清零误开通自有团队视频池（${PHONE}）`,
  });

  await recomputeBalanceAfter(ownerAccount.id);
  const janeFinal = await recomputeBalanceAfter(janeAccount.id);

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, primaryTenantId: true },
  });

  console.log("[migrate] 完成:", {
    user: updatedUser,
    janePools: janeFinal,
    ownerPools: await prisma.creditAccount.findUnique({ where: { id: ownerAccount.id } }),
    logsOnJaneTeam: await prisma.gatewayRequestLog.count({
      where: { actorBookUserId: user.id, tenantId: JANE_TENANT_ID },
    }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
