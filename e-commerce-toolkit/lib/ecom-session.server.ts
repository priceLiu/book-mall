import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

export type EcomShellUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export async function getEcomShellUser(): Promise<EcomShellUser | null> {
  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin();
  if (!token || !origin) return null;

  const res = await fetch(`${origin}/api/sso/tools/introspect`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    active?: boolean;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;

  if (!data?.active) return null;

  const email = typeof data.email === "string" ? data.email.trim() : "";
  const name =
    (typeof data.name === "string" && data.name.trim()) ||
    email.split("@")[0] ||
    "用户";

  return {
    name,
    email: email || "—",
    avatarUrl:
      typeof data.image === "string" && data.image.trim()
        ? data.image.trim()
        : null,
  };
}
