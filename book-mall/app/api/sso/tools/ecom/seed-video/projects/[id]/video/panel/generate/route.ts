import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { ecomGenerateSeedVideoShot } from "@/lib/ecom/ecom-seed-video-video";
import { ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/ecom-seed-video-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
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
    return ecomJson({ error: "请先完成镜头表策划" }, { status: 400 });
  }

  const shotIndex =
    typeof body.shotIndex === "number" && Number.isFinite(body.shotIndex)
      ? Math.trunc(body.shotIndex)
      : NaN;
  if (!Number.isFinite(shotIndex)) {
    return ecomJson({ error: "缺少 shotIndex" }, { status: 400 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project?.settings.videoModelKey?.trim() || ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const panelImageUrl =
      typeof body.panelImageUrl === "string" && body.panelImageUrl.trim()
        ? body.panelImageUrl.trim()
        : undefined;

    const result = await ecomGenerateSeedVideoShot({
      userId: auth.userId,
      projectId,
      shotIndex,
      references: project!.references,
      shots,
      panelImageUrl,
      aspectRatio:
        body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
          ? body.aspectRatio
          : project!.settings.aspectRatio === "16:9"
            ? "16:9"
            : "9:16",
      durationSec:
        typeof body.durationSec === "number" ? Math.trunc(body.durationSec) : undefined,
      resolution: typeof body.resolution === "string" ? body.resolution : undefined,
      modelKey,
      ratio: typeof body.ratio === "string" ? body.ratio : undefined,
      generateAudio:
        typeof body.generateAudio === "boolean" ? body.generateAudio : undefined,
      skipGatewayAccessCheck: true,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
