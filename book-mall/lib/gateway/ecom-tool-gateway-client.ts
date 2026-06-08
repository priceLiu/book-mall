/**
 * 电商工具箱 → Gateway（支持 PLATFORM 代付 Key）
 */

import type { GatewayClientSource } from "@prisma/client";
import {
  GatewayRequiredError,
  summarizeUpstreamFailMessage,
} from "@/lib/gateway/book-gateway-link";
import {
  finalizeRequestLog,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayStreamChatResultSummary } from "@/lib/gateway/log-result-summary";
import {
  gatewayV1ChatCompletionsStream,
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";
import {
  isBailianR2vFailed,
  isBailianR2vSucceeded,
} from "@/lib/canvas/canvas-gateway-client";
import type { BailianR2vTaskOutput } from "@/lib/canvas/canvas-video-bailian-r2v";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
import {
  dashscopeExtractTaskImageUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { resolveEcomGatewayAuthForUser } from "@/lib/ecom/ecom-gateway-auth";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
} from "@/lib/gateway/volcengine-client";
import type { CanvasChatMessage } from "@/lib/canvas/providers/types";

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
        size?: string;
        refImg?: string;
        refMode?: "repaint" | "refonly";
        refStrength?: number;
        clientPage?: string;
      }
    | {
        kind: "wan27-image";
        model: string;
        content: Array<{ text: string } | { image: string }>;
        size?: string;
        n?: number;
        contentOrder?: "text-first" | "images-first";
        clientPage?: string;
      }
    | {
        kind: "kling-v3-image";
        model: string;
        content: Array<{ text: string } | { image: string }>;
        aspectRatio?: "16:9" | "9:16" | "1:1";
        resolution?: "1k" | "2k" | "4k";
        n?: number;
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
  routeGatewayModel(model);

  const body =
    opts.kind === "wanx"
      ? {
          model,
          dashscope: {
            jobKind: "wanx" as const,
            prompt: opts.prompt,
            negativePrompt: opts.negativePrompt,
            n: opts.n,
            size: opts.size,
            refImg: opts.refImg,
            refMode: opts.refMode,
            refStrength: opts.refStrength,
          },
        }
      : opts.kind === "wan27-image"
        ? {
            model,
            dashscope: {
              jobKind: "wan27-image" as const,
              content: opts.content,
              size: opts.size,
              n: opts.n,
              contentOrder: opts.contentOrder,
            },
          }
        : opts.kind === "kling-v3-image"
          ? {
              model,
              dashscope: {
                jobKind: "kling-v3-image" as const,
                content: opts.content,
                aspectRatio: opts.aspectRatio,
                resolution: opts.resolution,
                n: opts.n,
              },
            }
          : {
              model,
              dashscope: {
                jobKind: "video" as const,
                videoBody: opts.body,
              },
            };

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body,
    meta: gatewayV1ClientMeta("E_COMMERCE", { clientPage: opts.clientPage }),
  });

  return { taskId: created.taskId, logId: created.logId };
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

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("E_COMMERCE"),
  });
  const output = polled.data as DashscopeTaskOutput;

  const status = output.task_status ?? "UNKNOWN";
  if (isDashscopeTaskSuccess(status)) {
    const outputUrl = ecomExtractMediaUrl(output);
    return { status: "SUCCEEDED", outputUrl: outputUrl ?? undefined };
  }
  if (isDashscopeTaskFailed(status)) {
    const failMessage = output.message ?? output.code ?? "failed";
    return { status: "FAILED", failMessage };
  }
  return { status };
}

function wrapEcomChatStreamWithLogFinalize(
  upstream: ReadableStream<Uint8Array>,
  ctx: { logId: string; model: string; startedMs: number },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage: UsageFromResponse | undefined;
  let failMessage: string | undefined;

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as Record<string, unknown>;
              const u = parseOpenAiUsage(json);
              if (
                u.totalTokens != null ||
                u.promptTokens != null ||
                u.completionTokens != null
              ) {
                lastUsage = u;
              }
              const err = json.error as { message?: string } | undefined;
              if (typeof err?.message === "string") failMessage = err.message;
            } catch {
              /* ignore */
            }
          }
        }
        await finalizeRequestLog(ctx.logId, {
          status: failMessage ? "FAILED" : "SUCCEEDED",
          durationMs: ctx.startedMs,
          usage: lastUsage,
          resultSummary: lastUsage
            ? buildGatewayStreamChatResultSummary(lastUsage)
            : undefined,
          failCode: failMessage ? "STREAM_VENDOR_ERROR" : undefined,
          failMessage,
          model: ctx.model,
        });
        controller.close();
      } catch (e) {
        await finalizeRequestLog(ctx.logId, {
          status: "FAILED",
          durationMs: ctx.startedMs,
          failCode: "STREAM_INTERRUPTED",
          failMessage: (e as Error).message || "流式连接中断",
          model: ctx.model,
        });
        controller.error(e);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

/** 电商故事版 · Gateway 流式 Chat */
export async function ecomGwChatStream(
  bookUserId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ logId: string; status: number; body: ReadableStream<Uint8Array> }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new GatewayRequiredError(
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(opts.params ?? {}),
  };

  const result = await gatewayV1ChatCompletionsStream({
    apiKeyId: auth.id,
    body,
    meta: gatewayV1ClientMeta("E_COMMERCE", { clientPage: opts.clientPage }),
  });

  const logId = result.headers.get("x-gateway-log-id") ?? "";
  const bodyStream = result.body;

  if (!bodyStream || result.status >= 300) {
    const errText = bodyStream
      ? await new Response(bodyStream).text()
      : `HTTP ${result.status}`;
    throw new GatewayRequiredError(
      summarizeUpstreamFailMessage(errText, result.status),
    );
  }

  return {
    logId,
    status: result.status,
    body: wrapEcomChatStreamWithLogFinalize(bodyStream, {
      logId,
      model,
      startedMs: 0,
    }),
  };
}

export async function ecomGwCreateVolcengineVideoJob(
  bookUserId: string,
  opts: {
    model: string;
    body: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const route = routeGatewayModel(opts.model);
  if (route.providerKind !== "VOLCENGINE" || route.requestKind !== "VIDEO") {
    throw new GatewayRequiredError(`模型 ${opts.model} 非火山方舟视频`);
  }
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定火山方舟凭证");
  }

  const model = opts.model.trim();
  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: { model, input: opts.body },
    meta: gatewayV1ClientMeta("E_COMMERCE", { clientPage: opts.clientPage }),
  });

  return { taskId: created.taskId, logId: created.logId };
}

export async function ecomGwPollVolcengine(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定火山方舟凭证");
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("E_COMMERCE"),
  });
  const row = polled.data as import("@/lib/gateway/volcengine-client").VolcengineVideoTaskResult;

  if (isVolcengineVideoTaskSuccess(row)) {
    const outputUrl = row.content?.video_url?.trim();
    return { status: "SUCCEEDED", outputUrl: outputUrl ?? undefined };
  }

  if (isVolcengineVideoTaskFailed(row)) {
    const failMessage =
      typeof row.error === "string"
        ? row.error
        : (row.error?.message ?? `status=${row.status}`);
    return { status: "FAILED", failMessage };
  }

  return { status: row.status ?? "PENDING" };
}

export async function ecomGwCreateKieJob(
  bookUserId: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const route = routeGatewayModel(opts.model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const model = opts.model.trim();
  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: { model, input: opts.input, callBackUrl: null },
    meta: gatewayV1ClientMeta("E_COMMERCE", { clientPage: opts.clientPage }),
  });

  return { taskId: created.taskId, logId: created.logId };
}

export async function ecomGwPollKie(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("E_COMMERCE"),
  });
  const record = polled.data as import("@/lib/story/kie-client").KieRecordResponse;

  const state = record.state ?? "UNKNOWN";
  if (isKieRecordSuccess(state)) {
    const outputUrl = extractKieResultUrl(record) ?? undefined;
    return { status: "SUCCEEDED", outputUrl };
  }
  if (isKieRecordFail(state)) {
    const failMessage = record.failMsg ?? record.failCode ?? "failed";
    return { status: "FAILED", failMessage };
  }
  return { status: state };
}

export async function ecomGwCreateBailianR2vJob(
  bookUserId: string,
  opts: {
    model: string;
    prompt: string;
    referenceImageUrls: string[];
    resolution: "720P" | "1080P";
    ratio: string;
    duration: number;
    seedStr?: string;
    parameterExtras?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼凭证");
  }

  const model = opts.model.trim();
  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model,
      bailian: {
        prompt: opts.prompt,
        referenceImageUrls: opts.referenceImageUrls,
        resolution: opts.resolution,
        ratio: opts.ratio,
        duration: opts.duration,
        seedStr: opts.seedStr,
        parameterExtras: opts.parameterExtras,
      },
    },
    meta: gatewayV1ClientMeta("E_COMMERCE", { clientPage: opts.clientPage }),
  });

  return { taskId: created.taskId, logId: created.logId };
}

export async function ecomGwPollBailianR2v(
  bookUserId: string,
  opts: { taskId: string; gatewayLogId: string },
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  const auth = await requireEcomGatewayAuth(bookUserId);
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼凭证");
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("E_COMMERCE"),
  });
  const output = polled.data as BailianR2vTaskOutput;

  if (isBailianR2vSucceeded(output)) {
    const outputUrl = output.video_url?.trim() ?? undefined;
    return { status: "SUCCEEDED", outputUrl };
  }

  if (isBailianR2vFailed(output)) {
    const failMessage =
      output.message ?? output.code ?? `status=${output.task_status ?? "FAILED"}`;
    return { status: "FAILED", failMessage };
  }

  return { status: output.task_status ?? "PENDING" };
}
