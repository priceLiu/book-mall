import { NextResponse } from "next/server";

import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import { getQrTemplateById } from "@/lib/quick-replica/qr-template-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const template = await getQrTemplateById(auth.userId, id);
  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }
  return NextResponse.json({ template });
}
