import { NextRequest } from "next/server";

import {
  adjustTrafficCredits,
  inspectCreditTraffic,
  releaseFrozenLog,
  settleFrozenLog,
  sweepCreditTraffic,
} from "@/lib/billing/credit-traffic-control";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

async function requireFinance(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return { error: financeUnauthorized(request) };
  if (!canViewFinanceCost(user.role)) {
    return { error: financeForbidden(request, "需要财务权限") };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireFinance(request);
  if (auth.error) return auth.error;
  const snapshot = await inspectCreditTraffic();
  return financeJson(request, snapshot);
}

export async function POST(request: NextRequest) {
  const auth = await requireFinance(request);
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    logId?: string;
    releaseStaleRunning?: boolean;
    ownerType?: "USER" | "TENANT";
    ownerId?: string;
    credits?: number;
    reason?: string;
    idempotencyKey?: string;
  } | null;
  if (!body?.action) return financeJson(request, { error: "缺少 action" }, { status: 400 });

  if (body.action === "sweep") {
    const result = await sweepCreditTraffic({
      releaseStaleRunning: body.releaseStaleRunning === true,
    });
    const snapshot = await inspectCreditTraffic();
    return financeJson(request, { result, snapshot });
  }

  if (body.action === "release") {
    if (!body.logId) return financeJson(request, { error: "缺少 logId" }, { status: 400 });
    const result = await releaseFrozenLog(body.logId, "疏通台：人工释放冻结");
    return financeJson(request, { result });
  }

  if (body.action === "settle") {
    if (!body.logId) return financeJson(request, { error: "缺少 logId" }, { status: 400 });
    const result = await settleFrozenLog(body.logId);
    return financeJson(request, { result });
  }

  if (body.action === "adjust") {
    if (!body.ownerType || !body.ownerId || body.credits == null || !body.reason || !body.idempotencyKey) {
      return financeJson(request, { error: "校正需要账户、积分、原因和幂等键" }, { status: 400 });
    }
    const result = await adjustTrafficCredits({
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      credits: body.credits,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      actorUserId: auth.user.id,
    });
    return financeJson(request, { result });
  }

  return financeJson(request, { error: "未知 action" }, { status: 400 });
}
