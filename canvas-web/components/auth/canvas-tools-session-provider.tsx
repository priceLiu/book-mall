"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  refreshCanvasToolsSessionClient,
  startCanvasToolsSessionKeepalive,
} from "@/lib/canvas-tools-session-client";
import { invalidateAllToolbarPanelCache } from "@/lib/canvas/toolbar-panel-cache";
import { bookMallReEnterHref } from "@/lib/platform-sso-links";
import { SESSION_KICKED_MESSAGE } from "@/lib/session-revoked";

type CanvasToolsSessionState = {
  refreshSession: () => Promise<boolean>;
};

const CanvasToolsSessionContext = createContext<CanvasToolsSessionState | null>(
  null,
);

export function useCanvasToolsSession(): CanvasToolsSessionState {
  const ctx = useContext(CanvasToolsSessionContext);
  if (!ctx) {
    throw new Error(
      "useCanvasToolsSession must be used within CanvasToolsSessionProvider",
    );
  }
  return ctx;
}

/**
 * 画布内 tools_token 静默续签。
 * 禁止顶部技术文案横幅（见 require-auth 静默换票规范）；仅在别处登录时用 Dialog 提示。
 */
export function CanvasToolsSessionProvider({ children }: { children: ReactNode }) {
  const { alert } = useDialogs();
  const base = useBookMallBaseUrl();

  const refreshSession = useCallback(async () => {
    const ok = await refreshCanvasToolsSessionClient({ silent: true, retries: 4 });
    if (ok) {
      invalidateAllToolbarPanelCache();
    }
    return ok;
  }, []);

  useEffect(() => {
    const stopKeepalive = startCanvasToolsSessionKeepalive();
    return stopKeepalive;
  }, []);

  useEffect(() => {
    const onRefreshed = () => {
      invalidateAllToolbarPanelCache();
    };
    const onRevoked = async () => {
      const redirect =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/canvas";
      const reEnter = bookMallReEnterHref(redirect, "canvas");
      const retry = await refreshCanvasToolsSessionClient({
        silent: true,
        retries: 2,
      });
      if (retry) {
        invalidateAllToolbarPanelCache();
        return;
      }
      await alert({
        title: "账号已在别处登录",
        message: SESSION_KICKED_MESSAGE,
        variant: "warning",
      });
      if (reEnter) {
        window.location.href = reEnter;
      }
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefreshed);
    window.addEventListener("canvas:tools-session-revoked", onRevoked);
    return () => {
      window.removeEventListener("canvas:tools-session-refreshed", onRefreshed);
      window.removeEventListener("canvas:tools-session-revoked", onRevoked);
    };
  }, [alert, base]);

  const value = useMemo(() => ({ refreshSession }), [refreshSession]);

  return (
    <CanvasToolsSessionContext.Provider value={value}>
      {children}
    </CanvasToolsSessionContext.Provider>
  );
}

/** @deprecated 画布页不再展示顶部令牌横幅；保留空组件避免旧引用编译失败 */
export function CanvasToolsSessionBanner() {
  return null;
}
