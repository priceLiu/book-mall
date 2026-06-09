import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  listPlatformOfferingsForAdmin,
  setPlatformOfferingActiveCandidate,
  setPlatformOfferingRouteLocked,
} from "@/lib/platform-model/admin-offerings";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "平台模型上架仅财务管理员可见");
  }

  const offerings = await listPlatformOfferingsForAdmin();
  return financeJson(request, { offerings });
}

export async function PATCH(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要定价管理员权限");
  }

  let body: { offeringId?: string; routeLocked?: boolean; candidateId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return financeJson(request, { ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.offeringId) {
    return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
  }

  try {
    if (body.candidateId) {
      await setPlatformOfferingActiveCandidate({
        offeringId: body.offeringId,
        candidateId: body.candidateId,
        actorUserId: user.id,
      });
    } else if (typeof body.routeLocked === "boolean") {
      await setPlatformOfferingRouteLocked({
        offeringId: body.offeringId,
        routeLocked: body.routeLocked,
        actorUserId: user.id,
      });
    } else {
      return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
    }
    return financeJson(request, { ok: true });
  } catch (e) {
    return financeJson(
      request,
      { ok: false, error: e instanceof Error ? e.message : "更新失败" },
      { status: 400 },
    );
  }
}
