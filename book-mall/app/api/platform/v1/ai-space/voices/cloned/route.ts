import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { listAiSpaceClonedVoices } from "@/lib/ai-space/ai-space-cloned-voices";

export const dynamic = "force-dynamic";

/** MiniMax 账号下已克隆音色（与快速复制共用 MINIMAX 凭证） */
export async function GET(request: Request) {
  const auth = await resolveAiSpaceActor(request);
  if (!auth.ok) return auth.res;

  try {
    const items = await listAiSpaceClonedVoices(auth.actor.userId);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[ai-space/voices/cloned] GET failed", e);
    return NextResponse.json({ error: "读取克隆音色失败" }, { status: 500 });
  }
}
