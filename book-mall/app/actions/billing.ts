"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";

/** 客户端 form action 的统一返回结构：可被 useActionState 消费做 banner/toast 提示。 */
export type BillingActionState =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export const billingActionIdle: BillingActionState = { kind: "idle" };

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("无权操作");
  }
}

function tsCompact(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(d.getFullYear()) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export async function updatePlatformBillingConfig(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
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
        minBalanceLinePoints: num("minBalanceLinePoints"),
        balanceWarnHighPoints: num("balanceWarnHighPoints"),
        balanceWarnMidPoints: num("balanceWarnMidPoints"),
        llmInputPer1kTokensPoints: num("llmInputPer1kTokensPoints"),
        llmOutputPer1kTokensPoints: num("llmOutputPer1kTokensPoints"),
        toolInvokePerCallPoints: num("toolInvokePerCallPoints"),
        usageAnomalyRatioPercent: num("usageAnomalyRatioPercent"),
      },
    });
    revalidatePath("/admin/billing");
    revalidatePath("/admin/platform");
    return { kind: "ok", message: "计费配置已保存" };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "保存失败" };
  }
}

/**
 * 发布订阅套餐的新价格版本（停旧发新）。
 *
 * - 旧 plan：active=false、archivedAt=now、slug 改为 `${slug}__v${ts}` 让位主 slug
 * - 新 plan：复制旧 plan 的 name/interval/toolsNavAllowlist，pricePoints 用新值，
 *   parentPlanId 指向旧 plan id
 * - 老用户 Subscription.planId 仍指向旧 plan，可完整溯源当时价
 *
 * 二次确认（formData.confirm === "yes"）才执行，避免误点。
 */
export async function publishNewSubscriptionPlanVersion(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    await assertAdmin();
    const planId = String(formData.get("planId") ?? "").trim();
    const newPricePoints = Number(formData.get("newPricePoints"));
    const confirm = String(formData.get("confirm") ?? "");
    if (!planId) return { kind: "error", message: "无效的套餐" };
    if (!Number.isInteger(newPricePoints) || newPricePoints < 0) {
      return { kind: "error", message: "新价（点）必须为非负整数" };
    }
    if (confirm !== "yes") {
      return { kind: "error", message: "请勾选「我已知晓：旧版本将归档，无法恢复」" };
    }

    const source = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!source) return { kind: "error", message: "套餐不存在" };
    if (!source.active || source.archivedAt) {
      return { kind: "error", message: "该套餐已归档，无法在其之上发布新版本" };
    }
    if (source.pricePoints === newPricePoints) {
      return { kind: "error", message: "新价与当前价相同，无需发布" };
    }

    const now = new Date();
    const ts = tsCompact(now);
    const archivedSlug = `${source.slug}__v${ts}`;

    const created = await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({
        where: { id: source.id },
        data: {
          slug: archivedSlug,
          active: false,
          archivedAt: now,
        },
      });
      return tx.subscriptionPlan.create({
        data: {
          slug: source.slug,
          name: source.name,
          interval: source.interval,
          pricePoints: newPricePoints,
          active: true,
          toolsNavAllowlist: source.toolsNavAllowlist,
          parentPlanId: source.id,
        },
      });
    });

    revalidatePath("/admin/billing");
    revalidatePath("/subscribe");
    revalidatePath("/pricing-disclosure");
    revalidatePath("/");
    return {
      kind: "ok",
      message: `已发布新版本：${created.name}（${created.slug}）当前价 ${newPricePoints} 点；旧版本归档为 ${archivedSlug}`,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "发布失败" };
  }
}

export async function updateSubscriptionPlanToolsAllowlist(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    await assertAdmin();
    const planId = String(formData.get("planId") ?? "").trim();
    if (!planId) return { kind: "error", message: "无效的套餐" };

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return { kind: "error", message: "套餐不存在" };
    if (plan.archivedAt || !plan.active) {
      return { kind: "error", message: "已归档的套餐不允许修改工具范围（仅保留历史溯源）" };
    }

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
        return { kind: "error", message: "自定义模式下请至少选择一个工具套件分组" };
      }
    }

    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { toolsNavAllowlist: keys },
    });
    revalidatePath("/admin/billing");
    return {
      kind: "ok",
      message:
        mode === "all"
          ? "已保存：订阅享有全部套件分组"
          : `已保存：自定义范围（${keys.length} 个分组）`,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "保存失败" };
  }
}

export async function extendActiveSubscription(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    await assertAdmin();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const days = Number(formData.get("days"));
    if (!email || !Number.isInteger(days) || days <= 0 || days > 3650) {
      return { kind: "error", message: "邮箱或续期天数无效" };
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { kind: "error", message: "用户不存在" };

    const now = new Date();
    const sub = await prisma.subscription.findFirst({
      where: { userId: user.id, status: "ACTIVE", currentPeriodEnd: { gt: now } },
      orderBy: { currentPeriodEnd: "desc" },
    });
    if (!sub) return { kind: "error", message: "该用户无有效订阅" };

    const newEnd = new Date(sub.currentPeriodEnd);
    newEnd.setDate(newEnd.getDate() + days);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: newEnd },
    });
    revalidatePath("/admin/billing");
    return {
      kind: "ok",
      message: `已为 ${email} 延长 ${days} 天，新到期：${newEnd.toLocaleString("zh-CN")}`,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "续期失败" };
  }
}
