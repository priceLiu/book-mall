/**
 * 工具站 → Gateway · KIE 异步任务（图生视频 / Grok 等）
 */
import type { GatewayProviderKind } from "@prisma/client";

import { buildKieToolI2vCreateArgs } from "@/lib/canvas/kie-grok-builders";
import { buildKieToolVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "@/lib/story/kie-client";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";

const CLIENT_SOURCE = "TOOL" as const;

async function requireGatewayAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

export type ToolLabKiePollOutput = {
  task_status: string;
  video_url?: string;
  message?: string;
  code?: string;
};

export function normalizeKieRecordForToolLab(
  record: KieRecordResponse,
): ToolLabKiePollOutput {
  if (isKieRecordSuccess(record.state)) {
    const video_url = extractKieResultUrl(record) ?? undefined;
    return { task_status: "SUCCEEDED", video_url };
  }
  if (isKieRecordFail(record.state)) {
    return {
      task_status: "FAILED",
      message: record.failMsg ?? record.failCode ?? "failed",
      code: record.failCode ?? undefined,
    };
  }
  const st = (record.state ?? "waiting").trim().toLowerCase();
  if (st === "waiting" || st === "pending") {
    return { task_status: "PENDING" };
  }
  return { task_status: "RUNNING" };
}

export async function toolGwCreateKieJob(
  userId: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.model.trim();
  routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model,
      input: opts.input,
    },
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, {
      clientPage: opts.clientPage,
      bookUserId: userId,
    }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "KIE",
  };
}

export async function toolGwCreateKieI2vJob(
  userId: string,
  opts: {
    model: string;
    prompt: string;
    imageUrls: string[];
    resolution?: string;
    duration?: number;
    aspectRatio?: string;
    mode?: string;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const { model, input } = buildKieToolI2vCreateArgs(opts);
  return toolGwCreateKieJob(userId, {
    model,
    input,
    clientPage: opts.clientPage,
  });
}

export async function toolGwCreateKieVideoToolJob(
  userId: string,
  opts: {
    model: string;
    prompt?: string;
    imageUrls?: string[];
    videoUrls?: string[];
    videoUrl?: string;
    resolution?: string;
    duration?: number;
    mode?: string;
    characterOrientation?: string;
    backgroundSource?: string;
    upscaleFactor?: string | number;
    nsfwChecker?: boolean;
    clientPage?: string;
  },
): Promise<{ taskId: string; logId: string; providerKind: GatewayProviderKind }> {
  const { model, input } = buildKieToolVideoCreateArgs(opts);
  return toolGwCreateKieJob(userId, {
    model,
    input,
    clientPage: opts.clientPage,
  });
}

export async function toolGwPollKieJob(
  userId: string,
  opts: { taskId: string; gatewayLogId?: string | null },
): Promise<ToolLabKiePollOutput> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayRequiredError("Gateway Key 未绑定 KIE 凭证");
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, { bookUserId: userId }),
  });

  const record = polled.data as KieRecordResponse;
  return normalizeKieRecordForToolLab(record);
}
