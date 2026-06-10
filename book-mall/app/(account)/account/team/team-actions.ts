"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import {
  createTeamTenant,
  getMembership,
  removeMember,
  transferOwnership,
  updateMemberRole,
  updateTenantConfig,
} from "@/lib/tenant/tenant-service";
import {
  acceptInvite,
  createInvite,
  revokeInvite,
} from "@/lib/tenant/tenant-invite-service";
import {
  assertTenantPermission,
  type TenantAction,
} from "@/lib/tenant/permission";
import { resolvePlanCreditGrants } from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { grantCredits } from "@/lib/billing/credit-account-service";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import { ensurePlatformManagedKeyForTenant } from "@/lib/gateway/platform-managed-key";
import type { ActionResult } from "@/lib/server-action-result";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/context";
import type { TenantRole } from "@prisma/client";

async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, error: "请先登录" };
  return { ok: true, userId: session.user.id };
}

/** 校验当前用户在租户内有权执行 action，返回其角色。 */
async function requirePermission(
  userId: string,
  tenantId: string,
  action: TenantAction,
): Promise<{ ok: true; role: TenantRole } | { ok: false; error: string }> {
  const member = await getMembership(tenantId, userId);
  if (!member || member.status !== "ACTIVE") {
    return { ok: false, error: "你不是该团队成员" };
  }
  try {
    assertTenantPermission({ role: member.role }, action);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, role: member.role };
}

function str(v: FormDataEntryValue | null): string {
  return (v?.toString() ?? "").trim();
}
function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}
function pickRole(v: string): TenantRole {
  return v === "ADMIN" ? "ADMIN" : v === "OWNER" ? "OWNER" : "MEMBER";
}

/** 开通团队：建团队 + 席位 + OWNER；按套餐发放共享积分池（测试环境直接发放）。 */
export async function createTeamAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const name = str(formData.get("name"));
  const planId = str(formData.get("planId"));
  const totalSeats = Math.max(1, Math.round(num(formData.get("totalSeats"), 1)));
  if (!name) return { ok: false, error: "请填写团队名称" };
  if (!planId) return { ok: false, error: "请选择团队套餐" };

  try {
    await assertBillingPersona(auth.userId, "PLATFORM_CREDIT");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.family !== "TEAM") {
    return { ok: false, error: "无效的团队套餐" };
  }

  let quote;
  try {
    quote = await quoteTeamPlan({ planId, totalSeats });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const tenant = await createTeamTenant({
    ownerUserId: auth.userId,
    name,
    planId,
    packageLevel: plan.tier,
    interval: plan.interval,
    seatLimit: quote.totalSeats,
    perSeatCapCredits: null,
  });

  // 发放共享积分池（按周期：月/年都先发首期月度池；续费由月度任务处理）
  const periodEnd = new Date();
  if (plan.interval === "YEAR") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const grants = resolvePlanCreditGrants(plan, quote.totalSeats);
  await grantCredits({
    ref: { ownerType: "TENANT", ownerId: tenant.id },
    credits: grants.generalCredits,
    videoCredits: grants.videoCredits,
    monthlyGrantCredits: grants.monthlyGrantCredits,
    videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
    pricePerCreditYuan: quote.perSeatCredits > 0 ? quote.totalPriceYuan / quote.monthlyCreditsPool : null,
    planId,
    currentPeriodEnd: periodEnd,
    idempotencyKey: `team_open:${tenant.id}`,
    description: `团队开通发放（${plan.tier} × ${quote.totalSeats} 席）`,
  });

  try {
    await ensurePlatformManagedKeyForTenant(tenant.id);
  } catch (e) {
    console.warn("[createTeamAction] platform team key failed", e);
  }

  // 切换到新团队空间
  cookies().set(ACTIVE_TENANT_COOKIE, tenant.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/account/team");
  return { ok: true };
}

export async function inviteMemberAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "member:invite");
  if (!perm.ok) return perm;

  try {
    await createInvite({
      tenantId,
      email: str(formData.get("email")),
      role: pickRole(str(formData.get("role"))),
      createdById: auth.userId,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function revokeInviteAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "member:manage");
  if (!perm.ok) return perm;
  try {
    await revokeInvite({ tenantId, inviteId: str(formData.get("inviteId")) });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function updateRoleAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "member:manage");
  if (!perm.ok) return perm;
  try {
    await updateMemberRole({
      tenantId,
      memberId: str(formData.get("memberId")),
      role: pickRole(str(formData.get("role"))),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function removeMemberAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "member:manage");
  if (!perm.ok) return perm;
  const dispositionRaw = str(formData.get("assetDisposition"));
  const disposition =
    dispositionRaw === "REASSIGN" || dispositionRaw === "DELETE"
      ? dispositionRaw
      : "TRANSFER_PUBLIC";
  try {
    const res = await removeMember({
      tenantId,
      memberId: str(formData.get("memberId")),
      assetDisposition: disposition,
    });
    // DELETE 处置：清理离队成员私有资产的 OSS 云端文件（best-effort）
    if (disposition === "DELETE" && res.ossUrls.length > 0) {
      await Promise.allSettled(
        res.ossUrls.map((u) => deleteManagedOssObjectByUrl(u)),
      );
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function transferOwnershipAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "tenant:transfer");
  if (!perm.ok) return perm;
  try {
    await transferOwnership({
      tenantId,
      fromUserId: auth.userId,
      toMemberId: str(formData.get("memberId")),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function updateConfigAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const perm = await requirePermission(auth.userId, tenantId, "tenant:configure");
  if (!perm.ok) return perm;
  const capRaw = str(formData.get("perSeatCapCredits"));
  try {
    await updateTenantConfig({
      tenantId,
      name: str(formData.get("name")) || undefined,
      maxConcurrency: formData.get("maxConcurrency")
        ? Math.max(1, Math.round(num(formData.get("maxConcurrency"), 2)))
        : undefined,
      perSeatCapCredits: capRaw === "" ? null : Math.max(0, Math.round(Number(capRaw))),
      seatLimit: formData.get("seatLimit")
        ? Math.max(1, Math.round(num(formData.get("seatLimit"), 1)))
        : undefined,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

export async function acceptInviteAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const member = await acceptInvite({
      token: str(formData.get("token")),
      userId: auth.userId,
    });
    cookies().set(ACTIVE_TENANT_COOKIE, member.tenantId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/account/team");
  return { ok: true };
}

/** 切换当前空间（个人/团队），写 cookie 供 TenantContext 读取。 */
export async function switchSpaceAction(formData: FormData): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const tenantId = str(formData.get("tenantId"));
  const member = await getMembership(tenantId, auth.userId);
  if (!member || member.status !== "ACTIVE") {
    return { ok: false, error: "无法切换到该空间" };
  }
  cookies().set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/account/team");
  return { ok: true };
}
