import { getMainSiteOrigin } from "@/lib/site-origin";
import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";

export function bookMallReEnterHref(
  redirectPath: string,
  app: typeof QUICK_REPLICA_SSO_APP = QUICK_REPLICA_SSO_APP,
): string | null {
  const origin = getMainSiteOrigin();
  if (!origin) return null;
  const q = new URLSearchParams({ app, redirect: redirectPath });
  return `${origin}/api/sso/tools/re-enter?${q}`;
}

export function bookMallLoginHref(returnTo: string): string | null {
  const origin = getMainSiteOrigin();
  if (!origin) return null;
  return `${origin}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}
