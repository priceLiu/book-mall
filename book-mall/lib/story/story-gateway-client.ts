/**
 * Story → Gateway 客户端（仅经 /api/gw/v1 + 用户关联的 Gateway API Key）
 */

import type { GatewayProviderKind } from "@prisma/client";

import { StoryProjectError } from "./story-project-service";
import {
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { assertPlatformGatewayEntitlement } from "@/lib/platform-gateway-entitlement";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import {
  gatewayV1ChatCompletions,
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "./kie-client";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";

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

function storyMeta(
  userId: string,
  opts: {
    storyProjectId?: string;
    storyTaskId?: string;
    clientPage?: string;
  },
) {
  return gatewayV1ClientMeta("STORY", {
    bookUserId: userId,
    storyProjectId: opts.storyProjectId,
    storyTaskId: opts.storyTaskId,
    clientPage:
      opts.clientPage ??
      (opts.storyProjectId ? `project/${opts.storyProjectId}` : undefined),
  });
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
  if (!pickCredentialForKind(auth.credentials, route.providerKind)) {
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

  const result = await gatewayV1ChatCompletions({
    apiKeyId: auth.id,
    body,
    meta: storyMeta(userId, opts),
  });

  let parsed: unknown = null;
  try {
    parsed = result.text ? JSON.parse(result.text) : null;
  } catch {
    parsed = null;
  }
  const ok = result.status >= 200 && result.status < 300;
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
  return {
    text,
    rawPayload: parsed,
    logId: result.logId ?? "",
  };
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
  if (!pickCredentialForKind(auth.credentials, "KIE")) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 KIE 凭证",
      503,
    );
  }

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model: opts.model,
      input: opts.input,
      callBackUrl: opts.callBackUrl ?? null,
    },
    meta: storyMeta(userId, opts),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "KIE",
  };
}

export async function storyGwRecordInfo(
  userId: string,
  opts: {
    taskId: string;
    gatewayLogId?: string | null;
  },
): Promise<KieRecordResponse> {
  const auth = await requireGatewayAuth(userId);
  if (!pickCredentialForKind(auth.credentials, "KIE")) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 KIE 凭证",
      503,
    );
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("STORY", { bookUserId: userId }),
  });

  return polled.data as KieRecordResponse;
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
  if (!pickCredentialForKind(auth.credentials, "VOLCENGINE")) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model: opts.model,
      input: opts.body,
    },
    meta: storyMeta(userId, opts),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "VOLCENGINE",
  };
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
  if (!pickCredentialForKind(auth.credentials, "VOLCENGINE")) {
    throw new StoryProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta("STORY", { bookUserId: userId }),
  });

  const row = polled.data as import("@/lib/gateway/volcengine-client").VolcengineVideoTaskResult;

  if (isVolcengineVideoTaskSuccess(row)) {
    return {
      state: "success",
      videoUrl: row.content?.video_url,
      raw: polled.data,
    };
  }
  if (isVolcengineVideoTaskFailed(row)) {
    return {
      state: "fail",
      failMessage: volcengineVideoTaskFailMessage(row),
      raw: polled.data,
    };
  }
  return { state: "pending", raw: polled.data };
}
