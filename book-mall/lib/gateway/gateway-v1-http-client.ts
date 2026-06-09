/**
 * Book 服务端调用 Gateway API（/api/gw/v1）的唯一出口。
 * 禁止业务层直连厂商 HTTP；须经本客户端 + 用户关联的 Gateway API Key。
 */

import type { GatewayClientSource } from "@prisma/client";

import { buildGatewayInternalAuthorization } from "@/lib/gateway/gateway-v1-auth";
import {
  gatewayV1MetaHeaders,
  type GatewayV1LogMeta,
} from "@/lib/gateway/gateway-v1-log-meta";
import { getBookMallOrigin } from "@/lib/gateway/env";
import { summarizeUpstreamFailMessage } from "@/lib/gateway/book-gateway-link";

export type GatewayV1RequestOpts = {
  apiKeyId: string;
  meta?: GatewayV1LogMeta;
};

function gatewayV1BaseUrl(): string {
  const origin = getBookMallOrigin();
  if (!origin) {
    throw new Error("BOOK_MALL_ORIGIN / NEXTAUTH_URL 未配置，无法调用 Gateway API");
  }
  return `${origin}/api/gw/v1`;
}

async function gatewayV1Fetch(
  apiKeyId: string,
  path: string,
  init: RequestInit & { meta?: GatewayV1LogMeta } = {},
): Promise<Response> {
  const { meta, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  headers.set("Authorization", buildGatewayInternalAuthorization(apiKeyId));
  for (const [k, v] of Object.entries(gatewayV1MetaHeaders(meta))) {
    headers.set(k, v);
  }
  const url = `${gatewayV1BaseUrl()}/${path.replace(/^\//, "")}`;
  return fetch(url, { ...rest, headers, cache: "no-store" });
}

export async function gatewayV1CreateTask(
  opts: GatewayV1RequestOpts & {
    body: Record<string, unknown>;
  },
): Promise<{ taskId: string; logId: string; providerKind: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "jobs/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) || `Gateway createTask HTTP ${r.status}`,
    );
  }
  let json: { code?: number; data?: { taskId?: string; logId?: string; providerKind?: string }; error?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Gateway createTask 响应非 JSON");
  }
  const taskId = json.data?.taskId;
  const logId = json.data?.logId;
  if (!taskId || !logId) {
    throw new Error(json.error ?? "Gateway createTask 缺少 taskId/logId");
  }
  return {
    taskId,
    logId,
    providerKind: json.data?.providerKind ?? "KIE",
  };
}

export async function gatewayV1RecordInfo(
  opts: GatewayV1RequestOpts & { taskId: string },
): Promise<{ providerKind: string; data: unknown }> {
  const q = new URLSearchParams({ taskId: opts.taskId });
  const r = await gatewayV1Fetch(
    opts.apiKeyId,
    `jobs/recordInfo?${q.toString()}`,
    { method: "GET", meta: opts.meta },
  );
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) || `Gateway recordInfo HTTP ${r.status}`,
    );
  }
  let json: { code?: number; data?: unknown; providerKind?: string; error?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Gateway recordInfo 响应非 JSON");
  }
  return {
    providerKind: json.providerKind ?? "KIE",
    data: json.data,
  };
}

export async function gatewayV1ChatCompletions(
  opts: GatewayV1RequestOpts & { body: Record<string, unknown> },
): Promise<{ text: string; status: number; logId?: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...opts.body, stream: false }),
    meta: opts.meta,
  });
  const text = await r.text();
  const logId = r.headers.get("x-gateway-log-id") ?? undefined;
  return { text, status: r.status, logId };
}

/** 流式 chat：返回上游 Response（调用方消费 body stream） */
export async function gatewayV1ChatCompletionsStream(
  opts: GatewayV1RequestOpts & { body: Record<string, unknown> },
): Promise<Response> {
  return gatewayV1Fetch(opts.apiKeyId, "chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...opts.body, stream: true }),
    meta: opts.meta,
  });
}

export async function gatewayV1AudioSpeech(
  opts: GatewayV1RequestOpts & {
    body: {
      model: string;
      input: string;
      voice?: string;
      response_format?: string;
      language_type?: string;
    };
  },
): Promise<{ buffer: Buffer; logId: string; contentType: string; ext: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) || `Gateway TTS HTTP ${r.status}`,
    );
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return {
    buffer: buf,
    logId: r.headers.get("x-gateway-log-id") ?? "",
    contentType: r.headers.get("content-type") ?? "audio/mpeg",
    ext: r.headers.get("x-gateway-audio-ext") ?? "mp3",
  };
}

export async function gatewayV1ImageParsing(
  opts: GatewayV1RequestOpts & {
    body: {
      imageUrl: string;
      clothesType?: string[];
      model?: string;
    };
  },
): Promise<{ output: unknown; logId: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "dashscope/image-parsing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) ||
        `Gateway image-parsing HTTP ${r.status}`,
    );
  }
  let json: { code?: number; data?: unknown; logId?: string; error?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Gateway image-parsing 响应非 JSON");
  }
  return {
    output: json.data,
    logId: json.logId ?? "",
  };
}

export function gatewayV1ClientMeta(
  clientSource: GatewayClientSource,
  extra?: Omit<GatewayV1LogMeta, "clientSource"> & { bookUserId?: string },
): GatewayV1LogMeta {
  const { bookUserId, ...rest } = extra ?? {};
  return {
    clientSource,
    ...rest,
    ...(bookUserId ? { actorBookUserId: bookUserId } : {}),
  };
}
