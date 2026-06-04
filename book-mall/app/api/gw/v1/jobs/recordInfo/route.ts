import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayApiKeyFromBearer } from "@/lib/gateway/api-key-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
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
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await resolveGatewayApiKeyFromBearer(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

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
      const output = await pollDashscopeTaskForLog({ credentialId, taskId });
      if (log) {
        const status = output.task_status;
        if (isDashscopeTaskSuccess(status)) {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: output,
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
        }
      }
      return NextResponse.json({ code: 200, data: polled, providerKind: "HUNYUAN" });
    }

    if (providerKind === "BAILIAN") {
      const output = await pollBailianR2vTaskForLog({
        credentialId,
        taskId,
      });
      if (log) {
        const status = output.task_status?.toUpperCase() ?? "";
        if (status === "SUCCEEDED" || status === "SUCCESS") {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: output,
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
        }
      }
      return NextResponse.json({ code: 200, data: output, providerKind: "BAILIAN" });
    }

    if (providerKind === "VOLCENGINE") {
      const cred = await getDecryptedCredentialApiKey(credentialId);
      if (!cred) {
        return NextResponse.json({ error: "Credential unavailable" }, { status: 400 });
      }
      const row = await volcengineGetVideoTask({
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        taskId,
      });
      if (log) {
        if (isVolcengineVideoTaskSuccess(row)) {
          await finalizeRequestLog(log.id, {
            status: "SUCCEEDED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            resultSummary: row.content?.video_url
              ? { videoUrl: row.content.video_url }
              : { status: row.status },
            externalTaskId: taskId,
            model: log.model,
          });
        } else if (isVolcengineVideoTaskFailed(row)) {
          await finalizeRequestLog(log.id, {
            status: "FAILED",
            durationMs: log.submittedAt
              ? Date.now() - log.submittedAt.getTime()
              : 0,
            failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
            failCode: "VOLCENGINE_TASK_FAILED",
            externalTaskId: taskId,
            model: log.model,
          });
        }
      }
      return NextResponse.json({ code: 200, data: row, providerKind: "VOLCENGINE" });
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
          externalTaskId: data.taskId,
          model: data.model || log.model,
        });
      }
    }
    return NextResponse.json({ code: 200, data, providerKind: "KIE" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
