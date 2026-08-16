import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { prisma } from "@/lib/prisma";

import { AiSpaceBroadcastError } from "@/lib/ai-space/ai-space-broadcast-service";
import { ttsBroadcastShot } from "@/lib/ai-space/ai-space-broadcast-render-service";
import { getAiSpaceBroadcastProject } from "@/lib/ai-space/ai-space-broadcast-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await ttsBroadcastShot({
      userId: auth.actor.userId,
      shotId: id,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      voice: typeof body.voice === "string" ? body.voice : undefined,
    });
    const shotRow = await prisma.aiSpaceBroadcastShot.findUnique({
      where: { id },
      select: { script: { select: { projectId: true } } },
    });
    const project = shotRow?.script.projectId
      ? await getAiSpaceBroadcastProject(
          auth.actor.userId,
          shotRow.script.projectId,
        )
      : null;
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-shots/tts] failed", e);
    const msg = e instanceof Error ? e.message : "TTS 失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
