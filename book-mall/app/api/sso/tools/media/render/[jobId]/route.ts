import { NextResponse } from "next/server";

import { getMediaRenderJobForUser } from "@/lib/media/media-render-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  const job = await getMediaRenderJobForUser(jobId, auth.userId);
  if (!job) {
    return NextResponse.json({ error: "剪辑任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
