import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceBroadcastError,
  lockBroadcastProject,
} from "@/lib/ai-space/ai-space-broadcast-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const project = await lockBroadcastProject(auth.actor.userId, id);
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-projects/lock] failed", e);
    return NextResponse.json({ error: "锁定失败" }, { status: 500 });
  }
}
