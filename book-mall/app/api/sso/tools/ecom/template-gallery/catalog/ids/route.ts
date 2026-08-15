import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { listTemplateGalleryEntryIdsFromDb } from "@/lib/ecom/ecom-template-gallery-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/**
 * 已入库 id 清单：导入弹层去重与断点续传核对的权威来源。
 * 失败必须返回 500，客户端据此提示「无法判定重复」，不可当作「都没导入过」。
 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const category =
      new URL(req.url).searchParams.get("category")?.trim() || undefined;
    const ids = await listTemplateGalleryEntryIdsFromDb(category);
    return NextResponse.json({ category: category ?? null, ids });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
