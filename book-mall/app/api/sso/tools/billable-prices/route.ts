import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

function verifyBearer(req: Request):
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse } {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 }),
    };
  }
  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return {
      ok: false,
      res: NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 }),
    };
  }
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return {
      ok: false,
      res: NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 }),
    };
  }
  return { ok: true, userId: verified.sub };
}

/**
 * 工具站「价格表」：列出当前生效的全部按次标价（与 `resolveBillablePricePoints` 同源表）。
 * 需携带工具 JWT；单价随主站「工具管理 → 按次单价」变更。
 */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const now = new Date();
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [{ toolKey: "asc" }, { action: "asc" }, { effectiveFrom: "desc" }],
    select: {
      id: true,
      toolKey: true,
      action: true,
      pricePoints: true,
      effectiveFrom: true,
      effectiveTo: true,
      note: true,
      schemeARefModelKey: true,
    },
  });

  const prices = rows.map((r) => ({
    id: r.id,
    toolKey: r.toolKey,
    action: r.action ?? "",
    pricePoints: r.pricePoints,
    yuan: Math.round(r.pricePoints) / 100,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    note: r.note ?? null,
    schemeARefModelKey: r.schemeARefModelKey ?? null,
  }));

  return NextResponse.json({ prices });
}
