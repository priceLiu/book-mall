import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { listAiSpaceUploads } from "@/lib/ai-space/ai-space-uploads-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 本地上传素材汇总（音频 / 视频 / 数字人形象） */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  try {
    const items = await listAiSpaceUploads(auth.actor.userId);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[ai-space/uploads] GET failed", e);
    return NextResponse.json({ error: "读取上传素材失败" }, { status: 500 });
  }
}
