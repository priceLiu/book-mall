import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

/** 试衣成功成片落 OSS 后上报主站「工具使用」事件（与 ToolUsageBeacon 路径 toolKey 约定一致）。 */
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
    await fetch(`${origin}/api/sso/tools/usage`, {
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
  } catch {
    /* 不打断试衣主流程 */
  }
}
