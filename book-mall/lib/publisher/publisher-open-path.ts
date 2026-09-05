import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";

/** book-mall → publisher-web SSO 打开路径（含扩展 / 桌面 client 参数） */
export function buildPublisherOpenHref(input?: {
  path?: string;
  client?: "extension" | "desktop";
}): string {
  const params = new URLSearchParams();
  const path = sanitizeAppRedirectPath(input?.path, "/");
  if (path && path !== "/") params.set("path", path);
  if (input?.client) params.set("client", input.client);
  const q = params.toString();
  return q ? `/publisher-open?${q}` : "/publisher-open";
}

/** publisher-open 解析后的 publisher-web 内 redirect（传给 re-enter） */
export function resolvePublisherReEnterRedirect(input: {
  path?: string | null;
  client?: string | null;
}): string {
  const path = sanitizeAppRedirectPath(input.path, "/");
  const client = input.client?.trim();

  if (client === "extension" || client === "desktop") {
    return `/login?client=${encodeURIComponent(client)}`;
  }

  if (!client) return path;

  if (path === "/login" || path.startsWith("/login?")) {
    if (path.includes("client=")) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}client=${encodeURIComponent(client)}`;
  }

  return path;
}

/** 下载页 · 扩展绑定入口（经 Book SSO，避免直连错端口） */
export function getPublisherExtensionConnectHref(): string {
  return buildPublisherOpenHref({ path: "/login", client: "extension" });
}
