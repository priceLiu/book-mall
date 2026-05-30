import { getMainSiteOrigin } from "@/lib/site-origin";

export function bookMallReEnterHref(
  redirectPath: string,
  app: "prompt-optimizer" = "prompt-optimizer",
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
