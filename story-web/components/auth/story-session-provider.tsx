"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { storyLoginHref } from "@/lib/portal-auth-links";
import { fetchStoryViewerUser } from "@/lib/story-viewer-session";
import {
  displayNameFromIntrospect,
  fetchStoryToolsSession,
} from "@/lib/story-tools-session-client";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";

export type StorySessionSnapshot = {
  /** 首次同步中 */
  loading: boolean;
  /** story-web tools_token 经 introspect 有效 */
  active: boolean;
  displayName: string | null;
};

const StorySessionContext = createContext<StorySessionSnapshot>({
  loading: true,
  active: false,
  displayName: null,
});

export function useStorySession(): StorySessionSnapshot {
  return useContext(StorySessionContext);
}

/** 统一 story-web 登录态：以 `/api/tools-session` 为准；主站已登录则静默换票 */
export function StorySessionProvider({ children }: { children: ReactNode }) {
  const bookOrigin = useBookMallBaseUrl();
  const bridgeAttemptedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<StorySessionSnapshot>({
    loading: true,
    active: false,
    displayName: null,
  });

  const syncSession = useCallback(async () => {
    const tools = await fetchStoryToolsSession();
    if (tools.active) {
      clearSsoReenterAttempts();
      bridgeAttemptedRef.current = false;
      setSnapshot({
        loading: false,
        active: true,
        displayName: displayNameFromIntrospect(tools.introspect),
      });
      return;
    }

    if (
      bookOrigin &&
      !bridgeAttemptedRef.current &&
      !isSsoReenterSuppressedClient() &&
      readSsoReenterAttempts() < MAX_SSO_REENTER_ATTEMPTS
    ) {
      const viewer = await fetchStoryViewerUser(bookOrigin).catch(() => null);
      if (viewer) {
        bridgeAttemptedRef.current = true;
        const path =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/";
        const href = storyLoginHref(path || "/", bookOrigin);
        if (!href.startsWith("/sso-error")) {
          bumpSsoReenterAttempts();
          window.location.href = href;
          return;
        }
      }
    }

    setSnapshot({
      loading: false,
      active: false,
      displayName: null,
    });
  }, [bookOrigin]);

  useEffect(() => {
    void syncSession();
    const onFocus = () => void syncSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncSession]);

  const value = useMemo(() => snapshot, [snapshot]);

  return (
    <StorySessionContext.Provider value={value}>{children}</StorySessionContext.Provider>
  );
}
