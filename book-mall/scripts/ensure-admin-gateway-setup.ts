/**
 * 创建 admin@126.com、修复试点 BYOK 订阅、同步平台凭证池。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/ensure-admin-gateway-setup.ts
 */
import bcrypt from "bcryptjs";

import { activateByokSubscription } from "../lib/billing/byok-subscription-service";
import { BYOK_SCOPE_PERSONAL } from "../lib/billing/byok-pricing";
import { deriveEcomBillingMode } from "../lib/billing/billing-persona";
import {
  getGatewayLinkStatusForUser,
  linkGatewayApiKeyForUser,
} from "../lib/gateway/book-gateway-link";
import { createGatewayApiKey } from "../lib/gateway/api-key-service";
import {
  isLegacyPlatformKeyName,
  PERSONAL_KEY_DEFAULT_NAME,
} from "../lib/gateway/key-scope";
import { syncPlatformCredentialPoolForBookUser } from "../lib/gateway/platform-credential-seed";
import { prisma } from "../lib/prisma";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "../lib/gateway/sync-user";

const ADMIN_EMAIL = "admin@126.com";
const ADMIN_PASSWORD = "123456";
const PILOT_EMAIL = "13808816802@126.com";

async function ensureByokSubscription(userId: string, email: string) {
  const existing = await prisma.byokSubscription.findFirst({
    where: { ownerType: "USER", ownerId: userId, status: "ACTIVE" },
  });
  if (existing) {
    console.log(`[ok] ${email} 已有 BYOK 订阅至 ${existing.periodEnd.toISOString()}`);
    return;
  }
  const result = await activateByokSubscription({
    ownerType: "USER",
    ownerId: userId,
    scopeKey: BYOK_SCOPE_PERSONAL,
    seats: 1,
    orderId: `setup_${Date.now()}`,
  });
  console.log(`[ok] ${email} 已开通 BYOK 个人套餐，至 ${result.periodEnd.toISOString()}`);
}

async function ensureAdminUser() {
  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    user = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        name: "系统管理员",
        role: "ADMIN",
        billingPersona: "BYOK",
        billingPersonaLockedAt: new Date(),
        ecomBillingMode: deriveEcomBillingMode("BYOK"),
      },
    });
    await prisma.wallet.create({ data: { userId: user.id } });
    console.log(`[ok] 已创建 ${ADMIN_EMAIL}（ADMIN · BYOK）`);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "ADMIN",
        billingPersona: "BYOK",
        billingPersonaLockedAt: user.billingPersonaLockedAt ?? new Date(),
        ecomBillingMode: deriveEcomBillingMode("BYOK"),
      },
    });
    console.log(`[ok] ${ADMIN_EMAIL} 已确认为 ADMIN · BYOK`);
  }
  return user;
}

async function ensurePersonalKeyLinked(bookUserId: string, email: string, credentialIds: string[]) {
  await syncGatewayUserFromBookUser({
    bookUserId,
    email,
    name: email.split("@")[0],
  });
  const gwUser = await findGatewayUserByBookUserId(bookUserId);
  if (!gwUser) throw new Error("GatewayUser 同步失败");

  let personalKey = await prisma.gatewayApiKey.findFirst({
    where: {
      userId: gwUser.id,
      scope: "PERSONAL",
      revokedAt: null,
      managedByPlatform: false,
    },
    orderBy: { createdAt: "desc" },
  });

  let rawKey: string | null = null;
  if (!personalKey) {
    const created = await createGatewayApiKey({
      userId: gwUser.id,
      name: PERSONAL_KEY_DEFAULT_NAME,
      scope: "PERSONAL",
      credentialIds,
    });
    personalKey = created.apiKey;
    rawKey = created.rawKey;
  } else if (credentialIds.length > 0) {
    await prisma.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: personalKey.id } });
    await prisma.gatewayApiKeyCredential.createMany({
      data: credentialIds.map((credentialId) => ({ apiKeyId: personalKey!.id, credentialId })),
      skipDuplicates: true,
    });
  }

  const status = await getGatewayLinkStatusForUser(bookUserId);
  if (
    !status.linked ||
    status.gatewayApiKeyId !== personalKey.id ||
    isLegacyPlatformKeyName(status.keyName ?? "")
  ) {
    if (rawKey) {
      await linkGatewayApiKeyForUser(bookUserId, rawKey);
      console.log(`[ok] ${email} 已关联 Personal sk-gw`);
    } else {
      console.log(`[warn] ${email} Personal Key 已存在但无法自动关联，请在 Book 个人中心粘贴 sk-gw`);
    }
  } else {
    console.log(`[ok] ${email} 已关联 Personal Key`);
  }
}

async function main() {
  const admin = await ensureAdminUser();
  const pool = await syncPlatformCredentialPoolForBookUser(admin.id);
  console.log(
    `[ok] 平台凭证池：${pool.credentialCount} 条 · Platform Key ${pool.platformAdminKeyId}`,
  );

  const adminGw = await findGatewayUserByBookUserId(admin.id);
  const credIds =
    adminGw
      ? (
          await prisma.gatewayApiKeyCredential.findMany({
            where: { apiKeyId: pool.platformAdminKeyId },
            select: { credentialId: true },
          })
        ).map((b) => b.credentialId)
      : [];
  await ensurePersonalKeyLinked(admin.id, ADMIN_EMAIL, credIds);
  await ensureByokSubscription(admin.id, ADMIN_EMAIL);

  const pilot = await prisma.user.findUnique({ where: { email: PILOT_EMAIL } });
  if (pilot) {
    await prisma.user.update({
      where: { id: pilot.id },
      data: {
        billingPersona: "BYOK",
        billingPersonaLockedAt: pilot.billingPersonaLockedAt ?? new Date(),
        ecomBillingMode: deriveEcomBillingMode("BYOK"),
      },
    });
    await ensureByokSubscription(pilot.id, PILOT_EMAIL);
    console.log(`[ok] ${PILOT_EMAIL} persona=BYOK，Gateway Key 已存在`);
  } else {
    console.warn(`[warn] 未找到试点用户 ${PILOT_EMAIL}`);
  }

  console.log("\n登录信息：");
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Book 管理后台 → /admin/gateway/platform`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
