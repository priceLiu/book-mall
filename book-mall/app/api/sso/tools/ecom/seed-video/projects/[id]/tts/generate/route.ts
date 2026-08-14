import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomGenerateSeedVideoTts } from "@/lib/ecom/ecom-seed-video-tts";
import type { SeedVideoStylePreset } from "@/lib/ecom/ecom-seed-video-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomGenerateSeedVideoTts({
      userId: auth.userId,
      projectId,
      shotIndex:
        typeof body.shotIndex === "number" ? Math.trunc(body.shotIndex) : undefined,
      voicePreset:
        body.voicePreset === "sweet-xhs" || body.voicePreset === "sharp-douyin"
          ? (body.voicePreset as SeedVideoStylePreset)
          : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS 失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
