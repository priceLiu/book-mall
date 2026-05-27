/** tool-web → book-mall Gateway Chat 流式代理 */

import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export async function chatStreamFromGateway(body: Record<string, unknown>): Promise<
  | { ok: false; reason: "no_session" | "no_origin"; status?: number; error?: string }
  | { ok: true; response: Response }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/gateway/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: false,
      reason: "no_session",
      status: r.status,
      error: typeof data.error === "string" ? data.error : `HTTP ${r.status}`,
    };
  }

  return { ok: true, response: r };
}
