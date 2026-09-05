"use client";

import { useEffect, useState } from "react";

import { fetchEcomToolsSessionFull } from "@/lib/ecom-tools-session-client";

type ToolsSessionShape = {
  active?: boolean;
  introspect?: {
    tools_role?: string;
    tier?: string;
  } | null;
};

/** 与 book-mall introspect / JWT tier 对齐 */
export function isEcomToolsAdminSession(session: ToolsSessionShape): boolean {
  const intro = session.introspect;
  if (!intro) return false;
  if (intro.tools_role === "admin") return true;
  if (intro.tier === "admin") return true;
  return false;
}

/** 模板区导入入口：admin；本地 dev 下任意已登录会话也可见（实际上传仍由 API 鉴权） */
export function canShowEcomTemplateImport(session: ToolsSessionShape): boolean {
  if (isEcomToolsAdminSession(session)) return true;
  if (
    process.env.NODE_ENV === "development" &&
    session.active === true &&
    session.introspect
  ) {
    return true;
  }
  return false;
}

const ACCESS_CACHE_KEY = "ecom:template-import-access";
/** introspect 常 10s+，超时后按上次结论渲染，不能让入口一直悬着 */
const ACCESS_PROBE_TIMEOUT_MS = 8000;

function readCachedAccess(): boolean | null {
  try {
    const raw = sessionStorage.getItem(ACCESS_CACHE_KEY);
    return raw === "1" ? true : raw === "0" ? false : null;
  } catch {
    return null;
  }
}

function writeCachedAccess(value: boolean): void {
  try {
    sessionStorage.setItem(ACCESS_CACHE_KEY, value ? "1" : "0");
  } catch {
    /* 隐私模式下不缓存 */
  }
}

/** 超时返回 null：调用方据此保留缓存结论而非误判为无权限 */
function probeSession(): Promise<ToolsSessionShape | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ACCESS_PROBE_TIMEOUT_MS);
    const settle = (value: ToolsSessionShape | null) => {
      window.clearTimeout(timer);
      resolve(value);
    };
    void fetchEcomToolsSessionFull()
      .then((s) => settle(s as ToolsSessionShape))
      .catch(() => settle(null));
  });
}

/**
 * 入口可见性只取决于会话，不该等整页数据。首屏先用会话缓存即时渲染，
 * 再后台校正；探测超时不会把 loading 卡死。
 */
export function useEcomTemplateImportAccess(): {
  canImport: boolean;
  loading: boolean;
} {
  const [canImport, setCanImport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 缓存读取放在 effect 里：SSR 无 sessionStorage，写进初始 state 会导致水合不一致
    const cached = readCachedAccess();
    if (cached !== null) {
      setCanImport(cached);
      setLoading(false);
    }

    void probeSession().then((s) => {
      if (cancelled) return;
      if (s) {
        const allowed = canShowEcomTemplateImport(s);
        setCanImport(allowed);
        writeCachedAccess(allowed);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { canImport, loading };
}

/** 平台管理员（introspect tools_role / tier） */
export function useEcomToolsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchEcomToolsSessionFull()
      .then((s) => {
        if (!cancelled) setIsAdmin(isEcomToolsAdminSession(s as ToolsSessionShape));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
