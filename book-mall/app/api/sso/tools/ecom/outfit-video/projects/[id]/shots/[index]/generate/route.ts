import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomOutfitVideoShot } from "@/lib/ecom/ecom-outfit-video-service";
import { isOutfitVideoMockAllowed } from "@/lib/ecom/ecom-outfit-video-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, index: indexRaw } = await ctx.params;
  const sceneIndex = Number.parseInt(indexRaw, 10);
  if (!Number.isFinite(sceneIndex) || sceneIndex < 1) {
    return NextResponse.json({ error: "无效镜号" }, { status: 400 });
  }

  let mock = isOutfitVideoMockAllowed();
  let videoModelKey: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      mock?: boolean;
      videoModelKey?: string;
    };
    if (typeof body.mock === "boolean") mock = body.mock;
    if (typeof body.videoModelKey === "string") videoModelKey = body.videoModelKey.trim();
  } catch {
    /* empty */
  }

  try {
    if (!mock) await assertEcomToolkitGatewayAccess(auth.userId);
    const { project, envelope } = await generateEcomOutfitVideoShot(auth.userId, id, sceneIndex, {
      mock,
      videoModelKey,
    });
    return NextResponse.json({ project, envelope, mock });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
