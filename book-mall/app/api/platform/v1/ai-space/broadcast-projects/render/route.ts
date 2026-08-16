import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { AiSpaceBroadcastError } from "@/lib/ai-space/ai-space-broadcast-service";
import { renderBroadcastProject } from "@/lib/ai-space/ai-space-broadcast-render-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const project = await renderBroadcastProject({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      projectId: id,
    });
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-projects/render] failed", e);
    const msg = e instanceof Error ? e.message : "渲染失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
