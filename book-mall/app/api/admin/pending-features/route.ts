import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  createAdminPendingFeature,
  listAdminPendingFeatures,
} from "@/lib/admin/pending-feature-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const completedParam = url.searchParams.get("completed");
  const completed =
    completedParam === "true"
      ? true
      : completedParam === "false"
        ? false
        : undefined;

  const items = await listAdminPendingFeatures({ completed });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title : "";
  const description =
    typeof b.description === "string" ? b.description : undefined;
  const docPath = typeof b.docPath === "string" ? b.docPath : undefined;
  const sortOrder =
    typeof b.sortOrder === "number" ? b.sortOrder : undefined;
  const listKind =
    b.listKind === "FEATURE" || b.listKind === "PENDING" ? b.listKind : undefined;

  try {
    const item = await createAdminPendingFeature({
      title,
      description,
      docPath,
      listKind,
      sortOrder,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
