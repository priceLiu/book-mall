/**
 * 火山方舟 · 私域/真人人像库 API（透明代理上游）
 * 文档：https://www.volcengine.com/docs/82379/2333601 · https://www.volcengine.com/docs/82379/2333602
 */

import { defaultBaseUrl } from "@/lib/gateway/model-router";

export type VolcenginePortraitLibrary = "virtual" | "real";

function arkBase(baseUrl?: string | null): string {
  return (baseUrl?.trim() || defaultBaseUrl("VOLCENGINE")).replace(/\/$/, "");
}

/** 上游路径前缀（可按官方文档调整） */
export function volcenginePortraitUpstreamPrefix(
  library: VolcenginePortraitLibrary,
): string {
  if (library === "virtual") {
    return (
      process.env.VOLCENGINE_PORTRAIT_VIRTUAL_PREFIX?.trim() ||
      "portrait/virtual_human"
    );
  }
  return (
    process.env.VOLCENGINE_PORTRAIT_REAL_PREFIX?.trim() || "portrait/real_human"
  );
}

export function buildVolcenginePortraitUpstreamPath(
  library: VolcenginePortraitLibrary,
  segments: string[],
): string {
  const prefix = volcenginePortraitUpstreamPrefix(library);
  const tail = segments.map((s) => s.trim()).filter(Boolean);
  return [prefix, ...tail].join("/");
}

export async function volcenginePortraitProxyRequest(opts: {
  apiKey: string;
  baseUrl?: string | null;
  library: VolcenginePortraitLibrary;
  pathSegments: string[];
  method: string;
  body?: unknown;
  query?: Record<string, string>;
}): Promise<{ status: number; text: string; json: unknown }> {
  const base = arkBase(opts.baseUrl);
  const upstreamPath = buildVolcenginePortraitUpstreamPath(
    opts.library,
    opts.pathSegments,
  );
  const qs = opts.query
    ? `?${new URLSearchParams(opts.query).toString()}`
    : "";
  const url = `${base}/${upstreamPath}${qs}`;
  const method = opts.method.toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
  };
  let body: string | undefined;
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const r = await fetch(url, { method, headers, body });
  const text = await r.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: r.status, text, json };
}
