"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import {
  bookMallLoginHref,
  bookMallReEnterHref,
} from "@/lib/platform-sso-links";
import { getMainSiteOrigin } from "@/lib/site-origin";
import {
  buildSilentReEnterHref,
  shouldAttemptSilentSso,
} from "@/lib/tools-silent-sso";

const SESSION_FETCH_TIMEOUT_MS = 15_000;

async function fetchToolsSessionClient(): Promise<ReturnType<typeof parseToolsSessionPayload>> {
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), SESSION_FETCH_TIMEOUT_MS);
  try {
    const r = await fetch("/api/tools-session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: ac.signal,
    });
    const raw = await r.json().catch(() => null);
    return parseToolsSessionPayload(raw);
  } finally {
    window.clearTimeout(timer);
  }
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const bookMallBase = useBookMallBaseUrl();
  const mainOrigin = getMainSiteOrigin() || bookMallBase || null;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTokenCookie, setHasTokenCookie] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const silentAttemptedRef = useRef(false);

  const redirectToSso = useCallback(() => {
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/projects";
    const reEnter =
      buildSilentReEnterHref(mainOrigin, path, "canvas") ||
      bookMallReEnterHref(path, "canvas");
    if (reEnter) {
      window.location.href = reEnter;
      return true;
    }
    const login = bookMallLoginHref(
      typeof window !== "undefined" ? window.location.href : "/",
    );
    if (login) {
      window.location.href = login;
      return true;
    }
    return false;
  }, [mainOrigin]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchToolsSessionClient();
      setHasTokenCookie(Boolean(data.hasCookie));
      setSessionActive(Boolean(data.active));
      if (data.active) {
        setReady(true);
        return;
      }
      setReady(false);
    } catch (e) {
      setHasTokenCookie(false);
      setSessionActive(false);
      setReady(false);
      const aborted =
        e instanceof Error &&
        (e.name === "AbortError" || e.message.includes("aborted"));
      setError(
        aborted
          ? "连接主站超时（常见于 book-mall 冷启动）。请点「重新连接」或确认 pnpm dev:all 已启动。"
          : "无法校验登录状态，请检查网络或主站是否可访问。",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  /** 会话无效时自动跳转 re-enter（一次），与 tool-web 壳层一致 */
  useEffect(() => {
    if (silentAttemptedRef.current) return;
    if (
      !shouldAttemptSilentSso({
        hasTokenCookie,
        sessionActive,
        loading,
      })
    ) {
      return;
    }
    if (error) return;
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/projects";
    const href =
      buildSilentReEnterHref(mainOrigin, path, "canvas") ||
      bookMallReEnterHref(path, "canvas");
    if (!href) return;
    silentAttemptedRef.current = true;
    window.location.href = href;
  }, [loading, hasTokenCookie, sessionActive, mainOrigin, error]);

  if (ready) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <div className="flex items-center">
          <Loader2 className="mr-2 size-5 animate-spin" />
          连接 Book 账号…
        </div>
        <p className="text-xs text-zinc-500">正在校验工具站令牌（最多约 15 秒）</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--canvas-bg)] px-6 text-center text-[var(--canvas-muted)]">
      <p className="max-w-md text-sm text-zinc-300">
        {error ??
          (hasTokenCookie
            ? "工具站令牌已失效，请重新连接主站账号。"
            : "尚未建立画布会话，请连接 Book 账号后继续使用。")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          onClick={() => {
            silentAttemptedRef.current = false;
            void loadSession();
          }}
        >
          重新连接
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/15 px-4 py-2 text-sm text-[var(--canvas-accent)] transition hover:bg-[var(--canvas-accent)]/25"
          onClick={() => {
            if (!redirectToSso()) {
              setError(
                "未配置 MAIN_SITE_ORIGIN / NEXT_PUBLIC_BOOK_MALL_URL，无法跳转登录。",
              );
            }
          }}
        >
          去主站登录 / 换票
        </button>
      </div>
    </div>
  );
}
