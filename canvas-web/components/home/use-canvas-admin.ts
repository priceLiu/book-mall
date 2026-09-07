"use client";

import { useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";

const SESSION_REFRESH_DEBOUNCE_MS = 30_000;

function isPlatformAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function adminFromToolsSession(toolsRaw: unknown): boolean | null {
  const tools = parseToolsSessionPayload(toolsRaw);
  const intro = tools.introspect;
  if (!intro || typeof intro !== "object") return null;
  const o = intro as Record<string, unknown>;
  if (o.tools_role === "admin" || o.tier === "admin") return true;
  if (o.tools_role === "user" || o.tier === "user") return false;
  return null;
}

export async function resolveCanvasPortalAdmin(
  base: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const toolsRaw = await fetch("/api/tools-session", { cache: "no-store", signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const fromTools = adminFromToolsSession(toolsRaw);
  if (fromTools === true) return true;
  if (fromTools === false) return false;

  const viewer = await fetchCanvasViewerUser(base, signal).catch(() => null);
  return Boolean(viewer?.role && isPlatformAdminRole(viewer.role));
}

/** 门户 · 是否平台管理员（优先 tools-session，不确定时再 viewer-session） */
export function useCanvasAdmin(): boolean {
  const base = useBookMallBaseUrl();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!base?.trim()) {
      setIsAdmin(false);
      return;
    }
    const ac = new AbortController();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastLoadAt = 0;

    const load = () => {
      void resolveCanvasPortalAdmin(base, ac.signal)
        .then(setIsAdmin)
        .catch(() => setIsAdmin(false));
    };

    const loadDebounced = () => {
      const now = Date.now();
      const elapsed = now - lastLoadAt;
      if (elapsed >= SESSION_REFRESH_DEBOUNCE_MS) {
        lastLoadAt = now;
        load();
        return;
      }
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        lastLoadAt = Date.now();
        load();
      }, SESSION_REFRESH_DEBOUNCE_MS - elapsed);
    };

    lastLoadAt = Date.now();
    load();
    window.addEventListener("canvas:tools-session-refreshed", loadDebounced);
    return () => {
      ac.abort();
      if (debounceTimer) window.clearTimeout(debounceTimer);
      window.removeEventListener("canvas:tools-session-refreshed", loadDebounced);
    };
  }, [base]);

  return isAdmin;
}
