import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomGenerateStoryboardSheetImage } from "@/lib/ecom/ecom-storyboard-image";
import { StoryboardProductRefRequiredError } from "@/lib/ecom/ecom-storyboard-refs";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { syncEcomStoryboardSheetFromMeta } from "@/lib/ecom/ecom-storyboard-sheet-sync";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
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

  let project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  if (!project.sheet) {
    const synced = await syncEcomStoryboardSheetFromMeta(auth.userId, projectId);
    if (!synced.sheet) {
      return NextResponse.json(
        { error: "无法从交付内容解析结构化分镜，请让助手重新输出完整分镜表" },
        { status: 400 },
      );
    }
    project = await getEcomStoryboardProject(auth.userId, projectId);
  }
  if (!project?.sheet) {
    return NextResponse.json({ error: "请先生成分镜故事版" }, { status: 400 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const aspectRatio =
    body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
      ? body.aspectRatio
      : project.settings?.aspectRatio === "16:9"
        ? "16:9"
        : "9:16";
  const wf = project.meta?.workflow ?? {};
  const autoGenCharacter =
    body.autoGenCharacter === true ||
    wf.autoGenCharacter === true ||
    Boolean(wf.characterPresetKey);
  const panelIndex =
    typeof body.panelIndex === "number" && Number.isFinite(body.panelIndex)
      ? Math.trunc(body.panelIndex)
      : undefined;
  const imageSize =
    typeof body.imageSize === "string" && body.imageSize.trim()
      ? body.imageSize.trim()
      : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    const result = await ecomGenerateStoryboardSheetImage({
      userId: auth.userId,
      projectId,
      sheet: project.sheet,
      references: project.references,
      modelKey,
      aspectRatio,
      imageSize,
      autoGenCharacter,
      panelIndex,
    });

    return NextResponse.json({
      sheet: result.sheet,
      references: result.references,
      chargePoints: result.chargePoints,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "分镜图生成失败";
    const status =
      e instanceof StoryboardProductRefRequiredError
        ? 400
        : message.includes("余额")
          ? 402
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
