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
  const bootCached = getCachedToolsSession();
  const [payload, setPayload] = useState<CanvasToolsSessionClientPayload | null>(
    bootCached,
  );
  const [loading, setLoading] = useState(
    !(bootCached?.active || readToolsSessionOkHint()),
  );

  const session = useMemo(
    () =>
      payload?.active
        ? mapFetchToolsSessionResultToShell(payload)
        : bootCached?.active
          ? mapFetchToolsSessionResultToShell(bootCached)
          : readToolsSessionOkHint()
            ? { ...GUEST_TOOL_SHELL_SESSION, active: true }
            : GUEST_TOOL_SHELL_SESSION,
    [bootCached, payload],
  );

  const refreshFull = useCallback(async () => {
    const next = await fetchCanvasToolsSessionFull();
    if (next.active) setCachedToolsSession(next);
    setPayload(next);
    setLoading(false);
    return next;
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
    if (bootCached?.active) {
      setLoading(false);
      void refreshFull();
      return;
    }
    if (readToolsSessionOkHint()) {
      setLoading(false);
      void refreshFull();
      return;
    }
    void refreshFull();
  }, [bootCached?.active, refreshFull]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshFull();
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () =>
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
  }, [refreshFull]);

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
