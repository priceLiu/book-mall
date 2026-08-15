import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { reorderPins } from "@/lib/ai-space/ai-space-pin-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REORDER = 200;

/** 布置顺序：body.pinIds 为目标顺序 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const raw = body.pinIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "pinIds 须为数组" }, { status: 400 });
  }
  const pinIds = raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_REORDER);
  if (pinIds.length === 0) {
    return NextResponse.json({ error: "pinIds 为空" }, { status: 400 });
  }

  try {
    await reorderPins(auth.actor.userId, pinIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/pins/reorder] PATCH failed", e);
    return NextResponse.json({ error: "排序失败" }, { status: 500 });
  }
}
