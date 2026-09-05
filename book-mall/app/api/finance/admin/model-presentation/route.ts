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
  listCatalogPresentationForAdmin,
  updateCatalogSourceLabels,
} from "@/lib/platform-model/app-model-shelf";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "模型运营中心仅财务管理员可见");
  }

  const catalogs = await listCatalogPresentationForAdmin();
  return financeJson(request, { catalogs });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要定价管理员权限");
  }

  let body: {
    updates?: Array<{ canonicalModelKey: string; sourceLabel: string | null }>;
    batchKieToThirdParty?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return financeJson(request, { ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.batchKieToThirdParty) {
      const catalogs = await listCatalogPresentationForAdmin();
      const kieRoutes = await import("@/lib/prisma").then(({ prisma }) =>
        prisma.gatewayModelRoute.findMany({
          where: { active: true, providerKind: "KIE" },
          select: { canonicalModelKey: true },
          distinct: ["canonicalModelKey"],
        }),
      );
      const kieKeys = new Set(kieRoutes.map((r) => r.canonicalModelKey));
      const updates = catalogs
        .filter((c) => kieKeys.has(c.canonicalModelKey))
        .map((c) => ({ canonicalModelKey: c.canonicalModelKey, sourceLabel: "第三方" }));
      const count = await updateCatalogSourceLabels(updates);
      return financeJson(request, { ok: true, count });
    }

    if (body.updates?.length) {
      const count = await updateCatalogSourceLabels(body.updates);
      return financeJson(request, { ok: true, count });
    }

    return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
  } catch (e) {
    return financeJson(
      request,
      { ok: false, error: e instanceof Error ? e.message : "更新失败" },
      { status: 400 },
    );
  }
}
