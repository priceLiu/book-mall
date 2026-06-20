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
import { persistVolcengineTimingOnPoll } from "@/lib/gateway/log-volcengine-timing-persist";
import { inferGatewayFailCode } from "@/lib/gateway/log-fail-code";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";
import {
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
import {
  pollBailianR2vTaskForLog,
  pollDashscopeTaskForLog,
  pollHunyuanTaskForLog,
  pollKieTaskForLog,
} from "@/lib/gateway/poll-service";
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
      const polled = await pollDashscopeTaskForLog({ credentialId, taskId });
      const { output, raw } = polled;
      if (log) {
        const status = output.task_status;
        if (isDashscopeTaskSuccess(status)) {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: buildGatewayTaskResultSummary(raw, output),
            externalTaskId: taskId,
            model: log.model,
          });
        } else if (isDashscopeTaskFailed(status)) {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: output.message ?? output.code ?? "failed",
            externalTaskId: taskId,
            model: log.model,
          });
        } else {
          await touchGatewayLogProgress(
            log.id,
            buildGatewayLogProgressSummary({
              providerKind: "DASHSCOPE",
              status: String(status ?? "RUNNING"),
            }),
          );
        }
      }
      return NextResponse.json({ code: 200, data: output, providerKind: "DASHSCOPE" });
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
      const polled = await pollBailianR2vTaskForLog({
        credentialId,
        taskId,
      });
      const { output, raw } = polled;
      if (log) {
        const status = output.task_status?.toUpperCase() ?? "";
        if (status === "SUCCEEDED" || status === "SUCCESS") {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: buildGatewayTaskResultSummary(raw, output),
            externalTaskId: taskId,
            model: log.model,
          });
        } else if (
          status === "FAILED" ||
          status === "CANCELED" ||
          status === "UNKNOWN"
        ) {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: output.message ?? output.code ?? "failed",
            externalTaskId: taskId,
            model: log.model,
          });
        } else {
          await touchGatewayLogProgress(
            log.id,
            buildGatewayLogProgressSummary({
              providerKind: "BAILIAN",
              status: status || "RUNNING",
            }),
          );
        }
      }
      return NextResponse.json({ code: 200, data: output, providerKind: "BAILIAN" });
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
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary,
            externalTaskId: taskId,
            model: log.model,
          });
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
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
            failCode: "VOLCENGINE_TASK_FAILED",
            externalTaskId: taskId,
            model: log.model,
            resultSummary,
          });
        } else if (isVolcengineVideoTaskInProgress(row)) {
          await persistVolcengineTimingOnPoll({
            log,
            vendorStatus,
            vendorRaw: polled.raw,
            resultSummaryOverride: buildGatewayLogProgressSummary({
              providerKind: "VOLCENGINE",
              status: vendorStatus,
            }),
          });
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
    });
    if (log) {
      if (isKieRecordSuccess(data.state)) {
        await finalizeRequestLog(log.id, {
          status: "SUCCEEDED",
          durationMs: log.submittedAt
            ? Date.now() - log.submittedAt.getTime()
            : 0,
          vendorDurationMs:
            typeof data.costTime === "number"
              ? Math.round(data.costTime * 1000)
              : undefined,
          resultSummary: { state: data.state, resultJson: data.resultJson },
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
