import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

/** AI试衣：成片成功且写出计费点后上报主站 try_on（与 Beacon page_view 分离）；详见 doc/payment.md。 */
export async function recordToolUsageFromServer(opts: {
  toolKey: string;
  action: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return;

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return;

  try {
    const r = await fetch(`${origin}/api/sso/tools/usage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolKey: opts.toolKey,
        action: opts.action,
        ...(opts.meta ? { meta: opts.meta } : {}),
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      const detail = (await r.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      console.error("[recordToolUsageFromServer]", r.status, detail);
    }
  } catch (e) {
    console.error("[recordToolUsageFromServer]", e);
  }
}
