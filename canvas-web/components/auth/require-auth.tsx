"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import {
  introspectSessionRevoked,
  SESSION_KICKED_MESSAGE,
} from "@/lib/session-revoked";
import {
  bookMallLoginHref,
  bookMallReEnterHref,
} from "@/lib/platform-sso-links";
import { getMainSiteOrigin } from "@/lib/site-origin";
import {
  buildSilentReEnterHref,
  shouldAttemptSilentSso,
} from "@/lib/tools-silent-sso";
import {
  clearSsoExchangeFreshClient,
  isSsoExchangeFreshClient,
} from "@/lib/sso-exchange-fresh";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";

const SESSION_FETCH_TIMEOUT_MS = 20_000;
const SESSION_FETCH_RETRY_DELAY_MS = 800;
const SESSION_FETCH_FRESH_EXCHANGE_RETRIES = 4;
const SESSION_FETCH_FRESH_EXCHANGE_DELAY_MS = 1_200;
const SESSION_POLL_MS = 60_000;

async function fetchToolsSessionClient(): Promise<
  ReturnType<typeof parseToolsSessionPayload>
> {
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

function SessionRevokedPoller({
  enabled,
  onRevoked,
}: {
  enabled: boolean;
  onRevoked: () => void;
}) {
  const { alert } = useDialogs();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      if (shownRef.current) return;
      try {
        const data = await fetchToolsSessionClient();
        if (data.active) return;
        if (!introspectSessionRevoked(data.introspect as Record<string, unknown> | null)) {
          return;
        }
        shownRef.current = true;
        await alert({
          title: "账号已在别处登录",
          message: SESSION_KICKED_MESSAGE,
        });
        onRevoked();
      } catch {
        /* 忽略轮询失败 */
      }
    };

    const id = window.setInterval(() => void poll(), SESSION_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, alert, onRevoked]);

  return null;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const bookMallBase = useBookMallBaseUrl();
  const mainOrigin = getMainSiteOrigin() || bookMallBase || null;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTokenCookie, setHasTokenCookie] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const silentAttemptedRef = useRef(false);
  const loadGenRef = useRef(0);

  const reEnterHref = useCallback(() => {
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/projects";
    return (
      buildSilentReEnterHref(mainOrigin, path, "canvas") ||
      bookMallReEnterHref(path, "canvas")
    );
  }, [mainOrigin]);

  const redirectToSso = useCallback(() => {
    const reEnter = reEnterHref();
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
  }, [reEnterHref]);

  const loadSession = useCallback(async (opts?: { retry?: boolean }) => {
    const gen = ++loadGenRef.current;
    if (!ready || opts?.retry) {
      setLoading(true);
    }
    setError(null);
    const freshExchange = isSsoExchangeFreshClient();
    const maxAttempts = freshExchange
      ? SESSION_FETCH_FRESH_EXCHANGE_RETRIES
      : opts?.retry === false
        ? 1
        : 2;
    const retryDelayMs = freshExchange
      ? SESSION_FETCH_FRESH_EXCHANGE_DELAY_MS
      : SESSION_FETCH_RETRY_DELAY_MS;
    try {
      let data = await fetchToolsSessionClient();
      for (let attempt = 1; attempt < maxAttempts && !data.active; attempt++) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        if (gen !== loadGenRef.current) return;
        data = await fetchToolsSessionClient();
      }
      if (gen !== loadGenRef.current) return;
      setHasTokenCookie(Boolean(data.hasCookie));
      setSessionActive(Boolean(data.active));
      if (data.active) {
        clearSsoExchangeFreshClient();
        setReady(true);
        return;
      }
      setReady(false);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      if (opts?.retry !== false) {
        try {
          await new Promise((r) =>
            setTimeout(r, SESSION_FETCH_RETRY_DELAY_MS),
          );
          if (gen !== loadGenRef.current) return;
          const retryData = await fetchToolsSessionClient();
          if (gen !== loadGenRef.current) return;
          setHasTokenCookie(Boolean(retryData.hasCookie));
          setSessionActive(Boolean(retryData.active));
          if (retryData.active) {
            setReady(true);
            return;
          }
          setReady(false);
        } catch {
          // 二次失败，展示下方错误
        }
      }
      if (gen !== loadGenRef.current) return;
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
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, [ready]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  /** 会话建立成功后清零静默换票计数，便于下一轮失效重新自动换票 */
  useEffect(() => {
    if (ready) {
      clearSsoReenterAttempts();
      clearSsoExchangeFreshClient();
    }
  }, [ready]);

  /**
   * 会话无效时静默自动换票（re-enter），对用户无感。
   * 整页跳转会重新挂载组件，故用 sessionStorage 跨刷新累计次数：
   * 连续 MAX_SSO_REENTER_ATTEMPTS 次仍未建立会话，才停下并提示重新登录。
   */
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
    const href = reEnterHref();
    if (!href) return;
    if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) {
      setExhausted(true);
      return;
    }
    bumpSsoReenterAttempts();
    silentAttemptedRef.current = true;
    window.location.href = href;
  }, [loading, hasTokenCookie, sessionActive, reEnterHref, error]);

  /**
   * 是否正处于「静默自动换票」过程中：此时不展示手动屏，只显示连接 loader，避免闪烁。
   * 与上面的 effect 条件保持一致（已达上限 / 有错误 / 被登出抑制 / 无 href 时为 false）。
   */
  const autoConnecting =
    !ready &&
    !loading &&
    !error &&
    !exhausted &&
    shouldAttemptSilentSso({ hasTokenCookie, sessionActive, loading: false }) &&
    Boolean(reEnterHref());

  if (ready) {
    return (
      <>
        <SessionRevokedPoller enabled={ready} onRevoked={redirectToSso} />
        {children}
      </>
    );
  }

  if (loading || autoConnecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <div className="flex items-center">
          <Loader2 className="mr-2 size-5 animate-spin" />
          连接 Book 账号…
        </div>
        <p className="text-xs text-zinc-500">
          正在校验工具站令牌（约 20 秒，失败会自动重试）
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--canvas-bg)] px-6 text-center text-[var(--canvas-muted)]">
      <p className="max-w-md text-sm text-zinc-300">
        {error ??
          (exhausted
            ? "多次自动连接 Book 账号均未成功，请重新登录后继续使用。"
            : isSsoExchangeFreshClient() && hasTokenCookie
              ? "刚完成 SSO 换票，主站校验较慢。请点「重新连接」或稍候再试。"
              : hasTokenCookie
                ? "工具站令牌已失效，请重新连接主站账号。"
                : "尚未建立画布会话，请连接 Book 账号后继续使用。")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          onClick={() => {
            silentAttemptedRef.current = false;
            setExhausted(false);
            clearSsoReenterAttempts();
            void loadSession({ retry: true });
          }}
        >
          重新连接
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/15 px-4 py-2 text-sm text-[var(--canvas-accent)] transition hover:bg-[var(--canvas-accent)]/25"
          onClick={() => {
            clearSsoReenterAttempts();
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
