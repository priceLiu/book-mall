import { NextResponse } from "next/server";

import { generatePlatformTtsAudioUrl } from "@/lib/media/platform-tts-generate";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  voice?: string;
  modelKey?: string;
};

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const text = body?.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "缺少 text" }, { status: 400 });
  }

  try {
    const audioUrl = await generatePlatformTtsAudioUrl({
      userId: auth.userId,
      text,
      voice: body?.voice,
      modelKey: body?.modelKey,
    });
    return NextResponse.json({ audioUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS 生成失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
