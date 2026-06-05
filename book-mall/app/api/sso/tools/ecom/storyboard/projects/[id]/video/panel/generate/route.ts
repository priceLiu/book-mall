import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { ecomGenerateStoryboardPanelVideo } from "@/lib/ecom/ecom-storyboard-video";
import { ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜脚本" }, { status: 400 });
  }

  const panelIndex =
    typeof body.panelIndex === "number" && Number.isFinite(body.panelIndex)
      ? Math.trunc(body.panelIndex)
      : NaN;
  if (!Number.isFinite(panelIndex)) {
    return NextResponse.json({ error: "缺少 panelIndex" }, { status: 400 });
  }

  const aspectRatio =
    body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
      ? body.aspectRatio
      : project.settings?.aspectRatio === "16:9"
        ? "16:9"
        : "9:16";
  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL;
  const resolution =
    typeof body.resolution === "string" && body.resolution.trim()
      ? body.resolution.trim()
      : undefined;
  const durationSec =
    typeof body.durationSec === "number" && Number.isFinite(body.durationSec)
      ? Math.trunc(body.durationSec)
      : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomGenerateStoryboardPanelVideo({
      userId: auth.userId,
      projectId,
      sheet: project.sheet,
      panelIndex,
      references: project.references,
      aspectRatio,
      durationSec,
      resolution,
      modelKey,
      brief: {
        productHighlight:
          typeof project.brief?.productHighlight === "string"
            ? project.brief.productHighlight
            : project.sheet.overview.productHighlight,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "分镜视频生成失败";
    const status = message.includes("余额") ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
