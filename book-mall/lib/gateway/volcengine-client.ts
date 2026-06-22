/**
 * 火山方舟 ARK · 视频生成 tasks API（contents/generations/tasks）
 */

import { defaultBaseUrl } from "@/lib/gateway/model-router";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";
import {
  readVendorRequestIdFromHeaders,
  readVendorRequestIdFromJson,
} from "@/lib/gateway/vendor-request-id";

export type VolcengineVideoTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | string;

export type VolcengineVideoTaskResult = {
  id: string;
  status: VolcengineVideoTaskStatus;
  model?: string;
  error?: { code?: string; message?: string } | string;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
};

export class VolcengineUpstreamError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly vendorTaskId?: string;

  constructor(
    message: string,
    opts: { status: number; requestId?: string; vendorTaskId?: string },
  ) {
    super(message);
    this.name = "VolcengineUpstreamError";
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.vendorTaskId = opts.vendorTaskId;
  }
}

function volcengineUpstreamError(
  prefix: string,
  status: number,
  r: Response,
  json: unknown,
  fallbackText: string,
): VolcengineUpstreamError {
  const msg =
    (json as { error?: { message?: string } })?.error?.message ??
    (json as { message?: string })?.message ??
    fallbackText.slice(0, 400);
  const vendorErrorCode =
    (json as { error?: { code?: string | number } })?.error?.code ??
    (json as { code?: string | number })?.code;
  const codeSuffix =
    vendorErrorCode != null && vendorErrorCode !== ""
      ? ` [错误码：${vendorErrorCode}]`
      : "";
  const requestId =
    readVendorRequestIdFromHeaders(r.headers) ??
    readVendorRequestIdFromJson(json) ??
    undefined;
  const vendorTaskId =
    (json as { id?: string })?.id ??
    (json as { data?: { id?: string } })?.data?.id ??
    undefined;
  return new VolcengineUpstreamError(`${prefix} (${status}): ${msg}${codeSuffix}`, {
    status,
    requestId,
    vendorTaskId,
  });
}

function arkBase(baseUrl?: string | null): string {
  return (baseUrl?.trim() || defaultBaseUrl("VOLCENGINE")).replace(/\/$/, "");
}

export async function volcengineCreateVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  body: Record<string, unknown>;
}): Promise<{ taskId: string; requestId?: string; raw: unknown }> {
  const base = arkBase(opts.baseUrl);
  const model = resolveVolcengineModelKey(opts.model);
  const payload = { ...opts.body, model };

  const r = await fetch(`${base}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`火山方舟视频任务提交失败 (${r.status}): ${text.slice(0, 400)}`);
  }
  if (!r.ok) {
    throw volcengineUpstreamError(
      "火山方舟视频任务提交失败",
      r.status,
      r,
      json,
      text,
    );
  }
  const id =
    (json as { id?: string })?.id ??
    (json as { data?: { id?: string } })?.data?.id;
  if (!id) {
    throw new Error("火山方舟未返回 task id");
  }
  const requestId =
    readVendorRequestIdFromHeaders(r.headers) ??
    readVendorRequestIdFromJson(json) ??
    undefined;
  return { taskId: id, requestId, raw: json };
}

export async function volcengineGetVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  taskId: string;
}): Promise<{ output: VolcengineVideoTaskResult; raw: unknown }> {
  const base = arkBase(opts.baseUrl);
  const r = await fetch(
    `${base}/contents/generations/tasks/${encodeURIComponent(opts.taskId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
    },
  );
  const text = await r.text();
  let json: VolcengineVideoTaskResult & Record<string, unknown>;
  try {
    json = JSON.parse(text) as VolcengineVideoTaskResult & Record<string, unknown>;
  } catch {
    throw new Error(`火山方舟任务查询失败 (${r.status}): ${text.slice(0, 400)}`);
  }
  if (!r.ok) {
    throw volcengineUpstreamError(
      "火山方舟任务查询失败",
      r.status,
      r,
      json,
      text,
    );
  }
  const output = parseVolcengineVideoTaskJson(json, opts.taskId);
  return { output, raw: json };
}

function normalizeVolcengineTaskStatus(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** 兼容 Ark 直出与部分代理嵌套 data / result_url 形态 */
function parseVolcengineVideoTaskJson(
  json: Record<string, unknown>,
  taskId: string,
): VolcengineVideoTaskResult {
  const nested =
    json.data && typeof json.data === "object" && !Array.isArray(json.data)
      ? (json.data as Record<string, unknown>)
      : null;
  const root = nested ?? json;

  const status = normalizeVolcengineTaskStatus(root.status ?? json.status);
  const contentRaw = root.content ?? json.content;
  const content =
    contentRaw && typeof contentRaw === "object" && !Array.isArray(contentRaw)
      ? (contentRaw as VolcengineVideoTaskResult["content"])
      : undefined;

  const videoUrl =
    (typeof content?.video_url === "string" ? content.video_url : undefined) ??
    (typeof root.result_url === "string" ? root.result_url : undefined) ??
    (typeof json.result_url === "string" ? json.result_url : undefined);

  const normalizedContent =
    videoUrl || content?.last_frame_url
      ? {
          video_url: videoUrl ?? content?.video_url,
          last_frame_url: content?.last_frame_url,
        }
      : content;

  return {
    id: String(root.id ?? json.id ?? taskId),
    status,
    model:
      typeof root.model === "string"
        ? root.model
        : typeof json.model === "string"
          ? json.model
          : undefined,
    error: (root.error ?? json.error) as VolcengineVideoTaskResult["error"],
    content: normalizedContent,
  };
}

export function isVolcengineVideoTaskSuccess(
  row: VolcengineVideoTaskResult,
): boolean {
  const s = normalizeVolcengineTaskStatus(row.status);
  return s === "succeeded" || s === "completed" || s === "success";
}

export function isVolcengineVideoTaskFailed(
  row: VolcengineVideoTaskResult,
): boolean {
  const s = normalizeVolcengineTaskStatus(row.status);
  return (
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "expired"
  );
}

export function isVolcengineVideoTaskInProgress(
  row: VolcengineVideoTaskResult,
): boolean {
  const s = normalizeVolcengineTaskStatus(row.status);
  return s === "queued" || s === "running" || s === "pending" || s === "processing";
}

export function volcengineVideoTaskFailMessage(
  row: VolcengineVideoTaskResult,
): string {
  if (typeof row.error === "string") return row.error;
  return row.error?.message ?? `status=${row.status}`;
}
