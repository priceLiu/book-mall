import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import { bodyToFormData } from "@/lib/finance/body-to-form-data";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { prisma } from "@/lib/prisma";
import {
  deleteModelCostAction,
  upsertModelCostAction,
} from "@/app/admin/finance/credit-billing-actions";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** 模型成本与渠道折扣（仅财务/超管/legacy ADMIN 可见）。 */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "模型成本仅财务管理员可见");
  }

  const [profiles, catalogs] = await Promise.all([
    prisma.modelCostProfile.findMany({
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCatalog
      .findMany({ select: { canonicalKey: true, displayName: true }, orderBy: { canonicalKey: "asc" } })
      .catch(() => [] as { canonicalKey: string; displayName: string }[]),
  ]);

  return financeJson(request, {
    profiles: profiles.map((p) => ({
      id: p.id,
      vendor: p.vendor,
      canonicalModelKey: p.canonicalModelKey,
      channel: p.channel,
      credentialId: p.credentialId,
      unit: p.unit,
      tierRaw: p.tierRaw,
      listCostYuan: Number(p.listCostYuan),
      discountRate: Number(p.discountRate),
      netCostYuan: Number(p.netCostYuan),
      note: p.note,
      active: p.active,
    })),
    catalogKeys: catalogs.map((c) => ({ key: c.canonicalKey, name: c.displayName })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要财务管理员权限才能修改模型成本");
  }

  const body = (await request.json()) as { action: string } & Record<string, unknown>;
  const fd = bodyToFormData(body);
  const result =
    body.action === "delete"
      ? await deleteModelCostAction(fd)
      : await upsertModelCostAction(fd);
  return financeJson(request, result, { status: result.ok ? 200 : 400 });
}
