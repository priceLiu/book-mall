import { NextResponse } from "next/server";

import { getWorkflowSharePublicMeta } from "@/lib/share/workflow-share-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "无效 token" }, { status: 400 });
  }

  const meta = await getWorkflowSharePublicMeta(token);
  if (!meta) {
    return NextResponse.json({ error: "分享不存在" }, { status: 404 });
  }

  return NextResponse.json(meta);
}
