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
import { Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { refreshCanvasToolsSessionClient } from "@/lib/canvas-tools-session-client";
import { invalidateAllToolbarPanelCache } from "@/lib/canvas/toolbar-panel-cache";
import {
  bookMallReEnterHref,
} from "@/lib/platform-sso-links";

type CanvasToolsSessionState = {
  refreshing: boolean;
  refreshError: string | null;
  refreshSession: () => Promise<boolean>;
};

const CanvasToolsSessionContext = createContext<CanvasToolsSessionState | null>(
  null,
);

export function useCanvasToolsSession(): CanvasToolsSessionState {
  const ctx = useContext(CanvasToolsSessionContext);
  if (!ctx) {
    throw new Error("useCanvasToolsSession must be used within CanvasToolsSessionProvider");
  }
  return ctx;
}

export function CanvasToolsSessionProvider({ children }: { children: ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const ok = await refreshCanvasToolsSessionClient();
      if (ok) {
        invalidateAllToolbarPanelCache();
        return true;
      }
      setRefreshError("工具站登录令牌已失效，请重新连接主站账号。");
      return false;
    } catch {
      setRefreshError("无法续签登录状态，请检查网络或稍后重试。");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const onRefreshed = () => {
      invalidateAllToolbarPanelCache();
      setRefreshError(null);
    };
    const onExpired = () => {
      setRefreshError("工具站登录令牌已失效，请重新连接主站账号。");
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefreshed);
    window.addEventListener("canvas:tools-session-expired", onExpired);
    return () => {
      window.removeEventListener("canvas:tools-session-refreshed", onRefreshed);
      window.removeEventListener("canvas:tools-session-expired", onExpired);
    };
  }, []);

  const value = useMemo(
    () => ({ refreshing, refreshError, refreshSession }),
    [refreshError, refreshSession, refreshing],
  );

  return (
    <CanvasToolsSessionContext.Provider value={value}>
      {children}
    </CanvasToolsSessionContext.Provider>
  );
}

export function CanvasToolsSessionBanner() {
  const base = useBookMallBaseUrl();
  const { refreshing, refreshError, refreshSession } = useCanvasToolsSession();

  if (!refreshing && !refreshError) return null;

  const redirect =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/canvas";
  const reEnter = bookMallReEnterHref(redirect, "canvas");

  return (
    <div
      className="relative z-[290] shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-100/90"
      role="status"
    >
      {refreshing ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-orange-300/90" />
          正在续签工具站登录…
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{refreshError}</span>
          <button
            type="button"
            className="font-medium text-amber-200 underline underline-offset-2 hover:text-white"
            onClick={() => void refreshSession()}
          >
            重试续签
          </button>
          {reEnter ? (
            <a
              href={reEnter}
              className="font-medium text-amber-200 underline underline-offset-2 hover:text-white"
            >
              重新连接主站账号 →
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
