import { NextResponse } from "next/server";

import {
  clearSimpleFusionComposeClipAudio,
  uploadSimpleFusionComposeClipAudio,
} from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; clipId: string }> },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, clipId } = await ctx.params;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }

  try {
    const project = await uploadSimpleFusionComposeClipAudio(
      auth.userId,
      id,
      clipId,
      file,
    );
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; clipId: string }> },
) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, clipId } = await ctx.params;

  try {
    const project = await clearSimpleFusionComposeClipAudio(auth.userId, id, clipId);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "清除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
