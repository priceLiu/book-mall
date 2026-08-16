import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { AiSpaceBroadcastError } from "@/lib/ai-space/ai-space-broadcast-service";
import { splitBroadcastProjectWithLlm } from "@/lib/ai-space/ai-space-broadcast-split-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const project = await splitBroadcastProjectWithLlm({
      userId: auth.actor.userId,
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
    console.error("[ai-space/broadcast-projects/split] failed", e);
    const msg = e instanceof Error ? e.message : "拆镜失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
