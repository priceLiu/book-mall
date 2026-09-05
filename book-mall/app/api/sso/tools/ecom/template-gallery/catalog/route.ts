import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { readTemplateGalleryCatalogLive } from "@/lib/ecom/ecom-template-gallery-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/**
 * 模板区 catalog（优先读 Prisma，空库回退 catalog.json）。
 * `?category=` 只回该分类，避免每次进页面拉全量 700KB+。
 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const category = new URL(req.url).searchParams.get("category")?.trim();
    const catalog = await readTemplateGalleryCatalogLive(category || undefined);
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
