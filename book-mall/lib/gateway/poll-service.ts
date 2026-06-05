import { prisma } from "@/lib/prisma";
import type { GatewayClientSource } from "@prisma/client";
import {
  createKieTaskWithKey,
  getKieTaskWithKey,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
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
import { pollVolcengineVideoTaskForLog } from "./volcengine-jobs";
import { getDecryptedCredentialApiKey } from "./credential-service";
import { finalizeRequestLog } from "./proxy-common";

const STALE_RUNNING_NO_TASK_MS = 15 * 60 * 1000;
const STALE_RUNNING_WITH_TASK_MS = 6 * 60 * 60 * 1000;

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
    },
    data: {
      status: "FAILED",
      failCode: "STALE_TIMEOUT",
      failMessage: "任务轮询超时，请稍后重试或联系管理员",
      completedAt: new Date(),
    },
  });

  return r0.count + r1.count + r2.count;
}

export function parseGatewayClientSource(
  header: string | null | undefined,
): GatewayClientSource {
  const v = header?.toUpperCase();
  if (v === "STORY") return "STORY";
  if (v === "CANVAS") return "CANVAS";
  if (v === "TOOL") return "TOOL";
  if (v === "E_COMMERCE") return "E_COMMERCE";
  if (v === "GATEWAY_CONSOLE") return "GATEWAY_CONSOLE";
  return "EXTERNAL";
}

export async function runGatewayPollWorker(opts?: { limit?: number }) {
  await expireStaleGatewayLogs();
  const limit = opts?.limit ?? 20;
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      providerKind: {
        in: ["KIE", "BAILIAN", "DASHSCOPE", "HUNYUAN", "VOLCENGINE"],
      },
    },
    orderBy: { submittedAt: "asc" },
    take: limit,
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.externalTaskId || !row.credentialId) continue;
    const cred = await getDecryptedCredentialApiKey(row.credentialId);
    if (!cred) continue;
    try {
      if (row.providerKind === "DASHSCOPE") {
        const polled = await dashscopeGetTask({
          apiKey: cred.apiKey,
          taskId: row.externalTaskId,
        });
        await prisma.gatewayRequestLog.update({
          where: { id: row.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: { increment: 1 },
          },
        });
        if (!polled.ok) continue;
        const status = polled.output.task_status;
        if (isDashscopeTaskSuccess(status)) {
          await finalizeRequestLog(row.id, {
            status: "SUCCEEDED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            resultSummary: polled.output,
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        } else if (isDashscopeTaskFailed(status)) {
          await finalizeRequestLog(row.id, {
            status: "FAILED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            failMessage:
              polled.output.message ?? polled.output.code ?? "DashScope task failed",
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        }
        continue;
      }

      if (row.providerKind === "HUNYUAN") {
        const polled = await pollHunyuanTaskForLog({
          credentialId: row.credentialId,
          taskId: row.externalTaskId,
          model: row.model,
        });
        await prisma.gatewayRequestLog.update({
          where: { id: row.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: { increment: 1 },
          },
        });
        if (polled.state === "succeeded") {
          await finalizeRequestLog(row.id, {
            status: "SUCCEEDED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            resultSummary: polled,
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        } else if (polled.state === "failed") {
          await finalizeRequestLog(row.id, {
            status: "FAILED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            failMessage: polled.errorMessage ?? "Hunyuan 3D failed",
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        }
        continue;
      }

      if (row.providerKind === "VOLCENGINE") {
        const startedAt = row.submittedAt?.getTime() ?? Date.now();
        const done = await pollVolcengineVideoTaskForLog({
          logId: row.id,
          credentialId: row.credentialId,
          taskId: row.externalTaskId,
          startedAt,
        });
        await prisma.gatewayRequestLog.update({
          where: { id: row.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: { increment: 1 },
          },
        });
        if (done === "done") updated++;
        continue;
      }

      if (row.providerKind === "BAILIAN") {
        const polled = await bailianR2vGetTask({
          apiKey: cred.apiKey,
          taskId: row.externalTaskId,
        });
        await prisma.gatewayRequestLog.update({
          where: { id: row.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: { increment: 1 },
          },
        });
        if (!polled.ok) continue;
        const status = polled.output.task_status?.toUpperCase() ?? "";
        if (status === "SUCCEEDED" || status === "SUCCESS") {
          await finalizeRequestLog(row.id, {
            status: "SUCCEEDED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            resultSummary: polled.output,
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        } else if (
          status === "FAILED" ||
          status === "CANCELED" ||
          status === "UNKNOWN"
        ) {
          await finalizeRequestLog(row.id, {
            status: "FAILED",
            durationMs: row.submittedAt
              ? Date.now() - row.submittedAt.getTime()
              : 0,
            failMessage:
              polled.output.message ?? polled.output.code ?? "Bailian R2V failed",
            externalTaskId: row.externalTaskId,
            model: row.model,
          });
          updated++;
        }
        continue;
      }

      const rec = await getKieTaskWithKey(cred.apiKey, row.externalTaskId);
      await prisma.gatewayRequestLog.update({
        where: { id: row.id },
        data: {
          lastPolledAt: new Date(),
          pollCount: { increment: 1 },
        },
      });
      if (isKieRecordSuccess(rec.state)) {
        const durationMs = row.submittedAt
          ? Date.now() - row.submittedAt.getTime()
          : undefined;
        await finalizeRequestLog(row.id, {
          status: "SUCCEEDED",
          durationMs: durationMs ?? 0,
          vendorDurationMs:
            typeof rec.costTime === "number"
              ? Math.round(rec.costTime * 1000)
              : undefined,
          resultSummary: { state: rec.state, resultJson: rec.resultJson },
          externalTaskId: rec.taskId,
          model: rec.model || row.model,
        });
        updated++;
      } else if (isKieRecordFail(rec.state)) {
        await finalizeRequestLog(row.id, {
          status: "FAILED",
          durationMs: row.submittedAt
            ? Date.now() - row.submittedAt.getTime()
            : 0,
          failMessage: rec.failMsg ?? rec.failCode ?? "KIE task failed",
          externalTaskId: rec.taskId,
          model: rec.model || row.model,
        });
        updated++;
      }
    } catch (e) {
      console.warn("[gateway-poll]", row.id, (e as Error).message);
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
  return polled.output;
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
  return polled.output;
}

export { submitHunyuanJobForLog, pollHunyuanTaskForLog };
