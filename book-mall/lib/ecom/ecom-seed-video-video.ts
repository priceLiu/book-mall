import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  buildCanvasVideoMinimaxInput,
  minimaxResolutionFromEcom,
} from "@/lib/gateway/minimax-video-body";
import { resolveMinimaxVideoModel } from "@/lib/gateway/minimax-video-models";
import { buildEcomStoryboardKling30DashscopeVideoJob } from "@/lib/canvas/dashscope-kling-v3-video";
import { bailianResolutionFromEcom } from "@/lib/ecom/ecom-storyboard-gen-params";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ensureStoryboardBailianR2vRefImage,
  ensureStoryboardVideoRefImage,
} from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isStoryboardKling30VideoModel,
  resolveStoryboardKieVideoUpstreamModel,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
  isStoryboardMinimaxVideoModel,
} from "@/lib/ecom/ecom-storyboard-video-models";
import { resolveStoryboardPanelVideoRefPlan, getStoryboardVideoInvokeRules } from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import { resolveEcomVideoGenerateAudio } from "@/lib/ecom/ecom-storyboard-gen-params";
import { resolveSeedVideoChatImageUrls } from "@/lib/ecom/ecom-seed-video-mention";
import {
  type SeedVideoReference,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  clearEcomSeedVideoPendingShot,
  getEcomSeedVideoProject,
  markEcomSeedVideoPendingShot,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import type { SeedVideoPanelPollProvider } from "@/lib/ecom/ecom-seed-video-panel-resume";
import { mergeSeedVideoShotsPreserveMedia } from "@/lib/ecom/ecom-seed-video-shot-merge";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_SEED_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-seed-video-types";
import {
  ecomGwCreateKieJob,
  ecomGwPrepareVideoJobLog,
  ecomGwSubmitPreparedVideoJob,
} from "@/lib/gateway/ecom-tool-gateway-client";
import type {
  GatewayV1EcomCreateTaskBody,
  PreparedGatewayV1EcomAsyncJob,
} from "@/lib/gateway/gateway-v1-ecom-async-job-service";
import { ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/ecom-seed-video-types";

type VideoResolution = "720p" | "1080p";

function resolveVideoResolution(raw?: string): VideoResolution {
  const v = raw?.trim().toLowerCase() ?? "";
  if (v.includes("720")) return "720p";
  return "1080p";
}

export async function ecomGenerateSeedVideoShot(opts: {
  userId: string;
  projectId: string;
  shotIndex: number;
  references: SeedVideoReference[];
  shots: SeedVideoShot[];
  aspectRatio?: "16:9" | "9:16";
  durationSec?: number;
  resolution?: string;
  modelKey?: string;
  ratio?: string;
  generateAudio?: boolean;
  skipGatewayAccessCheck?: boolean;
}) {
  if (!opts.skipGatewayAccessCheck) {
    await assertEcomToolkitGatewayAccess(opts.userId);
  }
  const shot = opts.shots.find((s) => s.index === opts.shotIndex);
  if (!shot) throw new Error(`找不到镜头 ${opts.shotIndex}`);

  const modelKey = resolveStoryboardVideoModel(
    opts.modelKey ?? ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
  );
  const provider = resolveStoryboardVideoProvider(modelKey);
  const resolution = resolveVideoResolution(opts.resolution);
  const generateAudio = resolveEcomVideoGenerateAudio(modelKey, opts.generateAudio);
  const durationMin = isStoryboardMinimaxVideoModel(modelKey) ? 4 : 3;
  const durationCap = 15;
  const durationSec = Math.max(
    durationMin,
    Math.min(durationCap, Math.round(opts.durationSec ?? shot.durationSec ?? 7)),
  );
  const aspectRatio = opts.aspectRatio ?? "9:16";
  const ratio = opts.ratio?.trim() || aspectRatio;
  const prompt = shot.videoPrompt.trim();
  if (!prompt) throw new Error("视频提示词不能为空");

  const refRules = getStoryboardVideoInvokeRules(modelKey);
  const refUrls = resolveSeedVideoChatImageUrls(
    opts.references,
    prompt,
    refRules.maxTotalImages,
  );
  const imageUrl = refUrls[0]?.trim();
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    throw new Error(
      `镜头 ${opts.shotIndex} 缺少参考图：请上传参考图，或在视频 Prompt 中用 @图片1 … 引用`,
    );
  }

  const materials = opts.references.filter(
    (r) => r.role === "seed-material" && r.ossUrl?.trim(),
  );
  const refUrlSet = new Set(refUrls.map((u) => u.trim()));
  const identityMaterials = materials.filter(
    (m) => refUrlSet.has(m.ossUrl.trim()) && m.ossUrl.trim() !== imageUrl,
  );

  const existingVideoUrl = shot.videoUrl?.trim();
  let gatewaySubmitted = false;

  try {
    const panelRefPlan = resolveStoryboardPanelVideoRefPlan({
      modelKey,
      references: identityMaterials.map((r) => ({
        id: r.id,
        label: r.label,
        role: "product" as const,
        ossUrl: r.ossUrl,
      })),
      panelImageUrl: imageUrl,
    });

    const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_SEED_VIDEO_TOOL_KEY);
    const rawBailianUrls = panelRefPlan.bailianAllUrls;
    const rawRefUrls = panelRefPlan.referenceImageUrls;

    let draftBody: GatewayV1EcomCreateTaskBody | null = null;
    if (provider === "bailian") {
      draftBody = {
        model: modelKey,
        bailian: {
          prompt,
          referenceImageUrls: rawBailianUrls,
          resolution: bailianResolutionFromEcom(resolution),
          ratio,
          duration: durationSec,
        },
      };
    } else if (provider === "dashscope" && isStoryboardKling30VideoModel(modelKey)) {
      draftBody = {
        model: modelKey,
        dashscope: {
          jobKind: "video",
          videoBody: {
            input: { prompt },
            parameters: { duration: durationSec, aspect_ratio: aspectRatio },
          },
        },
      };
    } else if (provider === "volcengine") {
      draftBody = {
        model: modelKey,
        input: { prompt, duration: durationSec, resolution },
      };
    } else if (provider === "minimax") {
      const minimaxRes = minimaxResolutionFromEcom(resolution);
      const { input: draftInput } = buildCanvasVideoMinimaxInput({
        modelKey,
        prompt,
        referenceImageUrls: panelRefPlan.slots.map((s) => s.url),
        options: {
          resolution: minimaxRes,
          duration: durationSec,
          ratio,
          generateAudio,
        },
      });
      draftBody = { model: modelKey, input: draftInput };
    }

    let preparedJob: PreparedGatewayV1EcomAsyncJob | null = null;
    if (draftBody) {
      const early = await ecomGwPrepareVideoJobLog(opts.userId, draftBody, clientPage);
      preparedJob = early.prepared;
    }

    const uniqueUrls = [...new Set(panelRefPlan.slots.map((s) => s.url))];
    const normalizedMap = new Map<string, string>();
    await Promise.all(
      uniqueUrls.map(async (raw) => {
        const { url: sizedUrl } =
          provider === "bailian" || provider === "dashscope"
            ? await ensureStoryboardBailianR2vRefImage({
                userId: opts.userId,
                imageUrl: raw,
                modelKey,
              })
            : await ensureStoryboardVideoRefImage({
                userId: opts.userId,
                imageUrl: raw,
              });
        normalizedMap.set(raw, sizedUrl);
      }),
    );
    const norm = (u: string) => normalizedMap.get(u) ?? u;
    const firstFrame = norm(panelRefPlan.firstFrameUrl);
    const normalizedRefUrls = panelRefPlan.referenceImageUrls.map(norm);
    const bailianUrls = panelRefPlan.bailianAllUrls.map(norm);

    let taskId: string;
    let logId: string;
    let pollProvider: SeedVideoPanelPollProvider;

    if (provider === "kie") {
      const { model, input } = buildCanvasVideoKieInput({
        modelKey: resolveStoryboardKieVideoUpstreamModel(modelKey),
        prompt,
        imageUrl: firstFrame,
        referenceImageUrls: normalizedRefUrls,
        options: { resolution, duration: durationSec, generateAudio },
        aspectRatio,
      });
      const created = await ecomGwCreateKieJob(opts.userId, { model, input, clientPage });
      taskId = created.taskId;
      logId = created.logId;
      pollProvider = "kie";
    } else if (provider === "bailian") {
      if (!preparedJob) throw new Error("Gateway 日志预创建失败");
      ({ taskId, logId } = await ecomGwSubmitPreparedVideoJob(opts.userId, preparedJob, {
        model: modelKey,
        bailian: {
          prompt,
          referenceImageUrls: bailianUrls,
          resolution: bailianResolutionFromEcom(resolution),
          ratio,
          duration: durationSec,
        },
      }));
      pollProvider = "bailian";
    } else if (provider === "dashscope" && isStoryboardKling30VideoModel(modelKey)) {
      if (!preparedJob) throw new Error("Gateway 日志预创建失败");
      const klingAspect: "16:9" | "9:16" | "1:1" =
        aspectRatio === "16:9" ? "16:9" : "9:16";
      const { model, videoBody } = buildEcomStoryboardKling30DashscopeVideoJob({
        prompt,
        firstFrameUrl: firstFrame,
        references: opts.references.map((r) => ({
          id: r.id,
          label: r.label,
          role: "product" as const,
          ossUrl: norm(r.ossUrl),
        })),
        aspectRatio: klingAspect,
        durationSec,
        sound: true,
      });
      ({ taskId, logId } = await ecomGwSubmitPreparedVideoJob(opts.userId, preparedJob, {
        model,
        dashscope: { jobKind: "video", videoBody },
      }));
      pollProvider = "dashscope";
    } else if (provider === "volcengine") {
      if (!preparedJob) throw new Error("Gateway 日志预创建失败");
      const { body } = buildCanvasVideoVolcengineInput({
        modelKey,
        prompt,
        imageUrl: firstFrame,
        referenceImageUrls: normalizedRefUrls,
        options: { resolution, duration: durationSec, generateAudio },
        aspectRatio,
      });
      ({ taskId, logId } = await ecomGwSubmitPreparedVideoJob(opts.userId, preparedJob, {
        model: modelKey,
        input: body,
      }));
      pollProvider = "volcengine";
    } else if (provider === "minimax") {
      if (!preparedJob) throw new Error("Gateway 日志预创建失败");
      const spec = resolveMinimaxVideoModel(modelKey);
      const minimaxRes = minimaxResolutionFromEcom(resolution);
      const mode = spec?.mode;
      const refUrlsForMinimax =
        mode === "r2v" || mode === "s2v" || mode === "i2v"
          ? panelRefPlan.slots.map((s) => norm(s.url))
          : normalizedRefUrls;
      const { input } = buildCanvasVideoMinimaxInput({
        modelKey,
        prompt,
        imageUrl:
          mode === "t2v" || mode === "r2v" || mode === "s2v" || mode === "i2v"
            ? undefined
            : firstFrame,
        referenceImageUrls: refUrlsForMinimax,
        options: {
          resolution: minimaxRes,
          duration: durationSec,
          ratio,
          generateAudio,
        },
      });
      ({ taskId, logId } = await ecomGwSubmitPreparedVideoJob(opts.userId, preparedJob, {
        model: modelKey,
        input,
      }));
      pollProvider = "minimax";
    } else {
      throw new Error(`单镜头成片暂不支持模型「${modelKey}」`);
    }

    gatewaySubmitted = true;
    await markEcomSeedVideoPendingShot(opts.userId, opts.projectId, shot.index, {
      modelKey,
      startedAt: new Date().toISOString(),
      taskId,
      logId,
      pollProvider,
      ...(existingVideoUrl ? { supersedesVideoUrl: existingVideoUrl } : {}),
    });

    return {
      status: "submitted" as const,
      shotIndex: shot.index,
      taskId,
      logId,
    };
  } catch (e) {
    if (!gatewaySubmitted) {
      await clearEcomSeedVideoPendingShot(opts.userId, opts.projectId, shot.index);
    }
    throw e;
  }
}

export async function persistSeedVideoPlanShots(
  userId: string,
  projectId: string,
  shots: SeedVideoShot[],
): Promise<void> {
  const project = await getEcomSeedVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const merged = mergeSeedVideoShotsPreserveMedia(shots, project.plan?.shots ?? []);
  await updateEcomSeedVideoProject(userId, projectId, {
    plan: { ...(project.plan ?? {}), shots: merged },
  });
}
