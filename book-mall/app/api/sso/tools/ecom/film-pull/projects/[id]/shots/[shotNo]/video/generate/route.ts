import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ecomGenerateFilmPullShot } from "@/lib/ecom/ecom-film-pull-video";
import { ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/ecom-film-pull-types";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string; shotNo: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, shotNo: shotNoRaw } = await ctx.params;
  const shotNo = Number.parseInt(shotNoRaw, 10);
  if (!Number.isFinite(shotNo) || shotNo < 1) {
    return NextResponse.json({ error: "无效镜号" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const project = await getEcomFilmPullProject(auth.userId, id);
  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project?.settings.videoModelKey?.trim() || ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomGenerateFilmPullShot({
      userId: auth.userId,
      projectId: id,
      shotNo,
      modelKey,
      aspectRatio:
        body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
          ? body.aspectRatio
          : undefined,
    });
    const refreshed = await getEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ ...result, project: refreshed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
