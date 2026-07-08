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
import { gatewayFetch } from "@/lib/gateway/format-fetch-error";
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
  return gatewayFetch(url, { ...rest, headers, cache: "no-store" }, {
    hop: "internal",
  });
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

export async function gatewayV1QwenImageEdit(
  opts: GatewayV1RequestOpts & {
    body: {
      model: string;
      content: Array<{ image?: string; text?: string }>;
      parameters?: Record<string, unknown>;
    };
  },
): Promise<{ imageUrls: string[]; logId: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "bailian/qwen-image-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) ||
        `Gateway qwen-image-edit HTTP ${r.status}`,
    );
  }
  let json: {
    code?: number;
    data?: { imageUrls?: string[] };
    logId?: string;
    error?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Gateway qwen-image-edit 响应非 JSON");
  }
  const imageUrls = json.data?.imageUrls ?? [];
  if (imageUrls.length === 0) {
    throw new Error(json.error ?? "Gateway qwen-image-edit 未返回图像");
  }
  return { imageUrls, logId: json.logId ?? "" };
}

export async function gatewayV1VolcengineImageGenerations(
  opts: GatewayV1RequestOpts & {
    body: {
      model: string;
      prompt: string;
      image?: string;
      parameters?: Record<string, unknown>;
    };
  },
): Promise<{ images: Array<{ url?: string; b64?: string }>; logId: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "volcengine/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) ||
        `Gateway volcengine images HTTP ${r.status}`,
    );
  }
  let json: {
    code?: number;
    data?: { images?: Array<{ url?: string; b64?: string }> };
    logId?: string;
    error?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("Gateway volcengine images 响应非 JSON");
  }
  const images = json.data?.images ?? [];
  if (images.length === 0) {
    throw new Error(json.error ?? "Gateway volcengine images 未返回图像");
  }
  return { images, logId: json.logId ?? "" };
}

async function parseGatewayImageUrlsResponse(
  r: Response,
  label: string,
): Promise<{ imageUrls: string[]; logId: string }> {
  const text = await r.text();
  if (!r.ok) {
    throw new Error(
      summarizeUpstreamFailMessage(text, r.status) ||
        `Gateway ${label} HTTP ${r.status}`,
    );
  }
  let json: {
    code?: number;
    data?: { imageUrls?: string[] };
    logId?: string;
    error?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Gateway ${label} 响应非 JSON`);
  }
  const imageUrls = json.data?.imageUrls ?? [];
  if (imageUrls.length === 0) {
    throw new Error(json.error ?? `Gateway ${label} 未返回图像`);
  }
  return { imageUrls, logId: json.logId ?? "" };
}

export async function gatewayV1ImageOutPainting(
  opts: GatewayV1RequestOpts & {
    body: { imageUrl: string; parameters?: Record<string, unknown> };
  },
): Promise<{ imageUrls: string[]; logId: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "bailian/image-out-painting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  return parseGatewayImageUrlsResponse(r, "image-out-painting");
}

export async function gatewayV1Image2ImageAsync(
  opts: GatewayV1RequestOpts & {
    body: {
      model: string;
      input: Record<string, unknown>;
      parameters?: Record<string, unknown>;
    };
  },
): Promise<{ imageUrls: string[]; logId: string }> {
  const r = await gatewayV1Fetch(opts.apiKeyId, "bailian/image2image-async", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.body),
    meta: opts.meta,
  });
  return parseGatewayImageUrlsResponse(r, "image2image-async");
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
