import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { ecomGenerateSeedVideoShotImage } from "@/lib/ecom/ecom-seed-video-shot-image";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
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

  const project = await getEcomSeedVideoProject(auth.userId, projectId, {
    resumePending: false,
  });
  const shots = project?.plan?.shots ?? [];
  if (shots.length === 0) {
    return NextResponse.json({ error: "请先完成镜头表策划" }, { status: 400 });
  }

  const shotIndex =
    typeof body.shotIndex === "number" && Number.isFinite(body.shotIndex)
      ? Math.trunc(body.shotIndex)
      : NaN;
  if (!Number.isFinite(shotIndex)) {
    return NextResponse.json({ error: "缺少 shotIndex" }, { status: 400 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomGenerateSeedVideoShotImage({
      userId: auth.userId,
      projectId,
      shotIndex,
      references: project!.references,
      shots,
      modelKey,
      imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
      aspectRatio:
        body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
          ? body.aspectRatio
          : project!.settings.aspectRatio === "16:9"
            ? "16:9"
            : "9:16",
    });
    const fresh = await getEcomSeedVideoProject(auth.userId, projectId, {
      resumePending: false,
    });
    return NextResponse.json({ ...result, project: fresh });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
