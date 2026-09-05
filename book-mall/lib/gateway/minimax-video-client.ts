/**
 * MiniMax H3 视频 · 上游 HTTP 客户端
 */

import {
  readVendorRequestIdFromHeaders,
  readVendorRequestIdFromJson,
} from "@/lib/gateway/vendor-request-id";
import {
  resolveMinimaxApiRoot,
  minimaxAuthHeaders,
} from "@/lib/gateway/minimax-speech-proxy";
import {
  resolveMinimaxVideoTaskEndpoint,
  type MinimaxVideoTaskKind,
} from "@/lib/gateway/minimax-video-models";

export type MinimaxVideoTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | string;

export type MinimaxVideoTaskRow = {
  id?: string;
  model?: string;
  status?: MinimaxVideoTaskStatus;
  error?: { code?: string; message?: string };
  created_at?: number;
  updated_at?: number;
  content?: { url?: string; prompt?: string };
  resolution?: string;
  duration?: number;
  usage?: {
    total_seconds?: number;
    input_seconds?: number;
    output_seconds?: number;
    input_image_count?: number;
    input_audio_seconds?: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  ratio?: string;
  task_type?: MinimaxVideoTaskKind;
  modality?: "video" | "text";
};

export class MinimaxVideoUpstreamError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly vendorTaskId?: string;

  constructor(
    message: string,
    opts: { status: number; requestId?: string; vendorTaskId?: string },
  ) {
    super(message);
    this.name = "MinimaxVideoUpstreamError";
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.vendorTaskId = opts.vendorTaskId;
  }
}

function minimaxVideoUpstreamError(
  prefix: string,
  status: number,
  r: Response,
  json: unknown,
  fallbackText: string,
): MinimaxVideoUpstreamError {
  const oai = json as {
    error?: { message?: string; type?: string };
    message?: string;
  };
  const msg =
    oai?.error?.message ??
    oai?.message ??
    fallbackText.slice(0, 400);
  const requestId =
    readVendorRequestIdFromHeaders(r.headers) ??
    readVendorRequestIdFromJson(json) ??
    undefined;
  const vendorTaskId =
    (json as { task_id?: string })?.task_id ??
    (json as { task?: { id?: string } })?.task?.id ??
    undefined;
  return new MinimaxVideoUpstreamError(`${prefix} (${status}): ${msg}`, {
    status,
    requestId,
    vendorTaskId,
  });
}

function parseOaiErrorJson(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as { type?: string; error?: { message?: string } };
  if (o.type === "error" && o.error?.message) return o.error.message;
  return null;
}

export async function minimaxSubmitVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  modelKey: string;
  body: Record<string, unknown>;
}): Promise<{ taskId: string; requestId?: string; raw: unknown }> {
  const root = resolveMinimaxApiRoot(opts.baseUrl);
  const path = resolveMinimaxVideoTaskEndpoint(opts.modelKey);
  const url = `${root}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: minimaxAuthHeaders(opts.apiKey),
    body: JSON.stringify(opts.body),
  });
  const text = await r.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 400) };
  }
  if (!r.ok) {
    throw minimaxVideoUpstreamError("MiniMax video submit", r.status, r, json, text);
  }
  const oaiErr = parseOaiErrorJson(json);
  if (oaiErr) {
    throw minimaxVideoUpstreamError("MiniMax video submit", 400, r, json, oaiErr);
  }
  const taskId =
    (json as { task_id?: string })?.task_id ??
    (json as { data?: { task_id?: string } })?.data?.task_id;
  if (!taskId?.trim()) {
    throw new MinimaxVideoUpstreamError("MiniMax 未返回 task_id", {
      status: 502,
      requestId: readVendorRequestIdFromJson(json) ?? undefined,
    });
  }
  return {
    taskId: taskId.trim(),
    requestId:
      readVendorRequestIdFromHeaders(r.headers) ??
      readVendorRequestIdFromJson(json) ??
      undefined,
    raw: json,
  };
}

export async function minimaxQueryVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  taskId: string;
}): Promise<{ task: MinimaxVideoTaskRow; raw: unknown; requestId?: string }> {
  const root = resolveMinimaxApiRoot(opts.baseUrl);
  const url = `${root}/v2/query/video_generation/${encodeURIComponent(opts.taskId)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: minimaxAuthHeaders(opts.apiKey),
  });
  const text = await r.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 400) };
  }
  if (!r.ok) {
    throw minimaxVideoUpstreamError("MiniMax video query", r.status, r, json, text);
  }
  const oaiErr = parseOaiErrorJson(json);
  if (oaiErr) {
    throw minimaxVideoUpstreamError("MiniMax video query", 400, r, json, oaiErr);
  }
  const task = (json as { task?: MinimaxVideoTaskRow })?.task ?? {};
  return {
    task,
    raw: json,
    requestId:
      readVendorRequestIdFromHeaders(r.headers) ??
      readVendorRequestIdFromJson(json) ??
      undefined,
  };
}

export async function minimaxListVideoTasks(opts: {
  apiKey: string;
  baseUrl?: string | null;
  query?: Record<string, string | number | undefined>;
}): Promise<{ raw: unknown }> {
  const root = resolveMinimaxApiRoot(opts.baseUrl);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null && String(v).trim() !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  const url = `${root}/v2/query/video_generation${q ? `?${q}` : ""}`;
  const r = await fetch(url, {
    method: "GET",
    headers: minimaxAuthHeaders(opts.apiKey),
  });
  const text = await r.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 400) };
  }
  if (!r.ok) {
    throw minimaxVideoUpstreamError("MiniMax video list", r.status, r, json, text);
  }
  return { raw: json };
}

export async function minimaxDeleteVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  taskId: string;
}): Promise<{ raw: unknown }> {
  const root = resolveMinimaxApiRoot(opts.baseUrl);
  const url = `${root}/v2/query/video_generation/${encodeURIComponent(opts.taskId)}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: minimaxAuthHeaders(opts.apiKey),
  });
  const text = await r.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 400) };
  }
  if (!r.ok) {
    throw minimaxVideoUpstreamError("MiniMax video delete", r.status, r, json, text);
  }
  return { raw: json };
}

export function isMinimaxVideoTaskSuccess(task: MinimaxVideoTaskRow): boolean {
  return String(task.status ?? "").toLowerCase() === "succeeded";
}

export function isMinimaxVideoTaskFailed(task: MinimaxVideoTaskRow): boolean {
  const s = String(task.status ?? "").toLowerCase();
  return s === "failed" || s === "cancelled";
}

export function isMinimaxVideoTaskInProgress(task: MinimaxVideoTaskRow): boolean {
  const s = String(task.status ?? "").toLowerCase();
  return s === "queued" || s === "running" || s === "processing";
}

export function minimaxVideoTaskFailMessage(task: MinimaxVideoTaskRow): string {
  if (typeof task.error === "object" && task.error?.message) {
    return String(task.error.message);
  }
  return `MiniMax 视频任务失败 (${task.status ?? "unknown"})`;
}

export function minimaxVideoTaskResultUrl(task: MinimaxVideoTaskRow): string | null {
  const url = task.content?.url?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function minimaxVideoTaskEnhancedPrompt(task: MinimaxVideoTaskRow): string | null {
  const p = task.content?.prompt?.trim();
  return p || null;
}
