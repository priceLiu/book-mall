"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TOOL_NAV_ITEMS } from "@/config/nav-tools";
import { ToolUsageBeacon } from "@/components/tool-usage-beacon";
import { mapFetchToolsSessionResultToShell } from "@/lib/map-fetch-tools-session";
import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";

export type { ToolShellSession } from "@/lib/tool-shell-session-types";

export type ToolsSessionContextValue = {
  /** 正在请求 `/api/tools-session`（仅有 Cookie 时为 true） */
  loading: boolean;
  session: ToolShellSession;
  /** 请求开始时浏览器是否带有 tools_token */
  hasTokenCookie: boolean;
  refetch: () => Promise<void>;
};

const ToolsSessionContext = createContext<ToolsSessionContextValue | null>(
  null,
);

export function useToolsSession(): ToolsSessionContextValue {
  const ctx = useContext(ToolsSessionContext);
  if (!ctx) {
    throw new Error("useToolsSession 须在 ToolShellClient 子树内使用");
  }
  return ctx;
}

function avatarLooksAbsolute(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export function ToolShellClient({
  children,
  mainOrigin,
  hasTokenCookie,
}: {
  children: React.ReactNode;
  mainOrigin: string | null;
  hasTokenCookie: boolean;
}) {
  const pathname = usePathname() || "/";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(hasTokenCookie));
  const [session, setSession] = useState<ToolShellSession>(
    hasTokenCookie ? GUEST_TOOL_SHELL_SESSION : GUEST_TOOL_SHELL_SESSION,
  );

  const loadSession = useCallback(async () => {
    if (!hasTokenCookie) {
      setLoading(false);
      setSession(GUEST_TOOL_SHELL_SESSION);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await r.json()) as FetchToolsSessionResult;
      setSession(mapFetchToolsSessionResultToShell(data));
    } catch {
      setSession(GUEST_TOOL_SHELL_SESSION);
    } finally {
      setLoading(false);
    }
  }, [hasTokenCookie]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const ctxValue = useMemo<ToolsSessionContextValue>(
    () => ({
      loading,
      session,
      hasTokenCookie,
      refetch: loadSession,
    }),
    [loading, session, hasTokenCookie, loadSession],
  );

  const renewHref =
    mainOrigin != null && mainOrigin.length > 0
      ? `${mainOrigin.replace(/\/$/, "")}/api/sso/tools/re-enter?redirect=${encodeURIComponent(pathname)}`
      : null;

  const mainHref = mainOrigin != null ? `${mainOrigin.replace(/\/$/, "")}/` : null;

  const displayName =
    session.name?.trim() ||
    session.email?.trim() ||
    (session.sub
      ? session.sub.length <= 14
        ? session.sub
        : `${session.sub.slice(0, 12)}…`
      : null) ||
    (session.active ? "已登录用户" : null);

  const avatarUrl = session.image?.trim() ?? "";
  const safeAvatar = avatarUrl && avatarLooksAbsolute(avatarUrl) ? avatarUrl : "";
  const fallbackInitial =
    displayName && displayName.length > 0
      ? displayName.charAt(0).toUpperCase()
      : "?";

  const userSlot = (() => {
    if (loading && hasTokenCookie) {
      return (
        <span className="tool-user-loading" title="正在校验工具站令牌">
          校验会话…
        </span>
      );
    }
    if (!hasTokenCookie) {
      return <span className="tool-user-guest">未建立工具站会话</span>;
    }
    if (!session.active) {
      return (
        <span className="tool-user-guest" title="令牌过期或主站侧已不再满足准入">
          会话无效或已过期
        </span>
      );
    }
    const title =
      session.email ?? session.name ?? session.sub ?? undefined;
    return (
      <div className="tool-user-meta">
        <div className="tool-user-row">
          {safeAvatar ? (
            <img
              src={safeAvatar}
              alt=""
              width={32}
              height={32}
              className="tool-user-avatar tool-user-avatar--img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="tool-user-avatar tool-user-avatar--fallback" aria-hidden>
              {fallbackInitial}
            </span>
          )}
          <span className="tool-user-name" title={title}>
            {displayName ?? "已登录用户"}
          </span>
          {session.toolsRole ? (
            <span className="tool-user-badge">
              {session.toolsRole === "admin" ? "管理员" : "会员"}
            </span>
          ) : null}
        </div>
        {session.sub ? (
          <span
            className="tool-user-id"
            title={`主站用户 ID（审计 / 计费关联）：${session.sub}`}
          >
            ID{" "}
            {session.sub.length > 22
              ? `${session.sub.slice(0, 20)}…`
              : session.sub}
          </span>
        ) : null}
      </div>
    );
  })();

  return (
    <ToolsSessionContext.Provider value={ctxValue}>
      <div className="tool-root">
        {sidebarOpen ? (
          <button
            type="button"
            className="tool-sidebar-backdrop"
            aria-label="关闭菜单"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          id="tool-sidebar-nav"
          className={`tool-sidebar ${sidebarOpen ? "tool-sidebar--open" : ""}`}
          aria-label="主导航"
        >
          <div className="tool-sidebar-head">
            <Link href="/" className="tool-brand" onClick={() => setSidebarOpen(false)}>
              AI 工具站
            </Link>
          </div>

          <nav className="tool-sidebar-body">
            <ul className="tool-nav-sub tool-nav-sub--top">
              <li className="tool-nav-li">
                {mainHref ? (
                  <Link
                    href={mainHref}
                    className="tool-nav-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                  >
                    回到主站
                  </Link>
                ) : (
                  <span className="tool-nav-link tool-nav-link--disabled" aria-disabled="true">
                    未配置主站地址
                  </span>
                )}
              </li>
            </ul>

            <hr className="tool-sidebar-divider" />

            <details className="tool-nav-details" open>
              <summary className="tool-nav-summary">工具列表</summary>
              <ul className="tool-nav-sub">
                {TOOL_NAV_ITEMS.map((item) => (
                  <li
                    key={item.href}
                    className={
                      item.showOnMobile === false
                        ? "tool-nav-li tool-nav-li--desktop-only"
                        : "tool-nav-li"
                    }
                  >
                    <Link
                      href={item.href}
                      className={
                        pathname === item.href || pathname.startsWith(`${item.href}/`)
                          ? "tool-nav-link tool-nav-link--active"
                          : "tool-nav-link"
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </nav>
        </aside>

        <div className="tool-column">
          <header className="tool-topbar">
            <button
              type="button"
              className="tool-menu-btn"
              aria-expanded={sidebarOpen}
              aria-controls="tool-sidebar-nav"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              菜单
            </button>

            <div className="tool-topbar-fill" />

            <div className="tool-user">
              {userSlot}
              {renewHref ? (
                <Link href={renewHref} className="tool-renew">
                  重新连接
                </Link>
              ) : null}
            </div>
          </header>

          <main className="tool-main-scroll">{children}</main>
        </div>

        <ToolUsageBeacon enabled={!loading && session.active} />
      </div>
    </ToolsSessionContext.Provider>
  );
}
