import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import {
  buildCanvasAiKieCallbackUrl,
} from "@/lib/canvas/canvas-constants";
import { cropCanvasGridSplitCellToOss } from "@/lib/canvas/canvas-grid-split-crop";
import { claimCanvasTaskKieSubmit, findSiblingActiveVendorJob } from "@/lib/canvas/canvas-kie-gateway-claim";
import {
  canvasGwCreateDashscopeKlingImageJob,
  canvasGwCreateDashscopeMultimodalImageSyncJob,
  canvasGwCreateDashscopeWan27ImageJob,
  canvasGwCreateHunyuanJob,
  canvasGwCreateKieJob,
  canvasGwVolcengineImageGenerations,
} from "@/lib/canvas/canvas-gateway-client";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import {
  isStoryboardDashscopeImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import {
  resolveKlingV3Resolution,
  resolveWan27ImageSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isDashscopeMultimodalImageGenModel,
  isZImageTurboModel,
} from "@/lib/gateway/qwen-image-edit-proxy";
import {
  buildVolcengineSeedreamImageCall,
  isVolcengineSeedreamImageModelKey,
} from "@/lib/gateway/volcengine-chat-models";
import {
  scheduleCanvasBufferOssBackfill,
  scheduleCanvasKieImageOssBackfill,
} from "@/lib/canvas/canvas-oss-backfill";

function resolveKlingImageAspectFromParams(
  params: Record<string, unknown>,
): "16:9" | "9:16" | "1:1" {
  const raw = String(params.aspect_ratio ?? "16:9").trim();
  if (raw === "1:1" || raw === "9:16" || raw === "16:9") return raw;
  if (raw.includes("9:16") || raw === "3:4" || raw === "2:3" || raw === "4:5") {
    return "9:16";
  }
  return "16:9";
}
import { isTransientSystemBusyError, DISPATCH_SUBMIT_TIMEOUT_MESSAGE } from "@/lib/db-tx-retry";
import { prisma } from "@/lib/prisma";
import {
  readGridSplitPrepare,
  type GridSplitPreparePayload,
} from "@/lib/canvas/canvas-traffic-kind";
import {
  clearDispatchStaleRetryInPayload,
  failCanvasTaskPreSubmitTimeout,
  isPreSubmitRetryExhausted,
  nextDispatchStaleRetryPayload,
} from "@/lib/generation/traffic-control/pre-submit-retry";
import {
  findPromotableCanvasGatewayLog,
  promoteCanvasTaskFromGatewayLog,
  resolveCanvasGatewaySubmitCollision,
} from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import { getDispatchSubmitTimeoutMs } from "@/lib/generation/traffic-control/constants";

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

function readImageUrls(payload: Record<string, unknown>): string[] {
  const raw = payload.imageUrls;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim()),
  );
}

function resolveCanvasClientPage(projectId: string, clientPage?: string): string {
  const cp = clientPage?.trim();
  if (cp) return cp;
  return `canvas/${projectId}`;
}

/** 宫格高清 · 派发前服务端裁切（PREPARING 阶段） */
export async function prepareCanvasImagePayload(input: {
  task: CanvasGenerationTask;
  payload: Record<string, unknown>;
}): Promise<{ payload: Record<string, unknown>; prepared: boolean }> {
  const imageUrls = readImageUrls(input.payload);
  const prepare = readGridSplitPrepare(input.payload);
  if (imageUrls.length > 0 || !prepare) {
    const next = { ...input.payload };
    delete next.pipelineStage;
    delete next.gridSplitPrepare;
    return { payload: next, prepared: false };
  }

  const croppedUrl = await cropCanvasGridSplitCellToOss({
    projectId: input.task.projectId,
    imageUrl: prepare.sourceUrl,
    col: prepare.col,
    row: prepare.row,
    cols: prepare.cols,
    rows: prepare.rows,
  });

  const next: Record<string, unknown> = {
    ...input.payload,
    imageUrls: [croppedUrl],
    gridSplitFrameCrop: true,
  };
  delete next.pipelineStage;
  delete next.gridSplitPrepare;
  return { payload: next, prepared: true };
}

type CanvasImageSubmitResult = {
  taskId: string;
  logId: string;
  payloadPatch: Record<string, unknown>;
  immediate?: {
    ephemeralUrl: string;
    sourceUrl?: string;
    b64?: string;
    imageCount: number;
  };
};

async function submitCanvasImageToGateway(
  task: CanvasGenerationTask & { project: { userId: string } },
  payload: Record<string, unknown>,
): Promise<CanvasImageSubmitResult> {
  const userId = task.project.userId;
  const modelKey = String(payload.modelKey ?? task.model ?? "");
  const providerId = String(payload.providerId ?? "");
  const prompt = String(payload.prompt ?? "");
  const params = (payload.params as Record<string, unknown>) ?? {};
  const imageUrls = readImageUrls(payload);
  const clientPage = resolveCanvasClientPage(
    task.projectId,
    typeof payload.clientPage === "string" ? payload.clientPage : undefined,
  );
  const sbv1Billing =
    payload.sbv1Billing && typeof payload.sbv1Billing === "object"
      ? (payload.sbv1Billing as Record<string, unknown>)
      : undefined;
  const engineKind = typeof payload.kind === "string" ? payload.kind : "image-engine";
  const callBackUrl = buildCanvasAiKieCallbackUrl("image", task.id);

  const isHunyuan =
    modelKey === "hunyuan-3d-pro" || modelKey === "hunyuan-3d-express";

  if (isVolcengineSeedreamImageModelKey(modelKey)) {
    const call = buildVolcengineSeedreamImageCall({
      prompt,
      imageUrls,
      params,
    });
    const { images, logId } = await canvasGwVolcengineImageGenerations(userId, {
      model: modelKey,
      prompt: call.prompt,
      image: call.image,
      parameters: call.parameters,
      clientPage,
      projectId: task.projectId,
      canvasTaskId: task.id,
    });
    const first = images[0];
    const url = first?.url?.trim() ?? "";
    const b64 = first?.b64?.trim() ?? "";
    if (!url && !b64) {
      throw new Error("火山方舟 Seedream 未返回可用图像");
    }
    return {
      taskId: logId,
      logId,
      payloadPatch: {
        kind: engineKind,
        prompt,
        params,
        providerId,
        modelKey,
        imageUrls,
        clientPage,
        gatewayLogId: logId,
        providerKind: "VOLCENGINE",
        syncGatewaySubmit: true,
      },
      immediate: {
        ephemeralUrl: url || `data:image/png;base64,${b64}`,
        sourceUrl: url || undefined,
        b64: url ? undefined : b64,
        imageCount: images.length,
      },
    };
  }

  if (isHunyuan) {
    const job = await canvasGwCreateHunyuanJob(userId, {
      model: modelKey,
      prompt,
      imageUrls,
      params,
      clientPage,
      projectId: task.projectId,
      canvasTaskId: task.id,
    });
    return {
      taskId: job.taskId,
      logId: job.logId,
      payloadPatch: {
        kind: engineKind,
        prompt,
        params,
        providerId,
        modelKey,
        imageUrls,
        clientPage,
        gatewayLogId: job.logId,
        providerKind: "HUNYUAN",
      },
    };
  }

  if (isStoryboardKlingImageModel(modelKey)) {
    const apiModel = resolveStoryboardKlingModel(modelKey);
    const content: Array<{ text: string } | { image: string }> =
      imageUrls.length > 0
        ? [...imageUrls.map((url) => ({ image: url })), { text: prompt }]
        : [{ text: prompt }];
    const job = await canvasGwCreateDashscopeKlingImageJob(userId, {
      model: apiModel,
      content,
      aspectRatio: resolveKlingImageAspectFromParams(params),
      resolution: resolveKlingV3Resolution(),
      n: Math.min(4, Math.max(1, Number(params.n ?? 1) || 1)),
      clientPage,
      projectId: task.projectId,
      canvasTaskId: task.id,
    });
    return {
      taskId: job.taskId,
      logId: job.logId,
      payloadPatch: {
        kind: engineKind,
        prompt,
        params,
        providerId,
        modelKey,
        imageUrls,
        clientPage,
        gatewayLogId: job.logId,
        providerKind: "DASHSCOPE",
        dashscopeJobKind: "kling-v3-image",
      },
    };
  }

  if (isDashscopeMultimodalImageGenModel(modelKey)) {
    const resolution = String(params.resolution ?? "2K");
    const size =
      resolution === "4K"
        ? "2048*2048"
        : resolution === "1K"
          ? "1024*1024"
          : "1536*1536";
    const n = Math.min(
      isZImageTurboModel(modelKey) ? 1 : 6,
      Math.max(1, Number(params.n ?? 1) || 1),
    );
    const refs =
      !isZImageTurboModel(modelKey) && imageUrls.length > 0
        ? await ensureStoryboardRefImagesForWan27({
            userId,
            urls: imageUrls.slice(0, 3),
          })
        : [];
    const content: Array<{ text: string } | { image: string }> =
      refs.length > 0
        ? [...refs.map((url) => ({ image: url })), { text: prompt }]
        : [{ text: prompt }];
    const job = await canvasGwCreateDashscopeMultimodalImageSyncJob(userId, {
      model: modelKey,
      content,
      parameters: {
        size,
        n,
        prompt_extend: isZImageTurboModel(modelKey) ? false : true,
        watermark: false,
      },
      clientPage,
      projectId: task.projectId,
      canvasTaskId: task.id,
    });
    return {
      taskId: job.taskId,
      logId: job.logId,
      payloadPatch: {
        kind: engineKind,
        prompt,
        params,
        providerId,
        modelKey,
        imageUrls,
        clientPage,
        gatewayLogId: job.logId,
        providerKind: "DASHSCOPE",
        dashscopeJobKind: "multimodal-image-sync",
      },
    };
  }

  if (isStoryboardDashscopeImageModel(modelKey)) {
    const apiModel = resolveStoryboardDashscopeModel(modelKey);
    const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(modelKey);
    const resolution = String(params.resolution ?? "2K");
    const aspectRaw = String(params.aspect_ratio ?? "1:1");
    const wanAspect: "16:9" | "9:16" =
      aspectRaw === "9:16" ||
      aspectRaw === "3:4" ||
      aspectRaw === "2:3" ||
      aspectRaw === "4:5" ||
      aspectRaw === "9:21"
        ? "9:16"
        : "16:9";
    const wan27Size =
      !wan26 && imageUrls.length === 0
        ? resolveWan27ImageSize({
            aspectRatio: wanAspect,
            imageSize:
              resolution === "4K"
                ? "4K"
                : resolution === "1K"
                  ? "1K"
                  : "2K",
          })
        : undefined;
    const refs =
      imageUrls.length > 0
        ? await ensureStoryboardRefImagesForWan27({
            userId,
            urls: imageUrls,
          })
        : [];
    const content: Array<{ text: string } | { image: string }> =
      refs.length > 0
        ? wan26
          ? [{ text: prompt }, ...refs.map((url) => ({ image: url }))]
          : [...refs.map((url) => ({ image: url })), { text: prompt }]
        : [{ text: prompt }];
    const job = await canvasGwCreateDashscopeWan27ImageJob(userId, {
      model: apiModel,
      content,
      size: wan27Size,
      n: Math.min(4, Math.max(1, Number(params.n ?? 1) || 1)),
      contentOrder: wan26 ? "text-first" : "images-first",
      clientPage,
      projectId: task.projectId,
      canvasTaskId: task.id,
    });
    return {
      taskId: job.taskId,
      logId: job.logId,
      payloadPatch: {
        kind: engineKind,
        prompt,
        params,
        providerId,
        modelKey,
        imageUrls,
        clientPage,
        gatewayLogId: job.logId,
        providerKind: "DASHSCOPE",
        dashscopeJobKind: "wan27-image",
      },
    };
  }

  const { model, input: kieInput } = buildKieImageCreateArgs({
    modelKey,
    prompt,
    imageUrls,
    params,
  });
  const job = await canvasGwCreateKieJob(userId, {
    model,
    input: kieInput as Record<string, unknown>,
    callBackUrl,
    clientPage,
    projectId: task.projectId,
    canvasTaskId: task.id,
    sbv1Billing,
  });
  return {
    taskId: job.taskId,
    logId: job.logId,
    payloadPatch: {
      kind: engineKind,
      prompt,
      params,
      providerId,
      modelKey,
      imageUrls,
      clientPage,
      gatewayLogId: job.logId,
      providerKind: "KIE",
      kieModel: model,
      kieInput,
      ...(sbv1Billing ? { sbv1Billing } : {}),
    },
  };
}

async function submitCanvasImageToGatewayWithTimeout(
  task: CanvasGenerationTask & { project: { userId: string } },
  payload: Record<string, unknown>,
): Promise<CanvasImageSubmitResult> {
  const timeoutMs = getDispatchSubmitTimeoutMs();
  return Promise.race([
    submitCanvasImageToGateway(task, payload),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(DISPATCH_SUBMIT_TIMEOUT_MESSAGE)),
        timeoutMs,
      ),
    ),
  ]);
}

export type CanvasImageDispatchDeps = {
  releaseTrafficSlot: (scopeKey: string) => Promise<void>;
  revertStuckDispatchingTask: (
    taskId: string,
    scopeKey: string,
    payload?: Record<string, unknown>,
    dispatchAfter?: Date,
  ) => Promise<void>;
  releaseGatewayVideoTrafficSlotIfOccupying: (input: {
    logId: string;
    scopeKey: string;
    fireDispatch: boolean;
  }) => Promise<unknown>;
};

/** 画布生图 · DISPATCHING 阶段提交 Gateway（含宫格 PREPARING） */
export async function dispatchCanvasImageQueuedTask(
  task: CanvasGenerationTask & { project: { userId: string } },
  scopeKey: string,
  deps: CanvasImageDispatchDeps,
): Promise<"dispatched" | "skipped" | "failed"> {
  let workingPayload = taskInputPayload(task);
  let vendorJob: { taskId: string; logId: string } | null = null;
  let claimedTask: CanvasGenerationTask | null = null;

  try {
    if (readGridSplitPrepare(workingPayload) && readImageUrls(workingPayload).length === 0) {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id, status: "DISPATCHING" },
        data: {
          inputPayload: {
            ...workingPayload,
            pipelineStage: "PREPARING",
          } as Prisma.InputJsonValue,
        },
      });
      try {
        const prepared = await prepareCanvasImagePayload({ task, payload: workingPayload });
        workingPayload = prepared.payload;
        await prisma.canvasGenerationTask.update({
          where: { id: task.id, status: "DISPATCHING" },
          data: { inputPayload: workingPayload as Prisma.InputJsonValue },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await deps.releaseTrafficSlot(scopeKey);
        if (e instanceof CanvasProjectError && e.code === "INVALID_INPUT") {
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              failCode: e.code,
              failMessage: msg.slice(0, 500),
              completedAt: new Date(),
            },
          });
          return "failed";
        }
        if (isTransientSystemBusyError(e)) {
          const { payload: retryPayload } = nextDispatchStaleRetryPayload(workingPayload);
          if (isPreSubmitRetryExhausted(retryPayload)) {
            await failCanvasTaskPreSubmitTimeout(task.id, retryPayload, {
              scopeKey,
            });
            return "failed";
          }
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "QUEUED",
              dispatchAfter: new Date(Date.now() + 5_000),
              inputPayload: retryPayload as Prisma.InputJsonValue,
            },
          });
          return "skipped";
        }
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "FAILED",
            failCode: "IMAGE_PREPARE_FAILED",
            failMessage: msg.slice(0, 500),
            completedAt: new Date(),
          },
        });
        return "failed";
      }
    }

    const claim = await claimCanvasTaskKieSubmit(task.id);
    claimedTask = claim.task;
    if (!claim.claimed) {
      await deps.releaseTrafficSlot(scopeKey);
      const p = taskInputPayload(claimedTask);
      if (!claimedTask.kieTaskId && !p.gatewayLogId) {
        await deps.revertStuckDispatchingTask(task.id, scopeKey, {
          ...p,
          gatewayKieSubmitClaimed: false,
          syncGatewaySubmit: true,
        });
      }
      return "skipped";
    }

    const collision = await resolveCanvasGatewaySubmitCollision({
      taskId: task.id,
      payload: taskInputPayload(claimedTask!),
      scopeKey,
    });
    if (collision === "dispatched") return "dispatched";
    if (collision === "in_flight") {
      await deps.releaseTrafficSlot(scopeKey);
      return "skipped";
    }

    const orphan = await findPromotableCanvasGatewayLog(task.id);
    if (orphan) {
      const promoted = await promoteCanvasTaskFromGatewayLog({
        taskId: task.id,
        payload: taskInputPayload(claimedTask!),
        logId: orphan.logId,
        externalTaskId: orphan.externalTaskId,
        scopeKey,
      });
      if (promoted) return "dispatched";
      await deps.releaseTrafficSlot(scopeKey);
      return "skipped";
    }

    const siblingVendor = await findSiblingActiveVendorJob({
      projectId: task.projectId,
      nodeId: task.nodeId,
      inputHash: task.inputHash,
      excludeTaskId: task.id,
    });
    if (siblingVendor) {
      await deps.releaseTrafficSlot(scopeKey);
      await deps.revertStuckDispatchingTask(
        task.id,
        scopeKey,
        taskInputPayload(claimedTask ?? task),
        new Date(Date.now() + 30_000),
      );
      return "skipped";
    }

    const submitPayload = taskInputPayload(claimedTask!);
    const job = await submitCanvasImageToGatewayWithTimeout(
      { ...claimedTask!, project: task.project },
      Object.keys(workingPayload).length ? workingPayload : submitPayload,
    );
    vendorJob = { taskId: job.taskId, logId: job.logId };

    if (job.immediate) {
      const submitted = await prisma.canvasGenerationTask.updateMany({
        where: { id: task.id, status: "DISPATCHING" },
        data: {
          status: "SUCCEEDED",
          ephemeralUrl: job.immediate.ephemeralUrl,
          submittedAt: new Date(),
          completedAt: new Date(),
          inputPayload: clearDispatchStaleRetryInPayload({
            ...taskInputPayload(claimedTask!),
            ...job.payloadPatch,
            gatewayKieSubmitClaimed: true,
            syncGatewaySubmit: true,
            trafficScopeKey: scopeKey,
          }) as Prisma.InputJsonValue,
          resultPayload: {
            imageCount: job.immediate.imageCount,
          } as Prisma.InputJsonValue,
        },
      });
      if (submitted.count === 0) {
        await deps.releaseTrafficSlot(scopeKey);
        return "skipped";
      }
      if (job.immediate.sourceUrl) {
        scheduleCanvasKieImageOssBackfill(
          task.id,
          job.immediate.sourceUrl,
          task.projectId,
          "node-image",
        );
      } else if (job.immediate.b64) {
        scheduleCanvasBufferOssBackfill({
          taskId: task.id,
          buf: Buffer.from(job.immediate.b64, "base64"),
          contentType: "image/png",
          kind: "node-image",
          projectId: task.projectId,
          userId: task.project.userId,
          ext: "png",
        });
      }
      await deps.releaseTrafficSlot(scopeKey);
      return "dispatched";
    }

    const submitted = await prisma.canvasGenerationTask.updateMany({
      where: { id: task.id, status: "DISPATCHING" },
      data: {
        status: "SUBMITTED",
        kieTaskId: job.taskId,
        submittedAt: new Date(),
        lastPolledAt: new Date(),
        inputPayload: clearDispatchStaleRetryInPayload({
          ...taskInputPayload(claimedTask!),
          ...job.payloadPatch,
          gatewayKieSubmitClaimed: true,
          syncGatewaySubmit: true,
          trafficScopeKey: scopeKey,
        }) as Prisma.InputJsonValue,
      },
    });
    if (submitted.count === 0) {
      await deps.releaseTrafficSlot(scopeKey);
      return "skipped";
    }

    await deps.releaseGatewayVideoTrafficSlotIfOccupying({
      logId: job.logId,
      scopeKey,
      fireDispatch: true,
    }).catch(() => undefined);

    return "dispatched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await deps.releaseTrafficSlot(scopeKey);

    if (!vendorJob && isTransientSystemBusyError(e)) {
      const isSubmitTimeout = /dispatch submit timeout/i.test(msg);
      const { payload: retryPayload } = nextDispatchStaleRetryPayload(
        taskInputPayload(claimedTask ?? task),
      );
      if (isPreSubmitRetryExhausted(retryPayload)) {
        await failCanvasTaskPreSubmitTimeout(task.id, retryPayload, {
          scopeKey,
        });
        return "failed";
      }
      await deps.revertStuckDispatchingTask(
        task.id,
        scopeKey,
        retryPayload,
        isSubmitTimeout ? new Date(Date.now() + 15_000) : undefined,
      );
      return "skipped";
    }

    const code =
      e instanceof CanvasProjectError ? e.code : "IMAGE_DISPATCH_FAILED";
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: code,
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return "failed";
  }
}

export function buildGridSplitPrepareFromNodeData(
  data: Record<string, unknown>,
): GridSplitPreparePayload | undefined {
  if (!data.pro2HdFromGridSplit) return undefined;
  const crop = data.gridSplitCrop;
  if (!crop || typeof crop !== "object" || Array.isArray(crop)) return undefined;
  const c = crop as Record<string, unknown>;
  const sourceUrl = String(data.gridSplitSourceUrl ?? data.ossUrl ?? "").trim();
  if (!/^https?:\/\//.test(sourceUrl)) return undefined;
  if (data.gridSplitFrameCrop === true) return undefined;
  return {
    sourceUrl,
    col: Number(c.col) || 0,
    row: Number(c.row) || 0,
    cols: Math.max(1, Number(c.cols) || 1),
    rows: Math.max(1, Number(c.rows) || 1),
  };
}
