"use client";

import { useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";

function isPlatformAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function resolveCanvasPortalAdmin(
  base: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const viewerP = fetchCanvasViewerUser(base, signal).catch(() => null);
  const toolsP = fetch("/api/tools-session", { cache: "no-store", signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const [viewer, toolsRaw] = await Promise.all([viewerP, toolsP]);
  if (viewer?.role && isPlatformAdminRole(viewer.role)) return true;

  const tools = parseToolsSessionPayload(toolsRaw);
  const intro = tools.introspect;
  if (intro && typeof intro === "object") {
    const o = intro as Record<string, unknown>;
    if (o.tools_role === "admin" || o.tier === "admin") return true;
  }
  return false;
}

/** 门户 · 是否平台管理员（viewer-session ADMIN 或 tools_role admin） */
export function useCanvasAdmin(): boolean {
  const base = useBookMallBaseUrl();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!base?.trim()) {
      setIsAdmin(false);
      return;
    }
    const ac = new AbortController();
    const load = () => {
      void resolveCanvasPortalAdmin(base, ac.signal)
        .then(setIsAdmin)
        .catch(() => setIsAdmin(false));
    };
    load();
    window.addEventListener("canvas:tools-session-refreshed", load);
    return () => {
      ac.abort();
      window.removeEventListener("canvas:tools-session-refreshed", load);
    };
  }, [base]);

  return isAdmin;
}
