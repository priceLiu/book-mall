/**
 * 补救：受邀手机号尚未注册 / 未完成 acceptInvite 时，按正式流程写入库。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/repair-team-invite-accept.ts 13042023589
 *
 * 可选：--dry-run  只打印将执行的操作
 */
import { randomBytes } from "crypto";

import bcrypt from "bcryptjs";

import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { normalizePhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/prisma";
import { acceptInvite } from "@/lib/tenant/tenant-invite-service";

const dryRun = process.argv.includes("--dry-run");
const phoneArg = process.argv.find((a) => /^\d{11}$/.test(a)) ?? "13042023589";

async function ensurePersonalTenant(userId: string, displayName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryTenantId: true },
  });
  if (user?.primaryTenantId) return user.primaryTenantId;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.tenant.findFirst({
      where: { ownerUserId: userId, type: "PERSONAL" },
      select: { id: true },
    });
    if (existing) {
      await tx.user.update({
        where: { id: userId },
        data: { primaryTenantId: existing.id },
      });
      return existing.id;
    }
    const tenant = await tx.tenant.create({
      data: {
        type: "PERSONAL",
        name: `${displayName} 的个人空间`,
        ownerUserId: userId,
        seatLimit: 1,
        maxConcurrency: 2,
        status: "ACTIVE",
      },
    });
    const seat = await tx.seat.create({
      data: { tenantId: tenant.id, status: "ACTIVE", label: "主账号席位" },
    });
    await tx.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
        seatId: seat.id,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { primaryTenantId: tenant.id },
    });
    return tenant.id;
  });
}

async function main() {
  const phone = normalizePhone(phoneArg);
  if (!phone) throw new Error(`无效手机号: ${phoneArg}`);

  const invite = await prisma.tenantInvite.findFirst({
    where: { phone, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!invite) {
    throw new Error(`未找到 ${phone} 的有效 PENDING 邀请`);
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  let tempPassword: string | null = null;

  if (!user) {
    tempPassword = `Ai${randomBytes(4).toString("hex")}!9`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const verifiedAt = new Date();
    if (dryRun) {
      console.log("[dry-run] 将创建 User + Wallet", { phone, tempPassword });
    } else {
      user = await prisma.user.create({
        data: {
          phone,
          phoneVerifiedAt: verifiedAt,
          passwordHash,
          billingPersona: "PLATFORM_CREDIT",
          billingPersonaLockedAt: verifiedAt,
          ecomBillingMode: deriveEcomBillingMode("PLATFORM_CREDIT"),
        },
      });
      await prisma.wallet.create({ data: { userId: user.id } });
      console.log("[repair] 已创建用户", user.id);
    }
  } else if (!user.phoneVerifiedAt) {
    if (dryRun) {
      console.log("[dry-run] 将补 phoneVerifiedAt", user.id);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: new Date() },
      });
    }
  }

  if (!user && dryRun) {
    console.log("[dry-run] 跳过 personal tenant / acceptInvite");
    return;
  }
  if (!user) throw new Error("用户创建失败");

  const existingMember = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
  });
  if (existingMember?.status === "ACTIVE") {
    console.log("[repair] 已是团队成员，无需重复处理", {
      tenantId: invite.tenantId,
      memberId: existingMember.id,
    });
    return;
  }

  if (dryRun) {
    console.log("[dry-run] 将 ensurePersonalTenant + acceptInvite", {
      token: invite.token,
      tenantName: invite.tenant.name,
    });
    return;
  }

  await ensurePersonalTenant(user.id, phone.slice(-4));

  const member = await acceptInvite({ token: invite.token, userId: user.id });
  console.log("[repair] 已接受邀请", {
    tenantId: member.tenantId,
    memberId: member.id,
    role: member.role,
  });

  try {
    await ensureBookUserGatewayIdentitySynced(user.id);
  } catch (e) {
    console.warn("[repair] gateway identity sync failed", e);
  }
  try {
    await ensurePlatformManagedKeyForUser(user.id);
  } catch (e) {
    console.warn("[repair] platform key ensure failed", e);
  }

  const overview = await prisma.tenantMember.findUnique({
    where: { id: member.id },
    include: {
      user: { select: { phone: true, name: true } },
      tenant: { select: { name: true } },
      seat: { select: { label: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        phone,
        tenantName: overview?.tenant.name,
        role: overview?.role,
        seat: overview?.seat?.label,
        loginHint: tempPassword
          ? { phone, tempPassword, note: "请通知成员用此密码登录，登录后建议在账户设置修改密码" }
          : { phone, note: "成员已有账号，请用原密码或验证码登录" },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
