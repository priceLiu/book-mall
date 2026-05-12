"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TOOL_NAV_ENTRIES,
  TOOL_NAV_ITEMS,
  isToolNavGroup,
  type ToolNavEntry,
} from "@/config/nav-tools";
import { ToolUsageBeacon } from "@/components/tool-usage-beacon";
import { mapFetchToolsSessionResultToShell } from "@/lib/map-fetch-tools-session";
import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";

export type { ToolShellSession } from "@/lib/tool-shell-session-types";

export type ToolsSessionContextValue = {
  /** 正在请求 `/api/tools-session` */
  loading: boolean;
  session: ToolShellSession;
  /** 最近一次 `/api/tools-session` 返回的 `hasCookie`（与服务端 Cookie 一致） */
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

function activeHrefMatchesItem(href: string, item: { href: string }) {
  return href === item.href;
}

function groupContainsActive(
  entry: ToolNavEntry,
  activeHref: string | null,
): boolean {
  if (!isToolNavGroup(entry)) return false;
  if (!activeHref) return false;
  return entry.children.some((c) => activeHrefMatchesItem(activeHref, c));
}

function ToolNavTree({
  entries,
  activeHref,
  onNavigate,
}: {
  entries: ToolNavEntry[];
  activeHref: string | null;
  onNavigate: () => void;
}) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const e of entries) {
      if (isToolNavGroup(e)) {
        const hasActive = e.children.some(
          (c) => c.href === activeHref,
        );
        init[e.label] = hasActive || Boolean(e.defaultOpen);
      }
    }
    return init;
  });

  /** 进入组内子项时自动展开该组（不强制收起其它） */
  useEffect(() => {
    if (!activeHref) return;
    setOpenMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const e of entries) {
        if (isToolNavGroup(e) && e.children.some((c) => c.href === activeHref)) {
          if (!next[e.label]) {
            next[e.label] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [entries, activeHref]);

  const toggle = useCallback((label: string) => {
    setOpenMap((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  return (
    <ul className="tool-nav-sub">
      {entries.map((entry) => {
        if (!isToolNavGroup(entry)) {
          const item = entry;
          return (
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
                  activeHrefMatchesItem(activeHref ?? "", item)
                    ? "tool-nav-link tool-nav-link--active"
                    : "tool-nav-link"
                }
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          );
        }

        const open = Boolean(openMap[entry.label]);
        const hasActive = groupContainsActive(entry, activeHref);
        const triggerCls = [
          "tool-nav-group-trigger",
          hasActive ? "tool-nav-group-trigger--has-active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={entry.label} className="tool-nav-li tool-nav-group">
            <button
              type="button"
              className={triggerCls}
              aria-expanded={open}
              onClick={() => toggle(entry.label)}
            >
              <span className="tool-nav-group-label">{entry.label}</span>
              <span
                className={`tool-nav-chevron ${open ? "tool-nav-chevron--open" : ""}`}
                aria-hidden
              >
                ›
              </span>
            </button>
            <div
              className={`tool-nav-group-panel ${open ? "tool-nav-group-panel--open" : ""}`}
              data-open={open ? "1" : "0"}
            >
              <ul className="tool-nav-sublist">
                {entry.children.map((child) => (
                  <li
                    key={child.href}
                    className={
                      child.showOnMobile === false
                        ? "tool-nav-li tool-nav-li--desktop-only"
                        : "tool-nav-li"
                    }
                  >
                    <Link
                      href={child.href}
                      className={
                        activeHrefMatchesItem(activeHref ?? "", child)
                          ? "tool-nav-sublink tool-nav-sublink--active"
                          : "tool-nav-sublink"
                      }
                      onClick={onNavigate}
                    >
                      <span className="tool-nav-sublink-dot" aria-hidden />
                      <span className="tool-nav-sublink-text">{child.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "tool-sidebar-collapsed-desktop";

function persistSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function parseToolsSessionPayload(raw: unknown): FetchToolsSessionResult {
  if (!raw || typeof raw !== "object") {
    return {
      hasCookie: false,
      originConfigured: false,
      introspectStatus: null,
      introspect: null,
      active: false,
    };
  }
  const o = raw as Record<string, unknown>;
  const { _diag: _ignored, ...rest } = o;
  return rest as FetchToolsSessionResult;
}

export function ToolShellClient({
  children,
  mainOrigin,
}: {
  children: React.ReactNode;
  mainOrigin: string | null;
}) {
  const pathname = usePathname() || "/";

  const activeNavHref = useMemo(() => {
    const sorted = [...TOOL_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
    const hit = sorted.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    return hit?.href ?? null;
  }, [pathname]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsedDesktop, setSidebarCollapsedDesktop] = useState(false);
  const prevPathnameRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ToolShellSession>(GUEST_TOOL_SHELL_SESSION);
  const [hasTokenCookie, setHasTokenCookie] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = await r.json().catch(() => null);
      const data = parseToolsSessionPayload(raw);
      setHasTokenCookie(Boolean(data.hasCookie));
      setSession(mapFetchToolsSessionResultToShell(data));
    } catch {
      setHasTokenCookie(false);
      setSession(GUEST_TOOL_SHELL_SESSION);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1") {
        setSidebarCollapsedDesktop(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsedDesktop = useCallback(() => {
    setSidebarCollapsedDesktop((c) => {
      const next = !c;
      persistSidebarCollapsed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setSidebarCollapsedDesktop(true);
      persistSidebarCollapsed(true);
    }
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

  const emailRaw = session.email?.trim() ?? "";
  const nameRaw = session.name?.trim() ?? "";
  const subCompact =
    session.sub == null || session.sub === ""
      ? ""
      : session.sub.length <= 14
        ? session.sub
        : `${session.sub.slice(0, 12)}…`;

  const primaryLabel =
    nameRaw ||
    emailRaw ||
    subCompact ||
    (session.active ? "已登录用户" : null);

  /** 主行已等于邮箱时不重复第二行；有昵称时再单独显示邮箱 */
  const emailSubline =
    emailRaw.length > 0 && primaryLabel != null && emailRaw !== primaryLabel
      ? emailRaw
      : null;

  const avatarUrl = session.image?.trim() ?? "";
  const safeAvatar = avatarUrl && avatarLooksAbsolute(avatarUrl) ? avatarUrl : "";
  const fallbackInitial =
    (nameRaw || emailRaw || subCompact || "").length > 0
      ? (nameRaw || emailRaw || subCompact).charAt(0).toUpperCase()
      : "?";

  const userSlot = (() => {
    if (loading) {
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
      [nameRaw, emailRaw].filter((s) => s.length > 0).join(" · ") ||
      session.sub ||
      undefined;
    return (
      <div className="tool-user-profile">
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
        <div className="tool-user-text-stack">
          <span className="tool-user-name" title={title}>
            {primaryLabel ?? "已登录用户"}
          </span>
          {emailSubline ? (
            <span className="tool-user-email-line" title={emailSubline}>
              {emailSubline}
            </span>
          ) : null}
        </div>
        {session.toolsRole ? (
          <span className="tool-user-badge">
            {session.toolsRole === "admin" ? "管理员" : "会员"}
          </span>
        ) : null}
      </div>
    );
  })();

  const rootClassName = [
    "tool-root",
    sidebarCollapsedDesktop ? "tool-sidebar-collapsed-desktop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ToolsSessionContext.Provider value={ctxValue}>
      <div className={rootClassName}>
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
            <button
              type="button"
              className="tool-sidebar-pin-btn"
              aria-label={sidebarCollapsedDesktop ? "展开侧栏" : "收起侧栏"}
              aria-expanded={!sidebarCollapsedDesktop}
              title={sidebarCollapsedDesktop ? "展开侧栏" : "收起侧栏"}
              onClick={toggleSidebarCollapsedDesktop}
            >
              <span aria-hidden>{sidebarCollapsedDesktop ? "›" : "‹"}</span>
            </button>
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

            <ToolNavTree
              entries={TOOL_NAV_ENTRIES}
              activeHref={activeNavHref}
              onNavigate={() => setSidebarOpen(false)}
            />
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
              {hasTokenCookie ? (
                <a href="/api/tools-logout" className="tool-logout">
                  退出
                </a>
              ) : null}
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
