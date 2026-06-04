/**
 * 电商工具箱 → Gateway（支持 PLATFORM 代付 Key）
 */

import type { GatewayClientSource } from "@prisma/client";
import {
  GatewayRequiredError,
  summarizeUpstreamFailMessage,
} from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  pollDashscopeTaskForLog,
  submitDashscopeVideoJobForLog,
  submitDashscopeWanxJobForLog,
} from "@/lib/gateway/poll-service";
import {
  dashscopeExtractTaskImageUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";

const CLIENT_SOURCE: GatewayClientSource = "E_COMMERCE";

async function requireEcomGatewayAuth(bookUserId: string) {
  const auth = await resolveEcomGatewayAuthForUser(bookUserId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心完成 Gateway 配置");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

export async function ecomGwCreateDashscopeJob(
  bookUserId: string,
  opts:
    | {
        kind: "wanx";
        model: string;
        prompt: string;
        negativePrompt?: string;
        n: number;
        clientPage?: string;
      }
    | {
        kind: "video";
        model: string;
        body: Record<string, unknown>;
        clientPage?: string;
      },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const model = opts.model.trim();
  const route = routeGatewayModel(model);
  const inputSummary =
    opts.kind === "wanx"
      ? buildGatewayInputSummary(model, { prompt: opts.prompt, n: opts.n })
      : buildGatewayInputSummary(model, opts.body);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "DASHSCOPE",
    requestKind: route.requestKind,
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary,
  });

  let taskId: string;
  if (opts.kind === "wanx") {
    taskId = await submitDashscopeWanxJobForLog({
      logId: log.id,
      credentialId,
      model,
      prompt: opts.prompt,
      negativePrompt: opts.negativePrompt,
      n: opts.n,
    });
  } else {
    taskId = await submitDashscopeVideoJobForLog({
      logId: log.id,
      credentialId,
      model,
      body: opts.body,
    });
  }

  return { taskId, logId: log.id };
}

export function ecomExtractMediaUrl(output: DashscopeTaskOutput): string | null {
  if (output.video_url?.trim()) return output.video_url.trim();
  const img = dashscopeExtractTaskImageUrl(output as Record<string, unknown>);
  return img ?? null;
}

export async function ecomGwPollDashscope(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }

  const output = await pollDashscopeTaskForLog({
    credentialId,
    taskId: opts.taskId,
  });

  const status = output.task_status ?? "UNKNOWN";
  if (isDashscopeTaskSuccess(status)) {
    const outputUrl = ecomExtractMediaUrl(output);
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "SUCCEEDED",
      durationMs: 0,
      resultSummary: output,
      externalTaskId: opts.taskId,
    });
    return { status: "SUCCEEDED", outputUrl: outputUrl ?? undefined };
  }
  if (isDashscopeTaskFailed(status)) {
    const failMessage = output.message ?? output.code ?? "failed";
    await finalizeRequestLog(opts.gatewayLogId, {
      status: "FAILED",
      durationMs: 0,
      failMessage: summarizeUpstreamFailMessage(failMessage, 500),
      externalTaskId: opts.taskId,
    });
    return { status: "FAILED", failMessage };
  }
  return { status };
}
