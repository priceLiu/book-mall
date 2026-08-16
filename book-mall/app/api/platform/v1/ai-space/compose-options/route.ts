import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { loadAiSpaceComposeDeskData } from "@/lib/ai-space/ai-space-compose-desk-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 合成台选材：形象 + 口播音频 + 背景视频，一次并行取全 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  try {
    const data = await loadAiSpaceComposeDeskData(auth.actor.userId);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[ai-space/compose-options] GET failed", e);
    return NextResponse.json({ error: "读取合成台选材失败" }, { status: 500 });
  }
}
