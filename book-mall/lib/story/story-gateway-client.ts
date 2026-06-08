/**
 * Story → Gateway 内部客户端
 */

import type { GatewayClientSource, GatewayProviderKind } from "@prisma/client";

import { StoryProjectError } from "./story-project-service";
import {
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { assertPlatformGatewayEntitlement } from "@/lib/platform-gateway-entitlement";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardChatCompletions,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayChatResultSummary } from "@/lib/gateway/log-result-summary";
import {
  pollKieTaskForLog,
  submitKieJobForLog,
} from "@/lib/gateway/poll-service";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "./kie-client";

const CLIENT_SOURCE: GatewayClientSource = "STORY";

async function requireGatewayAuth(userId: string) {
  await assertPlatformGatewayEntitlement(userId, { navKey: "story-theater" });
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new StoryProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Book 个人中心关联 Gateway API Key",
      403,
    );
  }
  if (auth.credentials.length === 0) {
    throw new StoryProjectError(
      "GATEWAY_KEY_REQUIRED",
      "Gateway API Key 未绑定厂商凭证",
      403,
    );
  }
  return auth;
}

export async function storyGwChat(
  userId: string,
  opts: {
    modelKey: string;
    messages: { role: string; content: string }[];
    params?: Record<string, unknown>;
    storyProjectId?: string;
    clientPage?: string;
  },
): Promise<{ text: string; rawPayload: unknown; logId: string }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
      503,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: false,
    ...(opts.params ?? {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/chat/completions",
    providerKind: route.providerKind,
    requestKind: "CHAT",
    clientSource: CLIENT_SOURCE,
    storyProjectId: opts.storyProjectId,
    clientPage:
      opts.clientPage ??
      (opts.storyProjectId ? `project/${opts.storyProjectId}` : undefined),
    inputSummary: buildGatewayInputSummary(model, body),
  });

  try {
    const result = await forwardChatCompletions({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    let parsed: unknown = null;
    try {
      parsed = result.text ? JSON.parse(result.text) : null;
    } catch {
      parsed = null;
    }
    const usage = parseOpenAiUsage(parsed);
    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      resultSummary: buildGatewayChatResultSummary(parsed) ?? undefined,
      failMessage: ok ? undefined : result.text.slice(0, 500),
      model,
    });
    if (!ok) {
      throw new StoryProjectError(
        "LLM_HTTP_ERROR",
        result.text.slice(0, 500) || `HTTP ${result.status}`,
        502,
      );
    }
    const choice = (parsed as { choices?: { message?: { content?: string } }[] })
      ?.choices?.[0];
    const text =
      typeof choice?.message?.content === "string"
        ? choice.message.content
        : result.text;
    return { text, rawPayload: parsed, logId: log.id };
  } catch (e) {
    if (e instanceof StoryProjectError) throw e;
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: (e as Error).message,
      model,
    });
    throw e;
  }
}

export async function storyGwCreateKieJob(
  userId: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    callBackUrl?: string | null;
    storyProjectId?: string;
    storyTaskId?: string;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const auth = await requireGatewayAuth(userId);
  const route = routeGatewayModel(opts.model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 KIE 凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "KIE",
    requestKind: route.requestKind,
    clientSource: CLIENT_SOURCE,
    storyProjectId: opts.storyProjectId,
    storyTaskId: opts.storyTaskId,
    clientPage:
      opts.clientPage ??
      (opts.storyProjectId ? `project/${opts.storyProjectId}` : undefined),
    inputSummary: buildGatewayInputSummary(opts.model, opts.input),
  });

  const taskId = await submitKieJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    input: opts.input,
    callBackUrl: opts.callBackUrl ?? null,
  });

  return { taskId, logId: log.id, providerKind: "KIE" };
}

export async function storyGwRecordInfo(
  userId: string,
  opts: {
    taskId: string;
    gatewayLogId?: string | null;
  },
): Promise<KieRecordResponse> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 KIE 凭证",
      503,
    );
  }

  const record = await pollKieTaskForLog({
    logId: opts.gatewayLogId ?? "",
    credentialId,
    taskId: opts.taskId,
  });

  if (opts.gatewayLogId) {
    if (isKieRecordSuccess(record.state)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "SUCCEEDED",
        durationMs: 0,
        resultSummary: { state: record.state, resultJson: record.resultJson },
        externalTaskId: record.taskId,
        model: record.model,
      });
    } else if (isKieRecordFail(record.state)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "FAILED",
        durationMs: 0,
        failMessage: record.failMsg ?? record.failCode ?? "failed",
        externalTaskId: record.taskId,
        model: record.model,
      });
    }
  }

  return record;
}

export function storyGwExtractKieResultUrl(record: KieRecordResponse): string | null {
  return extractKieResultUrl(record);
}

export async function storyGwCreateVolcengineVideoJob(
  userId: string,
  opts: {
    model: string;
    body: Record<string, unknown>;
    storyProjectId?: string;
    storyTaskId?: string;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const auth = await requireGatewayAuth(userId);
  const route = routeGatewayModel(opts.model);
  if (route.providerKind !== "VOLCENGINE" || route.requestKind !== "VIDEO") {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      `模型 ${opts.model} 非火山方舟视频`,
      400,
    );
  }
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "VOLCENGINE",
    requestKind: "VIDEO",
    clientSource: CLIENT_SOURCE,
    storyProjectId: opts.storyProjectId,
    storyTaskId: opts.storyTaskId,
    clientPage:
      opts.clientPage ??
      (opts.storyProjectId ? `project/${opts.storyProjectId}` : undefined),
    inputSummary: buildGatewayInputSummary(opts.model, opts.body),
  });

  const taskId = await submitVolcengineVideoJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    body: opts.body,
  });

  return { taskId, logId: log.id, providerKind: "VOLCENGINE" };
}

export type StoryVolcenginePollResult = {
  state: "pending" | "success" | "fail";
  videoUrl?: string;
  failMessage?: string;
  raw?: unknown;
};

export async function storyGwPollVolcengineVideo(
  userId: string,
  opts: {
    taskId: string;
    gatewayLogId?: string | null;
    model?: string;
  },
): Promise<StoryVolcenginePollResult> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "火山方舟凭证不可用",
      503,
    );
  }

  const polled = await volcengineGetVideoTask({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    taskId: opts.taskId,
  });
  const row = polled.output;

  if (opts.gatewayLogId) {
    if (isVolcengineVideoTaskSuccess(row)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "SUCCEEDED",
        durationMs: 0,
        resultSummary: {
          status: row.status,
          videoUrl: row.content?.video_url,
        },
        externalTaskId: opts.taskId,
        model: opts.model,
      });
    } else if (isVolcengineVideoTaskFailed(row)) {
      await finalizeRequestLog(opts.gatewayLogId, {
        status: "FAILED",
        durationMs: 0,
        failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
        externalTaskId: opts.taskId,
        model: opts.model,
      });
    }
  }

  if (isVolcengineVideoTaskSuccess(row)) {
    return {
      state: "success",
      videoUrl: row.content?.video_url,
      raw: polled.raw,
    };
  }
  if (isVolcengineVideoTaskFailed(row)) {
    return {
      state: "fail",
      failMessage: volcengineVideoTaskFailMessage(row),
      raw: polled.raw,
    };
  }
  return { state: "pending", raw: polled.raw };
}
