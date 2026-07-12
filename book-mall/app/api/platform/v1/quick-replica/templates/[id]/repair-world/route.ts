import { NextResponse } from "next/server";

import { qrRepairWorldTemplateById } from "@/lib/quick-replica/qr-world-service";
import { requireQuickReplicaUser } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const result = await qrRepairWorldTemplateById(auth.userId, id);
    if (!result.template) {
      return NextResponse.json(
        { error: result.error ?? "无法修复场景元数据" },
        { status: 400 },
      );
    }
    return NextResponse.json({ template: result.template });
  } catch (e) {
    const message = e instanceof Error ? e.message : "修复失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
