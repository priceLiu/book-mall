import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { readRepoDoc, getRepoDocFileTimes } from "@/lib/admin/read-repo-doc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  const path = new URL(request.url).searchParams.get("path")?.trim() ?? "";
  if (!path) {
    return NextResponse.json({ error: "缺少 path 参数" }, { status: 400 });
  }

  const content = await readRepoDoc(path);
  if (content === null) {
    return NextResponse.json(
      { error: "文档不存在或路径不允许" },
      { status: 404 },
    );
  }

  const fileTimes = await getRepoDocFileTimes(path);

  return NextResponse.json({
    path,
    content,
    docFileCreatedAt: fileTimes?.createdAt ?? null,
    docFileUpdatedAt: fileTimes?.updatedAt ?? null,
  });
}
