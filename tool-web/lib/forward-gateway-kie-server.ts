/** tool-web → book-mall Gateway KIE 代理（Grok 图生视频等） */

import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function createKieJobFromServer(opts: {
  kind: "i2v" | "image";
  model: string;
  prompt: string;
  imageUrls?: string[];
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
  mode?: string;
  params?: Record<string, unknown>;
  clientPage?: string;
}): Promise<
  | { ok: false; reason: "no_session" | "no_origin"; status?: number; error?: string }
  | { ok: true; taskId: string; logId: string; providerKind: string }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/gateway/kie`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(opts),
    cache: "no-store",
  });

  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    return {
      ok: false,
      reason: "no_session",
      status: r.status,
      error: typeof data.error === "string" ? data.error : `HTTP ${r.status}`,
    };
  }

  return {
    ok: true,
    taskId: String(data.taskId),
    logId: String(data.logId),
    providerKind: String(data.providerKind ?? "KIE"),
  };
}

export async function pollKieJobFromServer(opts: {
  taskId: string;
  gatewayLogId?: string;
}): Promise<
  | { ok: false; error: string; status?: number }
  | { ok: true; output: Record<string, unknown> }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, error: "未登录", status: 401 };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, error: "未配置 MAIN_SITE_ORIGIN", status: 503 };

  const qs = new URLSearchParams({ taskId: opts.taskId });
  if (opts.gatewayLogId) qs.set("gatewayLogId", opts.gatewayLogId);

  const r = await fetch(`${origin}/api/sso/tools/gateway/kie?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: typeof data.error === "string" ? data.error : `HTTP ${r.status}`,
    };
  }
  const output =
    data.output && typeof data.output === "object" && !Array.isArray(data.output)
      ? (data.output as Record<string, unknown>)
      : {};
  return { ok: true, output };
}
