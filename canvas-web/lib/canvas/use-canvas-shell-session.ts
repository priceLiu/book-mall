"use client";

import { useCallback, useEffect, useState } from "react";

import {
  useOptionalCanvasShellSessionContext,
} from "@/components/auth/canvas-shell-session-provider";
import {
  mapFetchToolsSessionResultToShell,
} from "@/lib/map-fetch-tools-session";
import type { ToolShellSession } from "@/lib/tool-shell-session-types";
import { GUEST_TOOL_SHELL_SESSION } from "@/lib/tool-shell-session-types";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";
import {
  getCachedToolsSession,
  readToolsSessionOkHint,
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";

type ShellSessionState = {
  loading: boolean;
  session: ToolShellSession;
};

const SSR_SHELL_SESSION_STATE: ShellSessionState = {
  loading: true,
  session: GUEST_TOOL_SHELL_SESSION,
};

async function fetchShellSessionLocal(): Promise<ToolShellSession> {
  const parsed = await fetchCanvasToolsSessionFull();
  if (parsed.active) {
    setCachedToolsSession(parsed);
  }
  return mapFetchToolsSessionResultToShell(parsed);
}

/** 门户壳层登录态（与 RequireAuth 同源：tools_token + introspect） */
export function useCanvasShellSession(): ShellSessionState {
  const shared = useOptionalCanvasShellSessionContext();

  const [state, setState] = useState<ShellSessionState>(() => {
    if (shared) {
      return { loading: shared.loading, session: shared.session };
    }
    const cached = getCachedToolsSession();
    if (cached?.active) {
      return {
        loading: false,
        session: mapFetchToolsSessionResultToShell(cached),
      };
    }
    if (readToolsSessionOkHint()) {
      return {
        loading: false,
        session: { ...GUEST_TOOL_SHELL_SESSION, active: true },
      };
    }
    return SSR_SHELL_SESSION_STATE;
  });

  const refresh = useCallback(async () => {
    try {
      const session = await fetchShellSessionLocal();
      setState({ loading: false, session });
    } catch {
      setState({ loading: false, session: GUEST_TOOL_SHELL_SESSION });
    }
  }, []);

  useEffect(() => {
    if (shared) {
      setState({ loading: shared.loading, session: shared.session });
      return;
    }

    const cached = getCachedToolsSession();
    if (cached?.active) {
      setState({
        loading: false,
        session: mapFetchToolsSessionResultToShell(cached),
      });
    } else if (readToolsSessionOkHint()) {
      setState({
        loading: false,
        session: { ...GUEST_TOOL_SHELL_SESSION, active: true },
      });
    }

    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () =>
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
  }, [refresh, shared]);

  return shared
    ? { loading: shared.loading, session: shared.session }
    : state;
}

export function isCanvasPlatformAdmin(session: ToolShellSession): boolean {
  return session.toolsRole === "admin";
}

/** 从 tools-session payload 解析管理员（供 useCanvasAdmin 复用） */
export function adminFromToolsSessionPayload(toolsRaw: unknown): boolean | null {
  const tools = parseToolsSessionPayload(toolsRaw);
  const intro = tools.introspect;
  if (!intro || typeof intro !== "object") return null;
  const o = intro as Record<string, unknown>;
  if (o.tools_role === "admin" || o.tier === "admin") return true;
  if (o.tools_role === "user" || o.tier === "user") return false;
  return null;
}
