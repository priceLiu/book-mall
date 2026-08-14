import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ecomPollSeedVideoDirectJob,
  ecomSubmitSeedVideoDirectJob,
} from "@/lib/ecom/ecom-seed-video-direct";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  const project = await getEcomSeedVideoProject(auth.userId, projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const directVideo = project.plan?.directVideo;
  if (!directVideo?.globalPrompt?.trim()) {
    return NextResponse.json({ error: "请先完成直接成片 Prompt 策划" }, { status: 400 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : "wan3.0-video";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomSubmitSeedVideoDirectJob({
      userId: auth.userId,
      projectId,
      directVideo,
      modelKey,
      aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
      resolution: typeof body.resolution === "string" ? body.resolution : undefined,
      durationSec:
        typeof body.durationSec === "number" ? Math.trunc(body.durationSec) : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "提交失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomPollSeedVideoDirectJob({
      userId: auth.userId,
      projectId,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "轮询失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
