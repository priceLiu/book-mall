import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  clearPendingShotVideo,
  readPendingShotVideos,
  type SeedVideoPendingShotEntry,
} from "@/lib/ecom/ecom-seed-video-pending-shots";
import {
  ECOM_SEED_VIDEO_MODULE,
  type SeedVideoPlan,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  ecomGwPollBailianR2v,
  ecomGwPollDashscope,
  ecomGwPollKie,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { prisma } from "@/lib/prisma";

export type SeedVideoPanelPollProvider = "kie" | "bailian" | "volcengine" | "dashscope";

type PollResult =
  | { status: "running" }
  | { status: "failed"; message?: string }
  | { status: "succeeded"; outputUrl: string; taskId: string };

async function pollPendingPanelJobOnce(
  userId: string,
  entry: SeedVideoPendingShotEntry,
): Promise<PollResult> {
  const taskId = entry.taskId?.trim();
  const logId = entry.logId?.trim();
  const provider = entry.pollProvider;
  if (!taskId || !logId || !provider) return { status: "running" };

  const polled =
    provider === "kie"
      ? await ecomGwPollKie(userId, { taskId, gatewayLogId: logId })
      : provider === "bailian"
        ? await ecomGwPollBailianR2v(userId, { taskId, gatewayLogId: logId })
        : provider === "dashscope"
          ? await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId })
          : await ecomGwPollVolcengine(userId, { taskId, gatewayLogId: logId });

  if (polled.status === "FAILED") {
    return { status: "failed", message: polled.failMessage ?? "视频任务失败" };
  }
  if (polled.status === "SUCCEEDED" && polled.outputUrl?.trim()) {
    return { status: "succeeded", outputUrl: polled.outputUrl.trim(), taskId };
  }
  return { status: "running" };
}

async function persistPanelShotVideo(opts: {
  userId: string;
  projectId: string;
  shotIndex: number;
  prompt: string;
  modelKey?: string;
  taskId: string;
  outputUrl: string;
  shots: SeedVideoShot[];
}): Promise<{ ossUrl: string; plan: SeedVideoPlan }> {
  const res = await fetch(opts.outputUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  const updatedShots = opts.shots.map((s) =>
    s.index === opts.shotIndex ? { ...s, videoUrl: ossUrl, videoTaskId: opts.taskId } : s,
  );

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_SEED_VIDEO_MODULE,
      kind: "video",
      title: `种草视频 · 镜头${opts.shotIndex}`.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      meta: {
        projectId: opts.projectId,
        shotIndex: opts.shotIndex,
        modelKey: opts.modelKey,
        taskId: opts.taskId,
      },
    },
  });

  return { ossUrl, plan: { shots: updatedShots } };
}

/** GET 项目或前端轮询时：续查 pending 镜头 Gateway 任务，完成后写回 plan 并清 pending */
export async function resumePendingSeedVideoPanelShots(opts: {
  userId: string;
  projectId: string;
  meta: Record<string, unknown>;
  plan: SeedVideoPlan | null;
}): Promise<{ meta: Record<string, unknown>; plan: SeedVideoPlan | null; changed: boolean }> {
  const map = readPendingShotVideos(opts.meta);
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return { meta: opts.meta, plan: opts.plan, changed: false };
  }

  let meta = opts.meta;
  let plan = opts.plan;
  let changed = false;

  for (const key of keys) {
    const shotIndex = Number.parseInt(key, 10);
    const entry = map[key];
    if (!Number.isFinite(shotIndex) || !entry?.taskId?.trim()) continue;

    const shot = plan?.shots?.find((s) => s.index === shotIndex);
    const polled = await pollPendingPanelJobOnce(opts.userId, entry);

    if (polled.status === "running") continue;

    if (polled.status === "failed") {
      meta = clearPendingShotVideo(meta, shotIndex);
      changed = true;
      continue;
    }

    const prompt = shot?.videoPrompt?.trim() ?? "";
    const result = await persistPanelShotVideo({
      userId: opts.userId,
      projectId: opts.projectId,
      shotIndex,
      prompt,
      modelKey: entry.modelKey,
      taskId: polled.taskId,
      outputUrl: polled.outputUrl,
      shots: plan?.shots ?? [],
    });
    plan = { ...(plan ?? {}), shots: result.plan.shots };
    meta = clearPendingShotVideo(meta, shotIndex);
    changed = true;
  }

  return { meta, plan, changed };
}
