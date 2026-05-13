"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("无权操作");
  }
}

export async function updatePlatformBillingConfig(formData: FormData) {
  await assertAdmin();
  const num = (k: string) => {
    const v = formData.get(k);
    const n = v == null || v === "" ? NaN : Number(v);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`无效整数: ${k}`);
    }
    return n;
  };

  await prisma.platformConfig.update({
    where: { id: "default" },
    data: {
      minBalanceLineMinor: num("minBalanceLineMinor"),
      balanceWarnHighMinor: num("balanceWarnHighMinor"),
      balanceWarnMidMinor: num("balanceWarnMidMinor"),
      llmInputPer1kTokensMinor: num("llmInputPer1kTokensMinor"),
      llmOutputPer1kTokensMinor: num("llmOutputPer1kTokensMinor"),
      toolInvokePerCallMinor: num("toolInvokePerCallMinor"),
      usageAnomalyRatioPercent: num("usageAnomalyRatioPercent"),
    },
  });
  revalidatePath("/admin/billing");
  revalidatePath("/admin/platform");
}

export async function updateSubscriptionPlanPrice(formData: FormData) {
  await assertAdmin();
  const planId = String(formData.get("planId") ?? "");
  const priceMinor = Number(formData.get("priceMinor"));
  if (!planId || !Number.isInteger(priceMinor) || priceMinor < 0) {
    throw new Error("无效的套餐或价格");
  }
  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: { priceMinor },
  });
  revalidatePath("/admin/billing");
}

export async function updateSubscriptionPlanToolsAllowlist(formData: FormData) {
  await assertAdmin();
  const planId = String(formData.get("planId") ?? "").trim();
  if (!planId) throw new Error("无效的套餐");

  const mode = String(formData.get("toolsAllowMode") ?? "all");
  const allowed = new Set<string>(TOOL_SUITE_NAV_KEYS);

  let keys: string[] = [];
  if (mode === "pick") {
    for (const x of formData.getAll("toolsNavKey")) {
      if (typeof x !== "string") continue;
      const k = x.trim();
      if (allowed.has(k)) keys.push(k);
    }
    if (keys.length === 0) {
      throw new Error("自定义模式下请至少选择一个工具套件分组");
    }
  }

  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: { toolsNavAllowlist: keys },
  });
  revalidatePath("/admin/billing");
}

export async function extendActiveSubscription(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const days = Number(formData.get("days"));
  if (!email || !Number.isInteger(days) || days <= 0 || days > 3650) {
    throw new Error("邮箱或续期天数无效");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("用户不存在");

  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: "desc" },
  });
  if (!sub) throw new Error("该用户无有效订阅");

  const newEnd = new Date(sub.currentPeriodEnd);
  newEnd.setDate(newEnd.getDate() + days);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodEnd: newEnd },
  });
  revalidatePath("/admin/billing");
}
