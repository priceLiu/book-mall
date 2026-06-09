"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { getCanonicalPlatformPoolOwnerEmail } from "@/lib/gateway/platform-credential-copy";
import {
  getPlatformCredentialPoolStatus,
  rebindManagedKeysToPlatformPool,
} from "@/lib/gateway/platform-credential-pool";
import { syncPlatformCredentialPoolForBookUser } from "@/lib/gateway/platform-credential-seed";
import { prisma } from "@/lib/prisma";

export async function syncPlatformPoolFromEnvAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return { ok: false as const, error: "无权限" };
  }

  try {
    const ownerEmail = getCanonicalPlatformPoolOwnerEmail();
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });
    if (!owner) {
      return { ok: false as const, error: `canonical 账号不存在: ${ownerEmail}` };
    }
    const result = await syncPlatformCredentialPoolForBookUser(owner.id);
    revalidatePath("/admin/gateway/platform");
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "同步失败" };
  }
}

export async function rebindManagedKeysAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return { ok: false as const, error: "无权限" };
  }

  try {
    const { updated } = await rebindManagedKeysToPlatformPool();
    revalidatePath("/admin/gateway/platform");
    return { ok: true as const, updated };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "刷新失败" };
  }
}

export async function loadPlatformPoolStatusAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canManagePricing(session.user.role)) {
    return { ok: false as const, error: "无权限" };
  }
  const status = await getPlatformCredentialPoolStatus();
  return { ok: true as const, status };
}
