/**
 * 多租户体系回填（gateway-multi-credential-and-tenant · Sprint 0）：
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/backfill-tenant-system.ts
 *
 * 幂等，可重复执行：
 *   1. 为每个尚无 primaryTenantId 的 User 建 PERSONAL 租户 + OWNER 成员 + 占 1 席，并回填 primaryTenantId。
 *   2. 为存量 GatewayVendorCredential 回填 ownerScope=USER、ownerId=对应 Book 用户 id。
 *
 * 个人计费仍走 CreditAccount(ownerType=USER)；个人租户仅作空间/上下文载体。
 */
import { prisma } from "../lib/prisma";

async function backfillUserTenants() {
  const users = await prisma.user.findMany({
    where: { primaryTenantId: null },
    select: { id: true, name: true, email: true },
  });
  let created = 0;
  for (const u of users) {
    const displayName = u.name?.trim() || u.email?.split("@")[0] || "个人空间";
    await prisma.$transaction(async (tx) => {
      // 双重保险：可能已有 OWNER 个人租户（重跑场景）
      const existing = await tx.tenant.findFirst({
        where: { ownerUserId: u.id, type: "PERSONAL" },
        select: { id: true },
      });
      let tenantId = existing?.id;
      if (!tenantId) {
        const tenant = await tx.tenant.create({
          data: {
            type: "PERSONAL",
            name: `${displayName} 的个人空间`,
            ownerUserId: u.id,
            seatLimit: 1,
            maxConcurrency: 2,
            status: "ACTIVE",
          },
        });
        tenantId = tenant.id;
        const seat = await tx.seat.create({
          data: { tenantId, status: "ACTIVE", label: "主账号席位" },
        });
        await tx.tenantMember.create({
          data: {
            tenantId,
            userId: u.id,
            role: "OWNER",
            status: "ACTIVE",
            seatId: seat.id,
          },
        });
      }
      await tx.user.update({
        where: { id: u.id },
        data: { primaryTenantId: tenantId },
      });
      created += 1;
    });
  }
  return { scanned: users.length, created };
}

async function backfillCredentialOwners() {
  // GatewayVendorCredential.userId 指向 GatewayUser；GatewayUser 关联 Book 用户（linkedBookUser 在 GatewayApiKey 上）。
  // 多 Key 路由按 ownerScope+ownerId 检索，个人凭证 ownerId 用 GatewayUser.id 即可（与现有 userId 一致语义）。
  const res = await prisma.gatewayVendorCredential.updateMany({
    where: { ownerId: null },
    data: { ownerScope: "USER" },
  });
  // ownerId 回填为 userId（updateMany 不支持字段引用，用原始 SQL）
  const filled = await prisma.$executeRawUnsafe(
    `UPDATE "GatewayVendorCredential" SET "ownerId" = "userId" WHERE "ownerId" IS NULL`,
  );
  return { scopeUpdated: res.count, ownerIdFilled: filled };
}

async function main() {
  const t = await backfillUserTenants();
  console.log(`[backfill-tenant] 用户扫描 ${t.scanned}，建/补个人租户 ${t.created}`);
  const c = await backfillCredentialOwners();
  console.log(`[backfill-tenant] 凭证 ownerScope 更新 ${c.scopeUpdated}，ownerId 回填 ${c.ownerIdFilled}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
