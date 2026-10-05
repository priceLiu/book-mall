import { NextResponse } from "next/server";

import { generateSimpleFusionComposeClipTts } from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Body = { text?: string; voice?: string; modelKey?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; clipId: string }> },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, clipId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  try {
    const project = await generateSimpleFusionComposeClipTts(auth.userId, id, clipId, body);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS 失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
