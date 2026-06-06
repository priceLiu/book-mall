/**
 * 火山方舟 ARK · 视频生成 tasks API（contents/generations/tasks）
 */

import { defaultBaseUrl } from "@/lib/gateway/model-router";
import { resolveVolcengineModelKey } from "@/lib/gateway/volcengine-chat-models";

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

function arkBase(baseUrl?: string | null): string {
  return (baseUrl?.trim() || defaultBaseUrl("VOLCENGINE")).replace(/\/$/, "");
}

export async function volcengineCreateVideoTask(opts: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  body: Record<string, unknown>;
}): Promise<{ taskId: string; raw: unknown }> {
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
    const msg =
      (json as { error?: { message?: string } })?.error?.message ??
      (json as { message?: string })?.message ??
      text.slice(0, 400);
    throw new Error(`火山方舟视频任务提交失败 (${r.status}): ${msg}`);
  }
  const id =
    (json as { id?: string })?.id ??
    (json as { data?: { id?: string } })?.data?.id;
  if (!id) {
    throw new Error("火山方舟未返回 task id");
  }
  return { taskId: id, raw: json };
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
    const msg =
      (json as { error?: { message?: string } })?.error?.message ??
      text.slice(0, 400);
    throw new Error(`火山方舟任务查询失败 (${r.status}): ${msg}`);
  }
  const status = String(json.status ?? "").toLowerCase();
  return {
    output: {
      id: String(json.id ?? opts.taskId),
      status,
      model: typeof json.model === "string" ? json.model : undefined,
      error: json.error,
      content: json.content,
    },
    raw: json,
  };
}

export function isVolcengineVideoTaskSuccess(
  row: VolcengineVideoTaskResult,
): boolean {
  return row.status === "succeeded";
}

export function isVolcengineVideoTaskFailed(
  row: VolcengineVideoTaskResult,
): boolean {
  return row.status === "failed" || row.status === "cancelled";
}

export function volcengineVideoTaskFailMessage(
  row: VolcengineVideoTaskResult,
): string {
  if (typeof row.error === "string") return row.error;
  return row.error?.message ?? `status=${row.status}`;
}
