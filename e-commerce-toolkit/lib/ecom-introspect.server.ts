import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export type EcomIntrospectResult = {
  active: boolean;
  payload: Record<string, unknown> | null;
};

/** 服务端读取工具站会话原始 introspect（供个人中心展示积分等）。 */
export async function fetchEcomIntrospect(): Promise<EcomIntrospectResult> {
  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin();
  if (!token || !origin) return { active: false, payload: null };

  let res: Response;
  try {
    res = await fetch(`${origin}/api/sso/tools/introspect`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { active: false, payload: null };
  }
  if (!res.ok) return { active: false, payload: null };

  const payload = (await res.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  return { active: payload?.active === true, payload };
}
