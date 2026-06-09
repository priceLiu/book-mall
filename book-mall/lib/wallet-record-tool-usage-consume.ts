import type { Prisma } from "@prisma/client";
import { ModelAliasSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  consumeCredits,
  getPoolBalances,
  type AccountRef,
} from "@/lib/billing/credit-account-service";
import { settleCreditHold } from "@/lib/credit-holds";
import {
  buildToolUsageBillingLineData,
  type ToolUsagePricingSnapshot,
  type ToolUsageCanonicalHint,
  type ToolUsageUserHint,
} from "@/lib/finance/tool-usage-billing-line";
import { incrementModelUsage } from "@/lib/tool-model-usage-counter";

/**
 * v004：事务前一次 SELECT 用户的"对外标识"，注入 cloudRow 的「平台/用户名」+「平台/用户ID」。
 * User 模型当前只有 name 与 email（无 phone）；name → email 顺序兜底，都没有就退回 user id。
 */
async function resolveUserHint(userId: string): Promise<ToolUsageUserHint> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!u) return { userId, userLabel: userId };
  const label = u.name?.trim() || u.email?.trim() || userId;
  return { userId: u.id, userLabel: label };
}

/**
 * v003：把 meta 里能拿到的"内部模型字串"按优先级（modelId / tryOnModel / videoModel / textToImageModel / apiModel）
 * 逐条反查 ModelAlias → ModelCatalog；命中后把 displayName / canonicalKey / vendor 用于固化到 cloudRow。
 *
 * v008：禁止使用 `aliasValue: { in: [...] }` + `findFirst`——多值时数据库返回顺序不确定，可能命中错误目录。
 */
function schemeARefModelFromMeta(meta: Prisma.InputJsonValue | undefined): string | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const m = meta as Record<string, unknown>;
  for (const k of ["modelId", "tryOnModel", "apiModel"] as const) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

async function resolveCanonicalFromMeta(
  meta: Prisma.InputJsonValue | undefined,
): Promise<ToolUsageCanonicalHint | null> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const catalogSelect = {
    canonicalKey: true,
    displayName: true,
    vendor: true,
    vendorProductName: true,
    vendorCommodityCode: true,
    vendorCommodityName: true,
    vendorBillableItemCode: true,
    vendorBillableItemName: true,
  } as const;
  const seen = new Set<string>();
  for (const k of ["modelId", "tryOnModel", "videoModel", "textToImageModel", "apiModel"] as const) {
    const v = m[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const trimmed = v.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    const hit = await prisma.modelAlias.findFirst({
      where: {
        active: true,
        source: ModelAliasSource.INTERNAL_SCHEME_A_MODEL,
        aliasValue: trimmed,
        catalog: { active: true },
      },
      select: { catalog: { select: catalogSelect } },
    });
    const c = hit?.catalog;
    if (c) {
      return {
        canonicalKey: c.canonicalKey,
        displayName: c.displayName,
        vendor: c.vendor,
        vendorProductName: c.vendorProductName,
        vendorCommodityCode: c.vendorCommodityCode,
        vendorCommodityName: c.vendorCommodityName,
        vendorBillableItemCode: c.vendorBillableItemCode,
        vendorBillableItemName: c.vendorBillableItemName,
      };
    }
  }
  return null;
}

/**
 * 与 AI 试衣成片上报一致：`meta.taskId` 作为幂等键，避免重复扣款 / 重复流水。
 */
export function toolUsageWalletIdempotencyKey(
  toolKey: string,
  action: string,
  meta: Prisma.InputJsonValue | undefined,
): string | undefined {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const taskId = (meta as Record<string, unknown>).taskId;
  if (typeof taskId !== "string") return undefined;
  const t = taskId.trim();
  if (!t) return undefined;
  return `tool_usage:${toolKey}:${action}:${t}`;
}

export type RecordToolUsageConsumeResult =
  | { ok: true; balanceAfterPoints: number; usageEventId: string }
  | { ok: false; reason: "duplicate" }
  | {
      ok: false;
      reason: "insufficient_balance";
      balancePoints: number;
      gate?: "balance";
    };

function accountRef(userId: string): AccountRef {
  return { ownerType: "USER", ownerId: userId };
}

/**
 * 记工具扣费流水并同步扣减积分（同一事务外顺序：预占结算或实扣）。
 */
export async function recordToolUsageAndConsumeWallet(opts: {
  userId: string;
  toolKey: string;
  action: string;
  costPoints: number;
  meta: Prisma.InputJsonValue | undefined;
  pricingSnapshot?: ToolUsagePricingSnapshot;
  billedVideoSec?: number | null;
  /** 预占 holdId（taskKey）；财务 2.0 走 credit-holds */
  walletHoldId?: string | null;
}): Promise<RecordToolUsageConsumeResult> {
  const credits = Math.max(0, Math.round(opts.costPoints));
  const key = toolUsageWalletIdempotencyKey(opts.toolKey, opts.action, opts.meta);

  // v003：把 meta 里的"内部模型 id"反查 ModelCatalog（命中则把 canonical 写进 cloudRow）。
  // 事务前查询，单次 SELECT；命中 → 落地，没命中 → 走 toolKeyToLabel 兜底（与旧行为一致）。
  const canonical = await resolveCanonicalFromMeta(opts.meta);

  // v004：把 User.name/email/phone 反查为"平台/用户名"，注入 cloudRow。
  // 同样事务前 SELECT，避免每行 cloudRow 都查一次（finance-web 拉一页 50 条就是 50 次 N+1）。
  const userHint = await resolveUserHint(opts.userId);

  try {
    if (key) {
      const dup = await prisma.creditLedger.findUnique({
        where: { idempotencyKey: key },
        select: { id: true },
      });
      if (dup) return { ok: false, reason: "duplicate" };
    }

    const ref = accountRef(opts.userId);
    const pools = await getPoolBalances(ref);
    const available = pools.general.balance - pools.general.reserved;
    if (credits > 0 && available < credits && !opts.walletHoldId) {
      return {
        ok: false,
        reason: "insufficient_balance",
        balancePoints: pools.general.balance,
        gate: "balance",
      };
    }

    const canonical = await resolveCanonicalFromMeta(opts.meta);
    const userHint = await resolveUserHint(opts.userId);

    let balanceAfter = pools.general.balance;

    if (credits > 0) {
      const holdId = opts.walletHoldId?.trim();
      const settled =
        holdId != null && holdId.length > 0
          ? await settleCreditHold({
              userId: opts.userId,
              holdId,
              actualCredits: credits,
              idempotencyKey: key ?? undefined,
            })
          : false;

      if (!settled) {
        const res = await consumeCredits({
          ref,
          credits,
          pool: "GENERAL",
          idempotencyKey: key ?? undefined,
          description: `工具消耗 · ${opts.toolKey} · ${opts.action}`,
        });
        balanceAfter = res.balanceAfter;
      } else {
        const after = await getPoolBalances(ref);
        balanceAfter = after.general.balance;
      }
    }

    const ev = await prisma.toolUsageEvent.create({
      data: {
        userId: opts.userId,
        toolKey: opts.toolKey,
        action: opts.action,
        costPoints: credits,
        ...(opts.meta !== undefined ? { meta: opts.meta } : {}),
        ...(typeof opts.billedVideoSec === "number" && opts.billedVideoSec > 0
          ? { billedVideoSec: opts.billedVideoSec }
          : {}),
      },
    });

    const refModel = schemeARefModelFromMeta(opts.meta);
    if (refModel === "aitryon-refiner" && credits > 0) {
      const billed =
        opts.pricingSnapshot?.billedUnit === "张" &&
        typeof opts.pricingSnapshot.billedQty === "number" &&
        opts.pricingSnapshot.billedQty > 0
          ? opts.pricingSnapshot.billedQty
          : 1;
      await incrementModelUsage(prisma, opts.userId, "aitryon-refiner", billed);
    }

    if (credits > 0) {
      await prisma.toolBillingDetailLine.create({
        data: buildToolUsageBillingLineData({
          userId: opts.userId,
          toolKey: opts.toolKey,
          action: opts.action,
          costPoints: credits,
          meta: opts.meta,
          usageEventId: ev.id,
          createdAt: ev.createdAt,
          snap: opts.pricingSnapshot,
          canonical,
          userHint,
        }),
      });
    }

    return {
      ok: true,
      balanceAfterPoints: balanceAfter,
      usageEventId: ev.id,
    };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code)
        : "";
    if (code === "P2002" && key) {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}
