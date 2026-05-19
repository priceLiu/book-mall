import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";

function baseHeaders(request: NextRequest) {
  return { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) };
}

function parsePositiveRetailMultiplier(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("零售系数须为正数");
  return n;
}

function computePricePointsStrict(costYuan: number, mult: number): number {
  if (costYuan === 0) {
    throw new Error("成本为 0 的定价行不允许改系数；请在主站停用或调整成本");
  }
  const v = Math.round(costYuan * mult * 100);
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("按 成本×系数 计算出的点数 < 1，请提高成本或系数");
  }
  return v;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: baseHeaders(request) });
}

/**
 * 只更新 `schemeAAdminRetailMultiplier`，并按 `pricePoints = round(成本×M×100)` 同步扣点标价（与主站 `createToolBillablePrice` 一致）。
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  const headers = baseHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers });
  }

  const { id } = ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400, headers });
  }

  const rawM = (body as { schemeAAdminRetailMultiplier?: unknown })?.schemeAAdminRetailMultiplier;
  let mult: number;
  try {
    mult = parsePositiveRetailMultiplier(rawM);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "系数无效";
    return NextResponse.json({ error: msg }, { status: 400, headers });
  }

  const row = await prisma.toolBillablePrice.findUnique({ where: { id: id.trim() } });
  if (!row) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404, headers });
  }

  const cost = row.schemeAUnitCostYuan;
  if (cost == null || !Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json(
      {
        error:
          "该行未配置有效成本（元），无法仅改系数；请到主站「工具应用 → 定价」完整编辑该行。",
      },
      { status: 400, headers },
    );
  }

  let pricePoints: number;
  try {
    pricePoints = computePricePointsStrict(cost, mult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "计算点数失败";
    return NextResponse.json({ error: msg }, { status: 400, headers });
  }

  const updated = await prisma.toolBillablePrice.update({
    where: { id: row.id },
    data: {
      schemeAAdminRetailMultiplier: mult,
      pricePoints,
    },
    select: {
      id: true,
      schemeAAdminRetailMultiplier: true,
      pricePoints: true,
      schemeAUnitCostYuan: true,
    },
  });

  revalidatePath("/admin/tool-apps/manage");

  return NextResponse.json(
    {
      ok: true,
      row: {
        id: updated.id,
        schemeAAdminRetailMultiplier: updated.schemeAAdminRetailMultiplier,
        pricePoints: updated.pricePoints,
        schemeAUnitCostYuan: updated.schemeAUnitCostYuan,
      },
    },
    { headers },
  );
}
