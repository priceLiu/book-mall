import { NextResponse } from "next/server";

import { qrPollGenerateJob } from "@/lib/quick-replica/qr-generate-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ logId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const { logId } = await ctx.params;
  try {
    const result = await qrPollGenerateJob(auth.userId, logId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "轮询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
