import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/ecom-seed-video-types";
import {
  buildSeedVideoDirectPlanFromShots,
  ecomPollSeedVideoDirectJob,
  ecomSubmitSeedVideoDirectJob,
} from "@/lib/ecom/ecom-seed-video-direct";
import { getEcomSeedVideoProject, updateEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
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

  const project = await getEcomSeedVideoProject(auth.userId, projectId);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });

  let directVideo = project.plan?.directVideo;
  if (!directVideo?.globalPrompt?.trim()) {
    const shots = project.plan?.shots ?? [];
    if (shots.length >= 1) {
      directVideo =
        buildSeedVideoDirectPlanFromShots(shots, {
          settings: project.settings,
          stylePack: project.plan?.stylePack,
          existing: project.plan?.directVideo,
        }) ?? undefined;
    }
  }
  if (!directVideo?.globalPrompt?.trim()) {
    return ecomJson({ error: "请先完成脚本与视频 Prompt 策划" }, { status: 400 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (!project.plan?.directVideo?.globalPrompt?.trim()) {
      await updateEcomSeedVideoProject(auth.userId, projectId, {
        plan: { ...(project.plan ?? {}), directVideo },
      });
    }
    const result = await ecomSubmitSeedVideoDirectJob({
      userId: auth.userId,
      projectId,
      directVideo,
      modelKey,
      aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
      resolution: typeof body.resolution === "string" ? body.resolution : undefined,
      durationSec:
        typeof body.durationSec === "number" ? Math.trunc(body.durationSec) : undefined,
      ratio: typeof body.ratio === "string" ? body.ratio : undefined,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "提交失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await ecomPollSeedVideoDirectJob({
      userId: auth.userId,
      projectId,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "轮询失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
