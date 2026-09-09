"use client";

import { useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useOptionalCanvasShellSessionContext } from "@/components/auth/canvas-shell-session-provider";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import {
  adminFromToolsSessionPayload,
} from "@/lib/canvas/use-canvas-shell-session";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";

const SESSION_REFRESH_DEBOUNCE_MS = 30_000;

function isPlatformAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function resolveCanvasPortalAdmin(
  base: string,
  signal?: AbortSignal,
  toolsRaw?: unknown,
): Promise<boolean> {
  const payload =
    toolsRaw ??
    (await fetchCanvasToolsSessionFull().catch(() => null));

  const fromTools = adminFromToolsSessionPayload(payload);
  if (fromTools === true) return true;
  if (fromTools === false) return false;

  const viewer = await fetchCanvasViewerUser(base, signal).catch(() => null);
  return Boolean(viewer?.role && isPlatformAdminRole(viewer.role));
}

/** 门户 · 是否平台管理员（优先 tools-session，不确定时再 viewer-session） */
export function useCanvasAdmin(): boolean {
  const base = useBookMallBaseUrl();
  const shared = useOptionalCanvasShellSessionContext();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!base?.trim()) {
      setIsAdmin(false);
      return;
    }
    const ac = new AbortController();
    let debounceTimer: ReturnType<typeof window.setTimeout> | null = null;
    let lastLoadAt = 0;

    const load = () => {
      void resolveCanvasPortalAdmin(base, ac.signal, shared?.payload ?? undefined)
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
  }, [base, shared?.payload]);

  return isAdmin;
}
