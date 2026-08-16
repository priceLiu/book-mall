import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { lookupTemplateGalleryBySourceQuery } from "@/lib/ecom/ecom-template-gallery-service";

export const dynamic = "force-dynamic";

/** 按 yibaiaigc 源链接 / UUID 反查模板区 catalog（跨品类） */
export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "缺少 q" }, { status: 400 });
  }

  try {
    const result = await lookupTemplateGalleryBySourceQuery(q);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ stem: result.stem, templates: result.entries });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
