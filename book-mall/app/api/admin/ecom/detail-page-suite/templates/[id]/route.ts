import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import type { DetailPageSuiteModuleDef } from "@/lib/ecom/detail-page-suite/types";
import {
  countProjectsUsingTemplate,
  deleteUserTemplate,
  getDetailPageSuiteTemplate,
  updateTemplate,
} from "@/lib/ecom/detail-page-suite/template-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const item = await getDetailPageSuiteTemplate(id);
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });
  const referenced = await countProjectsUsingTemplate(id);
  return NextResponse.json({ item, referenced });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const item = await updateTemplate(id, {
      ...(typeof body.templateName === "string" ? { templateName: body.templateName } : {}),
      ...(typeof body.categoryLabel === "string" ? { categoryLabel: body.categoryLabel } : {}),
      ...(typeof body.status === "string"
        ? { status: body.status === "disable" ? "disable" : "enable" }
        : {}),
      ...(body.remark !== undefined
        ? { remark: typeof body.remark === "string" ? body.remark : null }
        : {}),
      ...(Array.isArray(body.modules)
        ? { modules: body.modules as DetailPageSuiteModuleDef[] }
        : {}),
    }, { allowSystem: true });
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    const status = msg === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const result = await deleteUserTemplate(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除失败";
    const status = msg === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
