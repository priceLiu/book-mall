import { NextResponse } from "next/server";

import { qrMaterializeGenerateJobTemplate } from "@/lib/quick-replica/qr-generate-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ logId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const { logId } = await ctx.params;
  try {
    const template = await qrMaterializeGenerateJobTemplate(auth.userId, logId);
    if (!template) {
      return NextResponse.json(
        { error: "任务未完成或无法保存，请确认生成已成功" },
        { status: 400 },
      );
    }
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
