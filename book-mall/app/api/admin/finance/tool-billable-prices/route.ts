import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";
import { deriveBillableRowStatus } from "@/lib/tool-billable-row-payloads";

const MAX_TAKE = 500;

function baseHeaders(request: NextRequest) {
  return { ...billingPrivateCacheHeaders("Cookie"), ...financeCorsHeaders(request) };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: baseHeaders(request) });
}

/**
 * finance-web「模型系数」页：拉取 ToolBillablePrice 行（可搜、可筛工具、可限定仅当前生效）。
 */
export async function GET(request: NextRequest) {
  const headers = baseHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers });
  }

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const toolKeyEq = (searchParams.get("toolKey") ?? "").trim();
  const scope = (searchParams.get("scope") ?? "current").trim(); // current | all
  const take = Math.min(
    MAX_TAKE,
    Math.max(1, Number.parseInt(searchParams.get("take") ?? "400", 10) || 400),
  );

  let catalogKeysForSearch: string[] = [];
  if (q.length > 0) {
    const matchedCatalog = await prisma.modelCatalog.findMany({
      where: {
        OR: [
          { vendor: { contains: q, mode: "insensitive" } },
          { vendorProductName: { contains: q, mode: "insensitive" } },
          { vendorCommodityName: { contains: q, mode: "insensitive" } },
          { vendorCommodityCode: { contains: q, mode: "insensitive" } },
          { vendorBillableItemName: { contains: q, mode: "insensitive" } },
          { vendorBillableItemCode: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
          { canonicalKey: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { canonicalKey: true },
      take: 300,
    });
    catalogKeysForSearch = matchedCatalog.map((m) => m.canonicalKey);
  }

  const now = new Date();
  const scopeWhere: Prisma.ToolBillablePriceWhereInput =
    scope === "all"
      ? {}
      : {
          active: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        };

  const searchWhere: Prisma.ToolBillablePriceWhereInput =
    q.length > 0
      ? {
          OR: [
            { toolKey: { contains: q, mode: "insensitive" } },
            { schemeARefModelKey: { contains: q, mode: "insensitive" } },
            { cloudModelKey: { contains: q, mode: "insensitive" } },
            { cloudTierRaw: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } },
            { action: { contains: q, mode: "insensitive" } },
            ...(catalogKeysForSearch.length > 0
              ? [
                  { cloudModelKey: { in: catalogKeysForSearch } },
                  { schemeARefModelKey: { in: catalogKeysForSearch } },
                ]
              : []),
          ],
        }
      : {};

  const toolWhere: Prisma.ToolBillablePriceWhereInput =
    toolKeyEq.length > 0 ? { toolKey: toolKeyEq } : {};

  const parts = [scopeWhere, searchWhere, toolWhere].filter((w) => Object.keys(w).length > 0);
  const where: Prisma.ToolBillablePriceWhereInput = parts.length === 0 ? {} : { AND: parts };

  const [toolKeyRows, priceRows] = await Promise.all([
    prisma.toolBillablePrice.findMany({
      distinct: ["toolKey"],
      select: { toolKey: true },
      orderBy: { toolKey: "asc" },
    }),
    prisma.toolBillablePrice.findMany({
      where,
      orderBy: [{ toolKey: "asc" }, { schemeARefModelKey: "asc" }, { effectiveFrom: "desc" }],
      take,
    }),
  ]);

  const catalogKeys = new Set<string>();
  for (const r of priceRows) {
    const ck = r.cloudModelKey?.trim();
    const sk = r.schemeARefModelKey?.trim();
    if (ck) catalogKeys.add(ck);
    if (sk) catalogKeys.add(sk);
  }
  const catalogs =
    catalogKeys.size > 0
      ? await prisma.modelCatalog.findMany({
          where: { canonicalKey: { in: [...catalogKeys] } },
          select: {
            canonicalKey: true,
            vendor: true,
            displayName: true,
            vendorProductName: true,
            vendorCommodityCode: true,
            vendorCommodityName: true,
            vendorBillableItemCode: true,
            vendorBillableItemName: true,
          },
        })
      : [];
  const catalogByKey = new Map(catalogs.map((c) => [c.canonicalKey, c]));

  function catalogForRow(r: (typeof priceRows)[number]) {
    const ck = r.cloudModelKey?.trim();
    if (ck) {
      const hit = catalogByKey.get(ck);
      if (hit) return hit;
    }
    const sk = r.schemeARefModelKey?.trim();
    if (sk) return catalogByKey.get(sk) ?? null;
    return null;
  }

  /**
   * 厂商「产品名称」展示：去掉从「sfm」起及其后的噪声（多为商品 Code 拼接）。
   */
  function vendorProductDisplayHeadline(raw: string): string {
    const t = raw.trim();
    if (!t) return "";
    const lower = t.toLowerCase();
    const idx = lower.indexOf("sfm");
    if (idx === -1) return t;
    if (idx === 0) return "";
    return t.slice(0, idx).replace(/[｜|]\s*$/g, "").trim();
  }

  /** 厂商产品信息：第一行=产品名称（vendorProductName 优先，否则 displayName），第二行=商品名称（vendorCommodityName）。不含商品 Code、计费项。 */
  function buildProductInfo(c: {
    displayName: string;
    vendorProductName: string | null;
    vendorCommodityCode: string | null;
    vendorCommodityName: string | null;
    vendorBillableItemCode: string | null;
    vendorBillableItemName: string | null;
  }): string {
    const productLine = vendorProductDisplayHeadline(
      (c.vendorProductName?.trim() || c.displayName?.trim() || "").trim(),
    );
    const commodityLine = (c.vendorCommodityName?.trim() || "").trim();

    if (productLine && commodityLine) return `${productLine}\n${commodityLine}`;
    if (productLine) return productLine;
    if (commodityLine) return commodityLine;
    return "—";
  }

  const out = priceRows.map((r) => {
    const cat = catalogForRow(r);
    return {
      id: r.id,
      toolKey: r.toolKey,
      action: r.action,
      schemeARefModelKey: r.schemeARefModelKey,
      cloudModelKey: r.cloudModelKey,
      cloudTierRaw: r.cloudTierRaw,
      cloudBillingKind: r.cloudBillingKind,
      cloudVendor: cat?.vendor ?? null,
      productInfo: cat ? buildProductInfo(cat) : null,
      schemeAUnitCostYuan: r.schemeAUnitCostYuan,
      schemeAAdminRetailMultiplier: r.schemeAAdminRetailMultiplier,
      pricePoints: r.pricePoints,
      active: r.active,
      status: deriveBillableRowStatus(r, now),
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString() ?? null,
      note: r.note,
    };
  });

  return NextResponse.json(
    {
      toolKeys: toolKeyRows.map((t) => t.toolKey),
      rows: out,
      truncated: priceRows.length >= take,
    },
    { headers },
  );
}
