"use client";

import { useEffect, useState } from "react";

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

export function useEcomTemplateImportAccess(): {
  canImport: boolean;
  loading: boolean;
} {
  const [canImport, setCanImport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tools-session")
      .then((r) => r.json())
      .then((s: ToolsSessionShape) => {
        if (!cancelled) {
          setCanImport(canShowEcomTemplateImport(s));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanImport(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { canImport, loading };
}
