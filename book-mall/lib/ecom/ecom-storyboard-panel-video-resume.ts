import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  clearStoryboardPanelVideosPending,
  readStoryboardPendingPanelVideos,
  type StoryboardPendingPanelVideoEntry,
} from "@/lib/ecom/ecom-storyboard-pending-videos";
import { readGatewayLogVideoOutputUrl, extractVideoUrlFromGatewayLogSummary } from "@/lib/ecom/ecom-gateway-log-video-url";
import { persistStoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import { mergeStoryboardPanelMediaByIndex } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import { ECOM_STORYBOARD_MODULE } from "@/lib/ecom/ecom-storyboard-types";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  ecomGwPollDashscope,
  ecomGwPollKie,
  ecomGwPollMinimax,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { ecomPollBailianR2vInProcess } from "@/lib/gateway/gateway-v1-ecom-poll-service";
import { ensureGatewayLogSucceededAfterVendorUrl } from "@/lib/gateway/gateway-log-reconcile";

export async function persistStoryboardPanelVideoResult(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  panelIndex: number;
  modelKey: string;
  prompt: string;
  videoUrl: string;
  taskId: string;
  logId: string;
  durationSec: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
}): Promise<void> {
  const res = await fetch(opts.videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  const patchPanels = opts.sheet.panels.map((p) =>
    p.index === opts.panelIndex
      ? {
          ...p,
          videoUrl: ossUrl,
          videoGen: {
            modelKey: opts.modelKey,
            durationSec: opts.durationSec,
            resolution: opts.resolution,
            aspectRatio: opts.aspectRatio,
            generatedAt: new Date().toISOString(),
          },
        }
      : p,
  );

  const latest = await getEcomStoryboardProject(opts.userId, opts.projectId, {
    resumePendingVideos: false,
  });
  const baseSheet = latest?.sheet ?? opts.sheet;
  const mergedPanels = mergeStoryboardPanelMediaByIndex(
    baseSheet.panels,
    patchPanels,
  );
  await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    sheet: { ...baseSheet, panels: mergedPanels },
    status: "image_ready",
  });

  await ensureGatewayLogSucceededAfterVendorUrl({
    logId: opts.logId,
    taskId: opts.taskId,
    videoUrl: ossUrl,
  }).catch(() => undefined);

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "video",
      title: `${opts.sheet.overview.title} · 镜头${opts.panelIndex}`.slice(0, 80),
      prompt: opts.prompt,
      ossUrl,
      meta: {
        projectId: opts.projectId,
        panelIndex: opts.panelIndex,
        modelKey: opts.modelKey,
        kind: "panel_video",
        taskId: opts.taskId,
        logId: opts.logId,
        durationSec: opts.durationSec,
        resolution: opts.resolution,
        aspectRatio: opts.aspectRatio,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await persistStoryboardDeliverableSnapshot({
    userId: opts.userId,
    projectId: opts.projectId,
  }).catch(() => undefined);

  await clearStoryboardPanelVideosPending(opts.projectId, [opts.panelIndex]);
}

async function pollPendingPanelVideoOnce(
  userId: string,
  entry: StoryboardPendingPanelVideoEntry,
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const taskId = entry.taskId?.trim();
  const logId = entry.logId?.trim();
  const provider = entry.pollProvider;
  if (!taskId || !logId || !provider) {
    return { status: "PENDING" };
  }

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      status: true,
      failMessage: true,
      resultSummary: true,
      providerKind: true,
    },
  });

  if (log?.status === "FAILED") {
    return {
      status: "FAILED",
      failMessage: log.failMessage?.trim() || "视频任务失败",
    };
  }

  if (log?.status === "SUCCEEDED") {
    const fromSummary = extractVideoUrlFromGatewayLogSummary(log.resultSummary, {
      pollProvider: provider,
      providerKind: log.providerKind,
    });
    if (fromSummary) return { status: "SUCCEEDED", outputUrl: fromSummary };
  }

  const fromLog = await readGatewayLogVideoOutputUrl({
    logId,
    pollProvider: provider,
  });
  if (fromLog) return { status: "SUCCEEDED", outputUrl: fromLog };

  await assertEcomToolkitGatewayAccess(userId);

  if (provider === "bailian") {
    const auth = await resolveEcomGatewayAuthForUser(userId);
    if (!auth) throw new Error("Gateway 未配置");
    return ecomPollBailianR2vInProcess(auth, { taskId, gatewayLogId: logId });
  }
  if (provider === "volcengine") {
    return ecomGwPollVolcengine(userId, { taskId, gatewayLogId: logId });
  }
  if (provider === "dashscope") {
    return ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
  }
  if (provider === "kie") {
    return ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
  }
  if (provider === "minimax") {
    return ecomGwPollMinimax(userId, { taskId, gatewayLogId: logId });
  }
  return { status: "PENDING" };
}

/** GET 项目时续查 pending 单镜视频（单次 poll / 镜） */
export async function resumeStoryboardPendingPanelVideos(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const row = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId, userId },
    select: { sheet: true, meta: true },
  });
  if (!row) return false;

  const pending = readStoryboardPendingPanelVideos(row.meta);
  const keys = Object.keys(pending);
  if (keys.length === 0) return false;

  const sheetParsed = row.sheet;
  if (!sheetParsed || typeof sheetParsed !== "object") return false;
  const sheet = sheetParsed as StoryboardSheet;

  let changed = false;
  for (const key of keys) {
    const panelIndex = Number.parseInt(key, 10);
    const entry = pending[key];
    if (!Number.isFinite(panelIndex) || !entry?.taskId?.trim()) continue;

    const panel = sheet.panels.find((p) => p.index === panelIndex);
    if (panel?.videoUrl?.trim()) {
      await clearStoryboardPanelVideosPending(projectId, [panelIndex]);
      changed = true;
      continue;
    }

    const polled = await pollPendingPanelVideoOnce(userId, entry);
    if (polled.status === "SUCCEEDED" && polled.outputUrl?.trim()) {
      const modelKey = entry.modelKey?.trim() ?? "happyhorse-1.1-r2v";
      try {
        await persistStoryboardPanelVideoResult({
          userId,
          projectId,
          sheet,
          panelIndex,
          modelKey,
          prompt: entry.prompt?.trim() ?? panel?.videoPromptEn?.trim() ?? "",
          videoUrl: polled.outputUrl.trim(),
          taskId: entry.taskId!.trim(),
          logId: entry.logId!.trim(),
          durationSec: entry.durationSec ?? panel?.durationHintSec ?? 3,
          resolution: entry.resolution ?? "1080p",
          aspectRatio: entry.aspectRatio === "16:9" ? "16:9" : "9:16",
        });
        changed = true;
      } catch (e) {
        console.warn(
          "[ecom-storyboard-panel-video-resume] panel",
          panelIndex,
          e instanceof Error ? e.message : String(e),
        );
      }
      continue;
    }
    if (polled.status === "FAILED") {
      await clearStoryboardPanelVideosPending(projectId, [panelIndex]);
      changed = true;
    }
  }

  return changed;
}
