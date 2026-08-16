import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceComposeError,
  retryAiSpaceComposeTask,
} from "@/lib/ai-space/ai-space-compose-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 重试失败的合成任务 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
  }

  try {
    const task = await retryAiSpaceComposeTask(auth.actor.userId, id);
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AiSpaceComposeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/compose-tasks/retry] POST failed", e);
    const msg = e instanceof Error ? e.message : "重试失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
