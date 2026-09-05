"use client";

import { useCallback, useEffect, useState } from "react";

import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import {
  mapFetchToolsSessionResultToShell,
} from "@/lib/map-fetch-tools-session";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";
import { getCachedToolsSession, setCachedToolsSession } from "@/lib/tools-session-client-cache";

type ShellSessionState = {
  loading: boolean;
  session: ToolShellSession;
};

async function fetchShellSession(): Promise<ToolShellSession> {
  const cached = getCachedToolsSession();
  if (cached?.active) {
    return mapFetchToolsSessionResultToShell(cached);
  }
  const r = await fetch("/api/tools-session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const raw = await r.json().catch(() => null);
  const parsed = parseToolsSessionPayload(raw);
  if (parsed.active) {
    setCachedToolsSession(parsed);
  }
  return mapFetchToolsSessionResultToShell(parsed);
}

/** 门户壳层登录态（与 RequireAuth 同源：tools_token + introspect） */
export function useCanvasShellSession(): ShellSessionState {
  const [state, setState] = useState<ShellSessionState>({
    loading: true,
    session: GUEST_TOOL_SHELL_SESSION,
  });

  const refresh = useCallback(async () => {
    try {
      const session = await fetchShellSession();
      setState({ loading: false, session });
    } catch {
      setState({ loading: false, session: GUEST_TOOL_SHELL_SESSION });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () =>
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
  }, [refresh]);

  return state;
}

export function isCanvasPlatformAdmin(session: ToolShellSession): boolean {
  return session.toolsRole === "admin";
}
