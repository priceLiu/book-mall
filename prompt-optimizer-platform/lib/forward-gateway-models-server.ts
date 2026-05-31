/** prompt-optimizer-platform → book-mall Gateway 模型列表 */

import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function fetchGatewayModelsFromBook(): Promise<
  | { ok: false; reason: "no_session" | "no_origin" | "upstream_error"; status?: number; message?: string }
  | { ok: true; data: Record<string, unknown> }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/gateway/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : `HTTP ${r.status}`;
    return { ok: false, reason: "upstream_error", status: r.status, message };
  }

  const data = (await r.json()) as Record<string, unknown>;
  return { ok: true, data };
}
