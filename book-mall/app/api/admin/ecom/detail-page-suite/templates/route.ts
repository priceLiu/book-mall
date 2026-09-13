import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  copyTemplate,
  importUserTemplate,
  listDetailPageSuiteTemplates,
} from "@/lib/ecom/detail-page-suite/template-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    const items = await listDetailPageSuiteTemplates({
      platformCode: url.searchParams.get("platformCode") ?? undefined,
      categoryKey: url.searchParams.get("categoryKey") ?? undefined,
      includeDisabled: true,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "加载失败", items: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (body.action === "copy" && typeof body.sourceId === "string") {
      const item = await copyTemplate({
        sourceId: body.sourceId,
        userId: auth.userId,
        asUser: true,
        templateName: typeof body.templateName === "string" ? body.templateName : undefined,
      });
      return NextResponse.json({ item }, { status: 201 });
    }
    if (body.action === "import") {
      const item = await importUserTemplate({
        userId: auth.userId,
        payload: body.payload,
      });
      return NextResponse.json({ item }, { status: 201 });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 },
    );
  }
}
