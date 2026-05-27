/** tool-web → book-mall Gateway DashScope 代理 */

import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function createDashscopeJobFromServer(opts: {
  kind: "tryon" | "wanx" | "video";
  model: string;
  personImageUrl?: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  prompt?: string;
  negativePrompt?: string;
  n?: number;
  videoBody?: Record<string, unknown>;
  clientPage?: string;
}): Promise<
  | { ok: false; reason: "no_session" | "no_origin"; status?: number; error?: string }
  | { ok: true; taskId: string; logId: string; providerKind: string }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/gateway/dashscope`, {
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
    providerKind: String(data.providerKind ?? "DASHSCOPE"),
  };
}

export async function pollDashscopeJobFromServer(opts: {
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

  const r = await fetch(`${origin}/api/sso/tools/gateway/dashscope?${qs}`, {
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
  return {
    ok: true,
    output: (data.output as Record<string, unknown>) ?? {},
  };
}
