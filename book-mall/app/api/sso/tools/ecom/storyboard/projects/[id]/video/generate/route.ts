import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { ecomSubmitStoryboardFullVideoJob } from "@/lib/ecom/ecom-storyboard-video";
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
    /* defaults */
  }

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜故事版" }, { status: 400 });
  }
  if (!project.sheetPngUrl) {
    return NextResponse.json({ error: "请先生成故事版 PNG" }, { status: 400 });
  }

  const durationSec =
    typeof body.durationSec === "number" ? body.durationSec : undefined;
  const aspectRatio =
    body.aspectRatio === "16:9" ||
    body.aspectRatio === "9:16" ||
    body.aspectRatio === "1:1"
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
  const ratio =
    typeof body.ratio === "string" && body.ratio.trim() ? body.ratio.trim() : undefined;
  const seedStr =
    typeof body.seedStr === "string" ? body.seedStr : undefined;
  const promptExtend =
    typeof body.promptExtend === "boolean" ? body.promptExtend : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    const result = await ecomSubmitStoryboardFullVideoJob({
      userId: auth.userId,
      projectId,
      sheet: project.sheet,
      sheetPngUrl: project.sheetPngUrl,
      references: project.references,
      durationSec,
      aspectRatio,
      resolution,
      modelKey,
      ratio,
      seedStr,
      promptExtend,
      brief: {
        productHighlight:
          typeof project.brief?.productHighlight === "string"
            ? project.brief.productHighlight
            : project.sheet.overview.productHighlight,
        style:
          typeof project.brief?.style === "string"
            ? project.brief.style
            : undefined,
      },
    });

    return NextResponse.json({
      status: "running",
      taskId: result.taskId,
      logId: result.logId,
      startedAt: result.startedAt,
      reused: result.reused,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "视频生成失败";
    const status = message.includes("余额") ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
