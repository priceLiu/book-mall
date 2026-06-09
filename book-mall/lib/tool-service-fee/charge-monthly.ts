import {
  consumeCredits,
  getCreditBalance,
} from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";
import {
  TOOL_SUITE_NAV_KEYS,
  type ToolSuiteNavKey,
} from "@/lib/tool-suite-nav-keys";
import { TOOL_SERVICE_FEE_PERIOD_DAYS } from "@/lib/tool-service-fee/config";

export type ActivateToolServiceFeeResult =
  | {
      ok: true;
      toolNavKey: ToolSuiteNavKey;
      periodEnd: Date;
      chargedPoints: number;
      periodId: string;
    }
  | { ok: false; code: "plan_not_found" | "plan_inactive" | "invalid_nav_key" | "insufficient_balance"; message: string; requiredPoints?: number };

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export async function listActiveToolServiceFeePlans() {
  return prisma.toolServiceFeePlan.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { toolNavKey: "asc" }],
  });
}

/**
 * 开通或续订工具技术服务费：从积分账户（通用池）扣 monthlyFeePoints 积分，延长 30 天周期。
 */
export async function activateToolServiceFee(
  userId: string,
  toolNavKeyRaw: string,
): Promise<ActivateToolServiceFeeResult> {
  const toolNavKey = toolNavKeyRaw.trim();
  if (!TOOL_SUITE_NAV_KEYS.includes(toolNavKey as ToolSuiteNavKey)) {
    return { ok: false, code: "invalid_nav_key", message: "无效的工具分组" };
  }
  const navKey = toolNavKey as ToolSuiteNavKey;

  const plan = await prisma.toolServiceFeePlan.findUnique({
    where: { toolNavKey: navKey },
  });
  if (!plan) {
    return { ok: false, code: "plan_not_found", message: "该工具尚未配置技术服务费" };
  }
  if (!plan.active) {
    return { ok: false, code: "plan_inactive", message: "该工具技术服务费已暂停开通" };
  }

  const fee = Math.max(0, plan.monthlyFeePoints);
  const now = new Date();
  const idempotencyKey = `tool-svc-fee:${userId}:${navKey}:${now.toISOString().slice(0, 13)}`;

  if (fee > 0) {
    const balance = await getCreditBalance({ ownerType: "USER", ownerId: userId });
    if (balance < fee) {
      return {
        ok: false,
        code: "insufficient_balance",
        message: `积分不足，开通 ${plan.label} 需 ${fee.toLocaleString("zh-CN")} 积分`,
        requiredPoints: fee,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userToolServicePeriod.findFirst({
        where: {
          userId,
          toolNavKey: navKey,
          status: "ACTIVE",
          periodEnd: { gt: now },
        },
        orderBy: { periodEnd: "desc" },
      });

      const base = existing && existing.periodEnd > now ? existing.periodEnd : now;
      const periodStart = existing ? existing.periodStart : now;
      const periodEnd = addDays(base, TOOL_SERVICE_FEE_PERIOD_DAYS);

      let periodId: string;
      if (existing) {
        const updated = await tx.userToolServicePeriod.update({
          where: { id: existing.id },
          data: {
            periodEnd,
            lastChargedPoints: fee,
            walletEntryId: null,
            planId: plan.id,
          },
        });
        periodId = updated.id;
      } else {
        const created = await tx.userToolServicePeriod.create({
          data: {
            userId,
            toolNavKey: navKey,
            planId: plan.id,
            periodStart,
            periodEnd,
            status: "ACTIVE",
            lastChargedPoints: fee,
            walletEntryId: null,
          },
        });
        periodId = created.id;
      }

      return {
        ok: true as const,
        toolNavKey: navKey,
        periodEnd,
        chargedPoints: fee,
        periodId,
      };
    });

    if (result.ok && fee > 0) {
      await consumeCredits({
        ref: { ownerType: "USER", ownerId: userId },
        credits: fee,
        pool: "GENERAL",
        idempotencyKey,
        description: `工具技术服务费 · ${plan.label}（${TOOL_SERVICE_FEE_PERIOD_DAYS} 天）`,
      });
    }

    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("idempotencyKey")) {
      const periods = await prisma.userToolServicePeriod.findFirst({
        where: { userId, toolNavKey: navKey, status: "ACTIVE", periodEnd: { gt: now } },
        orderBy: { periodEnd: "desc" },
      });
      if (periods) {
        return {
          ok: true,
          toolNavKey: navKey,
          periodEnd: periods.periodEnd,
          chargedPoints: periods.lastChargedPoints ?? 0,
          periodId: periods.id,
        };
      }
    }
    throw e;
  }
}
