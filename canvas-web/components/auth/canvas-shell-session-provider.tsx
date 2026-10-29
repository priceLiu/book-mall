"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchCanvasToolsSessionFull,
  fetchCanvasToolsSessionLite,
  type CanvasToolsSessionClientPayload,
} from "@/lib/canvas-tools-session-fetch";
import {
  mapFetchToolsSessionResultToShell,
} from "@/lib/map-fetch-tools-session";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";
import {
  getCachedToolsSession,
  readToolsSessionOkHint,
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";

type CanvasShellSessionContextValue = {
  loading: boolean;
  session: ToolShellSession;
  payload: CanvasToolsSessionClientPayload | null;
  refreshFull: () => Promise<CanvasToolsSessionClientPayload>;
  refreshLite: () => Promise<CanvasToolsSessionClientPayload>;
};

const CanvasShellSessionContext =
  createContext<CanvasShellSessionContextValue | null>(null);

export function useCanvasShellSessionContext(): CanvasShellSessionContextValue {
  const ctx = useContext(CanvasShellSessionContext);
  if (!ctx) {
    throw new Error(
      "useCanvasShellSessionContext must be used within CanvasShellSessionProvider",
    );
  }
  return ctx;
}

/** 可选读取：未包裹 Provider 时返回 null */
export function useOptionalCanvasShellSessionContext(): CanvasShellSessionContextValue | null {
  return useContext(CanvasShellSessionContext);
}

export function CanvasShellSessionProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<CanvasToolsSessionClientPayload | null>(
    null,
  );
  const [hintActive, setHintActive] = useState(false);
  /** 首屏必须与服务端一致。sessionStorage / 内存缓存只在挂载后读，避免水合时顶栏 span 对不上。 */
  const [loading, setLoading] = useState(true);

  const session = useMemo(
    () =>
      payload?.active
        ? mapFetchToolsSessionResultToShell(payload)
        : hintActive
          ? { ...GUEST_TOOL_SHELL_SESSION, active: true }
          : GUEST_TOOL_SHELL_SESSION,
    [hintActive, payload],
  );

  const refreshFull = useCallback(async () => {
    try {
      const next = await fetchCanvasToolsSessionFull();
      if (next.active) setCachedToolsSession(next);
      setPayload(next);
      setLoading(false);
      return next;
    } catch {
      const cached = getCachedToolsSession();
      if (cached?.active) setPayload(cached);
      setLoading(false);
      return (
        cached ?? {
          active: false,
          hasCookie: false,
          originConfigured: false,
          introspectStatus: null,
          introspect: null,
        }
      );
    }
  }, []);

  const refreshLite = useCallback(async () => {
    const next = await fetchCanvasToolsSessionLite();
    setPayload((prev) => {
      if (next.active && prev?.introspect) {
        return { ...prev, active: true, hasCookie: next.hasCookie };
      }
      return next;
    });
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    const cached = getCachedToolsSession();
    if (cached?.active) {
      setPayload(cached);
      setLoading(false);
    } else if (readToolsSessionOkHint()) {
      setHintActive(true);
      setLoading(false);
    }
    void refreshFull();
  }, [refreshFull]);

  useEffect(() => {
    /** POST 续签成功后轻量拉取即可；避免拖动/心跳时 full introspect 失败弹红屏 */
    const onRefresh = () => {
      void refreshLite().catch(() => {});
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () =>
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
  }, [refreshLite]);

  const value = useMemo(
    () => ({
      loading,
      session,
      payload,
      refreshFull,
      refreshLite,
    }),
    [loading, session, payload, refreshFull, refreshLite],
  );

  return (
    <CanvasShellSessionContext.Provider value={value}>
      {children}
    </CanvasShellSessionContext.Provider>
  );
}
