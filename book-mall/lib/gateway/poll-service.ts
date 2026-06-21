import { prisma } from "@/lib/prisma";
import type { GatewayClientSource } from "@prisma/client";
import { getGenerationSlowWarnMs } from "@/lib/generation/poll-config";
import { escalateSlowCanvasSubmittedTasks } from "@/lib/generation/slow-generation";
import { gatewayV1RecordInfo } from "@/lib/gateway/gateway-v1-http-client";
import { createKieTaskWithKey, getKieTaskWithKey } from "@/lib/story/kie-client";
import {
  bailianR2vCreateTask,
  bailianR2vGetTask,
} from "@/lib/canvas/canvas-video-bailian-r2v";
import {
  dashscopeCreateTryOnTask,
  dashscopeCreateVideoTask,
  dashscopeCreateKlingV3ImageTask,
  dashscopeCreateWan27ImageTask,
  dashscopeCreateWanxTask,
  dashscopeGetTask,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
} from "./dashscope-client";
import { pollHunyuanTaskForLog, submitHunyuanJobForLog } from "./hunyuan-jobs";
import { getDecryptedCredentialApiKey } from "./credential-service";

const STALE_RUNNING_NO_TASK_MS = 3 * 60 * 1000;
/** 火山视频提交失败但未写入 externalTaskId 时，尽快收口 RUNNING（高负载下 submit 可能 >90s） */
const STALE_VOLCENGINE_NO_TASK_MS = 5 * 60 * 1000;
const STALE_RUNNING_WITH_TASK_MS = 6 * 60 * 60 * 1000;
/** 火山视频任务：过长仍 RUNNING 则自动收口（避免日志页一直 running） */
const STALE_VOLCENGINE_VIDEO_MS = 90 * 60 * 1000;

/** 清理无 taskId 或超时仍 RUNNING 的日志，避免界面一直 running */
export async function expireStaleGatewayLogs(): Promise<number> {
  const now = Date.now();
  const noTaskCutoff = new Date(now - STALE_RUNNING_NO_TASK_MS);
  const withTaskCutoff = new Date(now - STALE_RUNNING_WITH_TASK_MS);

  const r0 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      OR: [
        { endpoint: { startsWith: "/debug" } },
        { endpoint: { contains: "debug" } },
      ],
    },
    data: {
      status: "FAILED",
      failCode: "DEBUG_ORPHAN",
      failMessage: "调试占位日志，非真实厂商任务",
      completedAt: new Date(),
    },
  });

  const r1 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      externalTaskId: null,
      submittedAt: { lt: noTaskCutoff },
    },
    data: {
      status: "FAILED",
      failCode: "STALE_ORPHAN",
      failMessage: "请求未成功提交厂商任务（无 taskId），已自动关闭",
      completedAt: new Date(),
    },
  });

  const r2 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      submittedAt: { lt: withTaskCutoff },
      OR: [
        { providerKind: { not: "VOLCENGINE" } },
        { requestKind: { not: "VIDEO" } },
      ],
    },
    data: {
      status: "FAILED",
      failCode: "STALE_TIMEOUT",
      failMessage: "任务轮询超时，请稍后重试或联系管理员",
      completedAt: new Date(),
    },
  });

  const volcengineNoTaskCutoff = new Date(now - STALE_VOLCENGINE_NO_TASK_MS);
  const r3a = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: null,
      submittedAt: { lt: volcengineNoTaskCutoff },
      OR: [{ failMessage: null }, { failMessage: "" }],
    },
    data: {
      status: "FAILED",
      failCode: "UPSTREAM_SUBMIT_FAILED",
      failMessage: "火山视频任务未成功提交（无厂商 taskId）",
      completedAt: new Date(),
    },
  });

  const volcengineVideoCutoff = new Date(now - STALE_VOLCENGINE_VIDEO_MS);
  const r3 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: volcengineVideoCutoff },
    },
    data: {
      status: "FAILED",
      failCode: "STALE_TIMEOUT",
      failMessage: "火山视频任务轮询超时（超过 90 分钟），请在厂商控制台核对任务状态",
      completedAt: new Date(),
    },
  });

  return r0.count + r1.count + r2.count + r3a.count + r3.count;
}

export function parseGatewayClientSource(
  header: string | null | undefined,
): GatewayClientSource {
  const v = header?.toUpperCase();
  if (v === "STORY") return "STORY";
  if (v === "CANVAS") return "CANVAS";
  if (v === "TOOL") return "TOOL";
  if (v === "E_COMMERCE") return "E_COMMERCE";
  if (v === "QUICK_REPLICA") return "QUICK_REPLICA";
  if (v === "GATEWAY_CONSOLE") return "GATEWAY_CONSOLE";
  return "EXTERNAL";
}

export async function runGatewayPollWorker(opts?: { limit?: number }) {
  try {
    await expireStaleGatewayLogs();
  } catch (e) {
    console.warn(
      "[gateway-poll] expireStaleGatewayLogs skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const esc = await escalateSlowCanvasSubmittedTasks({ limit: 10 });
    if (esc.recovered > 0) {
      console.info("[gateway-poll] slow canvas recovery", esc);
    }
  } catch (e) {
    console.warn(
      "[gateway-poll] escalateSlowCanvasSubmittedTasks skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  const limit = opts?.limit ?? 20;
  const providerKinds = ["KIE", "BAILIAN", "DASHSCOPE", "HUNYUAN", "VOLCENGINE"] as const;
  const slowCutoff = new Date(Date.now() - getGenerationSlowWarnMs());

  const slowRows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      submittedAt: { lte: slowCutoff },
      providerKind: { in: [...providerKinds] },
    },
    orderBy: { submittedAt: "asc" },
    take: limit,
  });
  const slowIds = new Set(slowRows.map((r) => r.id));
  const normalLimit = Math.max(0, limit - slowRows.length);
  const normalRows =
    normalLimit > 0
      ? await prisma.gatewayRequestLog.findMany({
          where: {
            status: "RUNNING",
            externalTaskId: { not: null },
            providerKind: { in: [...providerKinds] },
            ...(slowIds.size > 0 ? { id: { notIn: [...slowIds] } } : {}),
          },
          orderBy: [{ submittedAt: "desc" }, { pollCount: "asc" }],
          take: normalLimit,
        })
      : [];
  const rows = [...slowRows, ...normalRows];

  let updated = 0;
  for (const row of rows) {
    if (!row.externalTaskId || !row.apiKeyId) continue;
    const beforeStatus = row.status;
    try {
      await gatewayV1RecordInfo({
        apiKeyId: row.apiKeyId,
        taskId: row.externalTaskId,
      });
      await prisma.gatewayRequestLog.update({
        where: { id: row.id },
        data: {
          lastPolledAt: new Date(),
          pollCount: { increment: 1 },
        },
      });
      const after = await prisma.gatewayRequestLog.findUnique({
        where: { id: row.id },
        select: { status: true },
      });
      if (beforeStatus === "RUNNING" && after?.status !== "RUNNING") {
        updated++;
      }
    } catch {
      await prisma.gatewayRequestLog.update({
        where: { id: row.id },
        data: {
          lastPolledAt: new Date(),
          pollCount: { increment: 1 },
        },
      });
    }
  }
  return { scanned: rows.length, updated };
}

export async function submitKieJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  input: Record<string, unknown>;
  callBackUrl?: string | null;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const { taskId } = await createKieTaskWithKey(cred.apiKey, {
    model: opts.model,
    input: opts.input as never,
    callBackUrl: opts.callBackUrl ?? null,
  });
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: taskId, status: "RUNNING" },
  });
  return taskId;
}

export async function submitBailianR2vJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  prompt: string;
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  ratio: string;
  duration: number;
  seedStr?: string;
  parameterExtras?: Record<string, unknown>;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await bailianR2vCreateTask({
    apiKey: cred.apiKey,
    model: opts.model,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: opts.resolution,
    ratio: opts.ratio,
    duration: opts.duration,
    seedStr: opts.seedStr,
    parameterExtras: opts.parameterExtras,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function pollKieTaskForLog(opts: {
  logId: string;
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  return getKieTaskWithKey(cred.apiKey, opts.taskId);
}

export async function pollBailianR2vTaskForLog(opts: {
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const polled = await bailianR2vGetTask({
    apiKey: cred.apiKey,
    taskId: opts.taskId,
  });
  if (!polled.ok) throw new Error(polled.error);
  return { output: polled.output, raw: polled.raw };
}

export async function submitDashscopeTryOnJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  personImageUrl: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateTryOnTask({
    apiKey: cred.apiKey,
    model: opts.model,
    personImageUrl: opts.personImageUrl,
    topGarmentUrl: opts.topGarmentUrl,
    bottomGarmentUrl: opts.bottomGarmentUrl,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeWan27ImageJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  content: Array<{ text: string } | { image: string }>;
  size?: string;
  n?: number;
  contentOrder?: "text-first" | "images-first";
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateWan27ImageTask({
    apiKey: cred.apiKey,
    model: opts.model,
    content: opts.content,
    size: opts.size,
    n: opts.n,
    contentOrder: opts.contentOrder,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeKlingV3ImageJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  content: Array<{ text: string } | { image: string }>;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  resolution?: "1k" | "2k" | "4k";
  n?: number;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateKlingV3ImageTask({
    apiKey: cred.apiKey,
    model: opts.model,
    content: opts.content,
    aspectRatio: opts.aspectRatio,
    resolution: opts.resolution,
    n: opts.n,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeWanxJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  n: number;
  size?: string;
  refImg?: string;
  refMode?: "repaint" | "refonly";
  refStrength?: number;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateWanxTask({
    apiKey: cred.apiKey,
    model: opts.model,
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt,
    n: opts.n,
    size: opts.size,
    refImg: opts.refImg,
    refMode: opts.refMode,
    refStrength: opts.refStrength,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeVideoJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  body: Record<string, unknown>;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateVideoTask({
    apiKey: cred.apiKey,
    model: opts.model,
    body: opts.body,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function pollDashscopeTaskForLog(opts: {
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const polled = await dashscopeGetTask({
    apiKey: cred.apiKey,
    taskId: opts.taskId,
  });
  if (!polled.ok) throw new Error(polled.error);
  return { output: polled.output, raw: polled.raw };
}

export { submitHunyuanJobForLog, pollHunyuanTaskForLog };
