import { buildBookPortalLoginHref } from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

export function bookMallReEnterHref(redirectPath: string, app: "canvas" | "story"): string | null {
  const origin = getMainSiteOrigin();
  if (!origin) return null;
  const q = new URLSearchParams({ app, redirect: redirectPath });
  return `${origin}/api/sso/tools/re-enter?${q}`;
}

export function bookMallLoginHref(redirectPath: string): string | null {
  const origin = getMainSiteOrigin();
  if (!origin) return null;
  return buildBookPortalLoginHref(origin, "canvas", redirectPath);
}
