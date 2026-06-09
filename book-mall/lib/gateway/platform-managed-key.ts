/**
 * PLATFORM_CREDIT 用户/团队自动托管 sk-gw（用户不可见、不绑厂商 Key UI）
 */
import type { GatewayApiKey } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUserBillingPersona } from "@/lib/billing/billing-persona";
import { createGatewayApiKey } from "@/lib/gateway/api-key-service";
import { resolvePlatformVendorCredentialIds } from "@/lib/gateway/platform-credential-pool";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "@/lib/gateway/sync-user";

async function ensureGatewayUserForBookUser(bookUserId: string): Promise<string> {
  const existing = await findGatewayUserByBookUserId(bookUserId);
  if (existing) return existing.id;

  const bookUser = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { email: true, name: true, image: true },
  });
  if (!bookUser?.email) {
    throw new Error("Book 用户缺少邮箱，无法同步 GatewayUser");
  }
  const gw = await syncGatewayUserFromBookUser({
    bookUserId,
    email: bookUser.email,
    name: bookUser.name,
    image: bookUser.image,
  });
  if (!gw) throw new Error("GatewayUser 同步失败");
  return gw.id;
}

export async function createPlatformManagedApiKey(opts: {
  gatewayUserId: string;
  bookUserId: string;
  billingScope: "personal" | "team";
  name?: string;
}): Promise<GatewayApiKey> {
  const existing = await prisma.gatewayApiKey.findFirst({
    where: {
      userId: opts.gatewayUserId,
      scope: "PERSONAL",
      managedByPlatform: true,
      revokedAt: null,
      billingScope: opts.billingScope,
    },
  });
  if (existing) return existing;

  const credentialIds = await resolvePlatformVendorCredentialIds();
  const keyName =
    opts.name ??
    (opts.billingScope === "team"
      ? `platform-team-${opts.bookUserId.slice(0, 8)}`
      : `platform-${opts.bookUserId.slice(0, 8)}`);

  const { apiKey } = await createGatewayApiKey({
    userId: opts.gatewayUserId,
    name: keyName,
    scope: "PERSONAL",
    credentialIds,
  });

  return prisma.gatewayApiKey.update({
    where: { id: apiKey.id },
    data: { managedByPlatform: true, billingScope: opts.billingScope },
  });
}

/** PLATFORM_CREDIT 个人用户：确保隐藏 sk-gw 并写入 User.gatewayApiKeyId */
export async function ensurePlatformManagedKeyForUser(bookUserId: string): Promise<string> {
  await requireUserBillingPersona(bookUserId);
  const persona = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { billingPersona: true, gatewayApiKeyId: true },
  });
  if (persona?.billingPersona !== "PLATFORM_CREDIT") {
    throw new Error("仅 PLATFORM_CREDIT 用户可自动托管 Gateway Key");
  }

  if (persona.gatewayApiKeyId) {
    const linked = await prisma.gatewayApiKey.findUnique({
      where: { id: persona.gatewayApiKeyId },
      select: { id: true, managedByPlatform: true, revokedAt: true },
    });
    if (linked && !linked.revokedAt && linked.managedByPlatform) {
      return linked.id;
    }
  }

  const gatewayUserId = await ensureGatewayUserForBookUser(bookUserId);
  const apiKey = await createPlatformManagedApiKey({
    gatewayUserId,
    bookUserId,
    billingScope: "personal",
  });

  await prisma.user.update({
    where: { id: bookUserId },
    data: {
      gatewayApiKeyId: apiKey.id,
      gatewayApiKeyLinkedAt: new Date(),
    },
  });

  return apiKey.id;
}

/** PLATFORM_CREDIT 团队：确保 Tenant.gatewayApiKeyId */
export async function ensurePlatformManagedKeyForTenant(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      type: true,
      ownerUserId: true,
      gatewayApiKeyId: true,
    },
  });
  if (!tenant || tenant.type !== "TEAM") {
    throw new Error("仅 TEAM 租户可创建团队托管 Key");
  }

  await requireUserBillingPersona(tenant.ownerUserId);
  const owner = await prisma.user.findUnique({
    where: { id: tenant.ownerUserId },
    select: { billingPersona: true },
  });
  if (owner?.billingPersona !== "PLATFORM_CREDIT") {
    throw new Error("团队 Owner 须为 PLATFORM_CREDIT 身份");
  }

  if (tenant.gatewayApiKeyId) {
    const linked = await prisma.gatewayApiKey.findUnique({
      where: { id: tenant.gatewayApiKeyId },
      select: { id: true, managedByPlatform: true, revokedAt: true },
    });
    if (linked && !linked.revokedAt && linked.managedByPlatform) {
      return linked.id;
    }
  }

  const gatewayUserId = await ensureGatewayUserForBookUser(tenant.ownerUserId);
  const apiKey = await createPlatformManagedApiKey({
    gatewayUserId,
    bookUserId: tenant.ownerUserId,
    billingScope: "team",
    name: `platform-team-${tenantId.slice(0, 8)}`,
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { gatewayApiKeyId: apiKey.id },
  });

  return apiKey.id;
}
