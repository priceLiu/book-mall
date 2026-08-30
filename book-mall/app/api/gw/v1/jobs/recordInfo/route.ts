import { NextResponse, type NextRequest } from "next/server";
import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import {
  buildGatewayLogProgressSummary,
  touchGatewayLogProgress,
} from "@/lib/gateway/log-progress";
import { persistVolcengineTimingOnPoll, finalizeVolcengineVideoRequestLog } from "@/lib/gateway/log-volcengine-timing-persist";
import { readVolcengineTimingTrace } from "@/lib/gateway/log-volcengine-timing";
import {
  persistDashscopeTimingOnPoll,
  finalizeDashscopeAsyncRequestLog,
} from "@/lib/gateway/log-dashscope-timing-persist";
import { readDashscopeTimingTrace } from "@/lib/gateway/log-dashscope-timing";
import { inferGatewayFailCode } from "@/lib/gateway/log-fail-code";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";
import {
  extractKieResultUrl,
  isKieRecordComplete,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
import {
  pollBailianR2vTaskForLog,
  pollDashscopeTaskForLog,
  pollHunyuanTaskForLog,
  pollKieTaskForLog,
} from "@/lib/gateway/poll-service";
import { pollTopazVideoTaskForLog } from "@/lib/gateway/topaz-jobs";
import { pollMinimaxVideoTaskStatus } from "@/lib/gateway/minimax-video-jobs";
import {
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
} from "@/lib/gateway/dashscope-client";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskInProgress,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import { extractBailianR2vVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-video-bailian-r2v";
import type { GatewayRequestLog } from "@prisma/client";
import type { DashscopeTaskOutput } from "@/lib/gateway/dashscope-client";
import { readVendorRequestIdFromJson } from "@/lib/gateway/vendor-request-id";
import { dashscopeVideoFinalizeExtras } from "@/lib/gateway/dashscope-video-finalize-extras";

async function syncDashscopePollToGatewayLog(input: {
  log: GatewayRequestLog;
  taskId: string;
  output: DashscopeTaskOutput | Record<string, unknown>;
  raw: unknown;
  providerKind: "DASHSCOPE" | "BAILIAN";
}): Promise<void> {
  const { log, taskId, output, raw, providerKind } = input;
  const status = String(
    (output as DashscopeTaskOutput).task_status ?? "RUNNING",
  );
  const polledAtMs = Date.now();

  if (isDashscopeTaskSuccess(status)) {
    const baseSummary = buildGatewayTaskResultSummary(raw, output);
    const videoExtras = dashscopeVideoFinalizeExtras(log, baseSummary);
    const { resultSummary } = await persistDashscopeTimingOnPoll({
      log,
      vendorStatus: status,
      vendorOutput: output,
      resultSummaryOverride: videoExtras.resultSummary,
    });
    const trace = readDashscopeTimingTrace(resultSummary);
    const tierRaw = videoExtras.pricingTierRaw;
    if (trace) {
      await finalizeDashscopeAsyncRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "SUCCEEDED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        externalTaskId: taskId,
        model: log.model,
        pricingTierRaw: tierRaw,
      });
    } else {
      const vendorRequestId =
        readVendorRequestIdFromJson(baseSummary) ?? undefined;
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: log.submittedAt
          ? polledAtMs - log.submittedAt.getTime()
          : 0,
        completedAt: new Date(polledAtMs),
        resultSummary: videoExtras.resultSummary,
        externalTaskId: taskId,
        model: log.model,
        pricingTierRaw: tierRaw,
        ...(vendorRequestId ? { vendorRequestId } : {}),
      });
    }
    return;
  }

  if (isDashscopeTaskFailed(status)) {
    const out = output as DashscopeTaskOutput;
    const { resultSummary } = await persistDashscopeTimingOnPoll({
      log,
      vendorStatus: status,
      vendorOutput: output,
      resultSummaryOverride: buildGatewayTaskResultSummary(raw, output),
    });
    const trace = readDashscopeTimingTrace(resultSummary);
    if (trace) {
      await finalizeDashscopeAsyncRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "FAILED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        failMessage: out.message ?? out.code ?? "failed",
        externalTaskId: taskId,
        model: log.model,
      });
    } else {
      const vendorRequestId =
        readVendorRequestIdFromJson(resultSummary) ?? undefined;
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: log.submittedAt
          ? polledAtMs - log.submittedAt.getTime()
          : 0,
        completedAt: new Date(polledAtMs),
        failMessage: out.message ?? out.code ?? "failed",
        externalTaskId: taskId,
        model: log.model,
        resultSummary,
        ...(vendorRequestId ? { vendorRequestId } : {}),
      });
    }
    return;
  }

  await persistDashscopeTimingOnPoll({
    log,
    vendorStatus: status || "RUNNING",
    vendorOutput: output,
    resultSummaryOverride: buildGatewayLogProgressSummary({
      providerKind,
      status: status || "RUNNING",
    }),
  });
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;

  const taskId =
    request.nextUrl.searchParams.get("taskId")?.trim() ??
    request.nextUrl.searchParams.get("task_id")?.trim();
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const log = await prisma.gatewayRequestLog.findFirst({
    where: {
      userId: auth.userId,
      externalTaskId: taskId,
    },
    orderBy: { submittedAt: "desc" },
  });

  const credentialId =
    log?.credentialId ?? auth.credentials[0]?.id ?? null;

  if (!credentialId) {
    return NextResponse.json({ error: "No credential" }, { status: 400 });
  }

  const providerKind =
    log?.providerKind ??
    auth.credentials.find((c) => c.id === credentialId)?.providerKind ??
    "KIE";

  try {
    if (providerKind === "DASHSCOPE") {
      if (log?.status === "SUCCEEDED" || log?.status === "FAILED") {
        const summary = (log.resultSummary ?? {}) as Record<string, unknown>;
        if (summary.sync === true && summary.output) {
          return NextResponse.json({
            code: 200,
            data: summary.output,
            providerKind: "DASHSCOPE",
          });
        }
      }

      const polled = await pollDashscopeTaskForLog({
        credentialId,
        taskId,
        model: log?.model,
      });
      const { output, raw } = polled;
      if (log) {
        await syncDashscopePollToGatewayLog({
          log,
          taskId,
          output,
          raw,
          providerKind: "DASHSCOPE",
        });
      }
      return NextResponse.json({ code: 200, data: output, providerKind: "DASHSCOPE" });
    }

    if (providerKind === "TOPAZ") {
      const polled = await pollTopazVideoTaskForLog({ credentialId, taskId });
      if (log) {
        if (polled.state === "succeeded") {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: polled,
            externalTaskId: taskId,
            model: log.model,
          });
        } else if (polled.state === "failed") {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: polled.errorMessage ?? "failed",
            externalTaskId: taskId,
            model: log.model,
          });
        } else {
          await touchGatewayLogProgress(
            log.id,
            buildGatewayLogProgressSummary({
              providerKind: "TOPAZ",
              status: polled.state,
              detail:
                polled.progress != null
                  ? `progress ${polled.progress}`
                  : undefined,
            }),
          );
        }
      }
      return NextResponse.json({
        code: 200,
        data: polled,
        providerKind: "TOPAZ",
      });
    }

    if (providerKind === "HUNYUAN") {
      const polled = await pollHunyuanTaskForLog({
        credentialId,
        taskId,
        model: log?.model,
      });
      if (log) {
        if (polled.state === "succeeded") {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: polled,
            externalTaskId: taskId,
            model: log.model,
          });
        } else if (polled.state === "failed") {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: polled.errorMessage ?? "failed",
            externalTaskId: taskId,
            model: log.model,
          });
        } else {
          await touchGatewayLogProgress(
            log.id,
            buildGatewayLogProgressSummary({
              providerKind: "HUNYUAN",
              status: String(polled.state ?? "RUNNING"),
            }),
          );
        }
      }
      return NextResponse.json({ code: 200, data: polled, providerKind: "HUNYUAN" });
    }

    if (providerKind === "BAILIAN") {
      if (log?.status === "SUCCEEDED") {
        const cachedUrl = extractBailianR2vVideoUrlFromGatewaySummary(
          log.resultSummary,
        );
        if (cachedUrl) {
          return NextResponse.json({
            code: 200,
            data: {
              task_id: taskId,
              task_status: "SUCCEEDED",
              video_url: cachedUrl,
            },
            providerKind: "BAILIAN",
          });
        }
      }
      const polled = await pollBailianR2vTaskForLog({
        credentialId,
        taskId,
      });
      const { output, raw } = polled;
      if (log) {
        await syncDashscopePollToGatewayLog({
          log,
          taskId,
          output,
          raw,
          providerKind: "BAILIAN",
        });
      }
      return NextResponse.json({ code: 200, data: output, providerKind: "BAILIAN" });
    }

    if (providerKind === "MINIMAX") {
      const polled = await pollMinimaxVideoTaskStatus({ credentialId, taskId });
      if (log) {
        if (polled.state === "succeeded") {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: buildGatewayTaskResultSummary(polled.raw, {
              ...(polled.videoUrl ? { videoUrl: polled.videoUrl } : {}),
              ...(polled.enhancedPrompt
                ? { enhancedPrompt: polled.enhancedPrompt }
                : {}),
              status: polled.task.status,
              usage: polled.task.usage,
            }),
            externalTaskId: taskId,
            model: log.model,
            usage: polled.task.usage
              ? {
                  totalTokens: polled.task.usage.total_tokens,
                  promptTokens: polled.task.usage.prompt_tokens,
                  completionTokens: polled.task.usage.completion_tokens,
                }
              : undefined,
          });
        } else if (polled.state === "failed") {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: polled.errorMessage ?? "MiniMax video task failed",
            failCode: "MINIMAX_VIDEO_TASK_FAILED",
            externalTaskId: taskId,
            model: log.model,
            resultSummary: buildGatewayTaskResultSummary(polled.raw, {
              status: polled.task.status,
              error: polled.task.error,
            }),
          });
        } else {
          await touchGatewayLogProgress(
            log.id,
            buildGatewayLogProgressSummary({
              providerKind: "MINIMAX",
              status: polled.state,
            }),
          );
        }
      }
      return NextResponse.json({
        code: 200,
        data: {
          task: polled.task,
          video_url: polled.videoUrl,
          enhanced_prompt: polled.enhancedPrompt,
        },
        providerKind: "MINIMAX",
      });
    }

    if (providerKind === "VOLCENGINE") {
      const cred = await getDecryptedCredentialApiKey(credentialId);
      if (!cred) {
        return NextResponse.json({ error: "Credential unavailable" }, { status: 400 });
      }
      const polled = await volcengineGetVideoTask({
        apiKey: resolveVolcengineArkApiKey(cred.apiKey),
        baseUrl: cred.baseUrl,
        taskId,
      });
      const row = polled.output;
      if (log) {
        const vendorStatus = String(row.status ?? "running");
        if (isVolcengineVideoTaskSuccess(row)) {
          const slim = row.content?.video_url
            ? { videoUrl: row.content.video_url }
            : { status: row.status };
          const baseSummary = buildGatewayTaskResultSummary(polled.raw, slim);
          const { resultSummary } = await persistVolcengineTimingOnPoll({
            log,
            vendorStatus,
            vendorRaw: polled.raw,
            resultSummaryOverride: baseSummary,
          });
          const trace = readVolcengineTimingTrace(resultSummary);
          const polledAtMs = Date.now();
          if (trace) {
            await finalizeVolcengineVideoRequestLog(log.id, {
              submittedAt: log.submittedAt,
              status: "SUCCEEDED",
              trace,
              resultSummaryBase: resultSummary,
              fallbackNowMs: polledAtMs,
              externalTaskId: taskId,
              model: log.model,
            });
          } else {
            await finalizeRequestLog(log.id, {
              status: "SUCCEEDED",
              durationMs: log.submittedAt
                ? polledAtMs - log.submittedAt.getTime()
                : 0,
              completedAt: new Date(polledAtMs),
              resultSummary,
              externalTaskId: taskId,
              model: log.model,
            });
          }
        } else if (isVolcengineVideoTaskFailed(row)) {
          const { resultSummary } = await persistVolcengineTimingOnPoll({
            log,
            vendorStatus,
            vendorRaw: polled.raw,
            resultSummaryOverride: buildGatewayTaskResultSummary(polled.raw, {
              status: row.status,
              error: row.error,
            }),
          });
          const trace = readVolcengineTimingTrace(resultSummary);
          const polledAtMs = Date.now();
          if (trace) {
            await finalizeVolcengineVideoRequestLog(log.id, {
              submittedAt: log.submittedAt,
              status: "FAILED",
              trace,
              resultSummaryBase: resultSummary,
              fallbackNowMs: polledAtMs,
              failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
              failCode: "VOLCENGINE_TASK_FAILED",
              externalTaskId: taskId,
              model: log.model,
            });
          } else {
            await finalizeRequestLog(log.id, {
              status: "FAILED",
              durationMs: log.submittedAt
                ? polledAtMs - log.submittedAt.getTime()
                : 0,
              completedAt: new Date(polledAtMs),
              failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
              failCode: "VOLCENGINE_TASK_FAILED",
              externalTaskId: taskId,
              model: log.model,
              resultSummary,
            });
          }
        } else if (isVolcengineVideoTaskInProgress(row)) {
          const { vendorStalled } = await persistVolcengineTimingOnPoll({
            log,
            vendorStatus,
            vendorRaw: polled.raw,
            resultSummaryOverride: buildGatewayLogProgressSummary({
              providerKind: "VOLCENGINE",
              status: vendorStatus,
            }),
          });
          if (vendorStalled) {
            return NextResponse.json({
              code: 200,
              data: row,
              providerKind: "VOLCENGINE",
              vendorStalled: true,
            });
          }
        }
      }
      return NextResponse.json({
        code: 200,
        data: row,
        providerKind: "VOLCENGINE",
      });
    }

    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential unavailable" }, { status: 400 });
    }

    const data = await pollKieTaskForLog({
      logId: log?.id ?? "",
      credentialId,
      taskId,
      model: log?.model ?? undefined,
    });
    if (log) {
      if (isKieRecordSuccess(data.state) || isKieRecordComplete(data)) {
        await finalizeRequestLog(log.id, {
          status: "SUCCEEDED",
          durationMs: log.submittedAt
            ? Date.now() - log.submittedAt.getTime()
            : 0,
          vendorDurationMs:
            "costTime" in data && typeof data.costTime === "number"
              ? Math.round(data.costTime * 1000)
              : undefined,
          resultSummary: { state: "success", resultJson: data.resultJson },
          externalTaskId: data.taskId,
          model: data.model || log.model,
        });
      } else if (isKieRecordFail(data.state)) {
        await finalizeRequestLog(log.id, {
          status: "FAILED",
          durationMs: log.submittedAt
            ? Date.now() - log.submittedAt.getTime()
            : 0,
          failMessage: data.failMsg ?? data.failCode ?? "failed",
          failCode:
            inferGatewayFailCode({
              failMessage: data.failMsg,
              upstreamCode: data.failCode,
            }) ?? "KIE_TASK_FAILED",
          externalTaskId: data.taskId,
          model: data.model || log.model,
        });
      } else {
        await touchGatewayLogProgress(
          log.id,
          buildGatewayLogProgressSummary({
            providerKind: "KIE",
            status: String(data.state ?? "running"),
          }),
        );
      }
    }
    return NextResponse.json({ code: 200, data, providerKind: "KIE" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
