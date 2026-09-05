import type { PortalKey } from "@private/federated-portal-nav";
import { isPublicBrowsePortalApp } from "@private/federated-portal-nav";

import {
  getCanvasWebOrigin,
  getCommonToolsOrigin,
  getEcommerceWebOrigin,
  getPublisherWebOrigin,
  getQuickReplicaOrigin,
  getStoryWebOrigin,
  getToolWebOrigin,
} from "@/lib/app-web-origins";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";

type BookOpenPageSlug =
  | "canvas-open"
  | "common-tools-open"
  | "ecom-open"
  | "publisher-open"
  | "quick-replica-open"
  | "story-open"
  | "tools-open";

const BOOK_OPEN_PAGE_BY_APP: Partial<Record<PortalKey, BookOpenPageSlug>> = {
  canvas: "canvas-open",
  "common-tools": "common-tools-open",
  "e-commerce": "ecom-open",
  publisher: "publisher-open",
  "quick-replica": "quick-replica-open",
  story: "story-open",
  tool: "tools-open",
};

export function buildBookPortalOpenPageHref(
  app: PortalKey,
  path = "/",
): string | null {
  const page = BOOK_OPEN_PAGE_BY_APP[app];
  if (!page) return null;
  if (app === "tool") {
    const safe = sanitizeToolsRedirectPath(path);
    return `/${page}?redirect=${encodeURIComponent(safe)}`;
  }
  const safe = sanitizeAppRedirectPath(path, "/");
  return `/${page}?path=${encodeURIComponent(safe)}`;
}

export function resolvePortalAppOrigin(app: PortalKey): string | null {
  switch (app) {
    case "canvas":
      return getCanvasWebOrigin();
    case "story":
      return getStoryWebOrigin();
    case "tool":
      return getToolWebOrigin();
    case "publisher":
      return getPublisherWebOrigin();
    case "quick-replica":
      return getQuickReplicaOrigin();
    case "e-commerce":
      return getEcommerceWebOrigin();
    case "common-tools":
      return getCommonToolsOrigin();
    default:
      return null;
  }
}

/** 未登录：公开应用直达子域；已登录：走 SSO re-enter。 */
export function resolveBookAppOpenTargetUrl(args: {
  app: PortalKey;
  path?: string;
  loggedIn: boolean;
}): string {
  const path = sanitizeAppRedirectPath(args.path, "/");
  if (!args.loggedIn && isPublicBrowsePortalApp(args.app)) {
    const origin = resolvePortalAppOrigin(args.app)?.replace(/\/$/, "");
    if (origin) return `${origin}${path}`;
  }
  const params = new URLSearchParams({ redirect: path });
  if (args.app !== "tool") params.set("app", args.app);
  return `/api/sso/tools/re-enter?${params.toString()}`;
}

export { isPublicBrowsePortalApp };
