import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { importAdminPendingFeaturesFromDocs } from "@/lib/admin/pending-feature-service";

export const dynamic = "force-dynamic";

/** POST · 从仓库 docs/ 导入全部 .md 为待做项（docPath 已存在则跳过） */
export async function POST() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const result = await importAdminPendingFeaturesFromDocs();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导入失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
