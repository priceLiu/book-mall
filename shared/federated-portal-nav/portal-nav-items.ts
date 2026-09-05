/** 跨门户 federated 顶栏 · 各子应用共用菜单项 */
export type PortalKey =
  | "common-tools"
  | "canvas"
  | "e-commerce"
  | "quick-replica"
  | "publisher"
  | "story"
  | "tool";

export type PortalNavItem = {
  key: PortalKey;
  label: string;
  href: string | null;
};

/** 未登录也可浏览门户首页；直达子域，使用功能时再登录。 */
export const PUBLIC_BROWSE_PORTAL_APPS = new Set<PortalKey>([
  "canvas",
  "common-tools",
  "e-commerce",
  "publisher",
  "quick-replica",
  "story",
  "tool",
]);

export function isPublicBrowsePortalApp(app: PortalKey): boolean {
  return PUBLIC_BROWSE_PORTAL_APPS.has(app);
}

const DEFAULT_PUBLIC_BROWSE_ORIGINS: Partial<
  Record<PortalKey, { production: string; development: string }>
> = {
  canvas: {
    production: "https://canvas.ai-code8.com",
    development: "http://localhost:3004",
  },
  story: {
    production: "https://story.ai-code8.com",
    development: "http://localhost:3003",
  },
  tool: {
    production: "https://tool.ai-code8.com",
    development: "http://localhost:3001",
  },
  publisher: {
    production: "https://publish.ai-code8.com",
    development: "http://localhost:3011",
  },
  "quick-replica": {
    production: "https://cp.ai-code8.com",
    development: "http://localhost:3008",
  },
  "e-commerce": {
    production: "https://ecom.ai-code8.com",
    development: "http://localhost:3007",
  },
  "common-tools": {
    production: "https://com.ai-code8.com",
    development: "http://localhost:3010",
  },
};

function trimOrigin(raw: string | null | undefined): string | null {
  const v = raw?.trim().replace(/\/$/, "");
  return v && v.startsWith("http") ? v : null;
}

function resolveNavEnvOrigin(...candidates: (string | null | undefined)[]): string | null {
  for (const raw of candidates) {
    const o = trimOrigin(raw);
    if (o) return o;
  }
  return null;
}

function defaultPublicBrowseOrigin(app: PortalKey): string | null {
  const row = DEFAULT_PUBLIC_BROWSE_ORIGINS[app];
  if (!row) return null;
  return process.env.NODE_ENV === "production" ? row.production : row.development;
}

function resolvePortalAppOrigin(
  app: PortalKey,
  ...envCandidates: (string | null | undefined)[]
): string | null {
  return resolveNavEnvOrigin(...envCandidates) ?? defaultPublicBrowseOrigin(app);
}

/**
 * 子站入口链接：公开浏览应用优先直达子域；其余走 Book SSO re-enter。
 */
export function buildPortalEntryHref(args: {
  bookOrigin: string | null;
  app: PortalKey;
  appOrigin: string | null;
  redirect?: string;
}): string | null {
  const redirect = args.redirect?.trim().startsWith("/")
    ? args.redirect.trim()
    : `/${args.redirect?.trim() || ""}`.replace(/^\/+$/, "/") || "/";
  const path = redirect.startsWith("/") ? redirect : `/${redirect}`;
  const origin =
    trimOrigin(args.appOrigin) ??
    (isPublicBrowsePortalApp(args.app) ? defaultPublicBrowseOrigin(args.app) : null);
  const book = args.bookOrigin?.trim().replace(/\/$/, "") ?? null;

  if (isPublicBrowsePortalApp(args.app) && origin) {
    return `${origin}${path}`;
  }

  if (!book) {
    return origin ? `${origin}${path}` : null;
  }

  const params = new URLSearchParams({ redirect: path });
  if (args.app !== "tool") params.set("app", args.app);
  return `${book}/api/sso/tools/re-enter?${params.toString()}`;
}

function portalHref(
  book: string | null,
  app: PortalKey,
  origin: string | null,
  redirect = "/",
): string | null {
  return buildPortalEntryHref({ bookOrigin: book, app, appOrigin: origin, redirect });
}

/** 构建各子站入口 */
export function buildPortalNavItems(bookOrigin: string | null): PortalNavItem[] {
  const canvasOrigin = resolvePortalAppOrigin(
    "canvas",
    process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN,
    process.env.CANVAS_PUBLIC_ORIGIN,
  );
  const qrOrigin = resolvePortalAppOrigin(
    "quick-replica",
    process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN,
    process.env.QUICK_REPLICA_PUBLIC_ORIGIN,
  );
  const ecomOrigin = resolvePortalAppOrigin(
    "e-commerce",
    process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN,
    process.env.ECOMMERCE_PUBLIC_ORIGIN,
  );
  const storyOrigin = resolvePortalAppOrigin(
    "story",
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN,
    process.env.STORY_PUBLIC_ORIGIN,
  );
  const publisherOrigin = resolvePortalAppOrigin(
    "publisher",
    process.env.NEXT_PUBLIC_PUBLISHER_WEB_ORIGIN,
    process.env.PUBLISHER_WEB_PUBLIC_ORIGIN,
  );
  const commonToolsOrigin = resolvePortalAppOrigin(
    "common-tools",
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN,
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN,
  );
  const toolOrigin = resolvePortalAppOrigin(
    "tool",
    process.env.NEXT_PUBLIC_TOOL_WEB_ORIGIN,
    process.env.TOOLS_PUBLIC_ORIGIN,
  );

  return [
    {
      key: "common-tools",
      label: "常用工具",
      href: portalHref(bookOrigin, "common-tools", commonToolsOrigin),
    },
    { key: "canvas", label: "画布", href: portalHref(bookOrigin, "canvas", canvasOrigin) },
    {
      key: "e-commerce",
      label: "电商工具箱",
      href: portalHref(bookOrigin, "e-commerce", ecomOrigin),
    },
    {
      key: "quick-replica",
      label: "快速复刻",
      href: portalHref(bookOrigin, "quick-replica", qrOrigin),
    },
    {
      key: "publisher",
      label: "一键发布",
      href: portalHref(bookOrigin, "publisher", publisherOrigin),
    },
    { key: "story", label: "故事版", href: portalHref(bookOrigin, "story", storyOrigin) },
    {
      key: "tool",
      label: "工具站",
      href: portalHref(bookOrigin, "tool", toolOrigin, "/fitting-room"),
    },
  ];
}
