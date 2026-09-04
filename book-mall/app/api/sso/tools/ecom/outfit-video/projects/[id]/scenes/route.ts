import { NextResponse } from "next/server";

import { patchEcomOutfitVideoScenes } from "@/lib/ecom/ecom-outfit-video-service";
import { sanitizeOutfitSceneList } from "@/lib/ecom/video-workflow/templates/outfit-v1/parser";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const sceneList = sanitizeOutfitSceneList(body.sceneList);
  if (sceneList.length === 0) {
    return NextResponse.json({ error: "至少保留 1 个分镜" }, { status: 400 });
  }

  try {
    const project = await patchEcomOutfitVideoScenes(auth.userId, id, sceneList);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新分镜失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
