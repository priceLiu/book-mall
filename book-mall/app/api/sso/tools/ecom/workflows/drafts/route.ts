import { NextResponse } from "next/server";

import { listEcomWorkflowDrafts } from "@/lib/ecom/ecom-workflow-drafts-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    const drafts = await listEcomWorkflowDrafts(auth.userId);
    return NextResponse.json({ drafts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "暂存列表加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
