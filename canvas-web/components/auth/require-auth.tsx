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
import { bookMallReEnterHref } from "@/lib/platform-sso-links";
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
  parseToolsSessionInactiveReason,
  toolsSessionInactiveUserMessage,
  type ToolsSessionInactiveReason,
} from "@/lib/tools-session-inactive-reason";
import {
  bumpSsoReenterAttempts,
  clearSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";
import {
  clearCachedToolsSession,
  getCachedToolsSession,
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";

/** 须大于服务端 introspect 超时 + JWT 兜底余量，避免客户端先 abort */
const SESSION_FETCH_TIMEOUT_MS = 22_000;
const SESSION_FETCH_RETRY_DELAY_MS = 800;
const SESSION_FETCH_TIMEOUT_RETRIES = 3;
const SESSION_FETCH_TIMEOUT_RETRY_DELAY_MS = 1_500;
const SESSION_FETCH_FRESH_EXCHANGE_RETRIES = 4;
const SESSION_FETCH_FRESH_EXCHANGE_DELAY_MS = 1_200;
const SESSION_POLL_MS = 60_000;
const SESSION_BACKGROUND_REVALIDATE_MS = 8_000;

function isFetchAbortedError(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === "AbortError" || e.message.includes("aborted"))
  );
}

async function fetchToolsSessionClientOnce(): Promise<
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
    const parsed = parseToolsSessionPayload(raw);
    if (parsed.active) {
      setCachedToolsSession(parsed);
    }
    return parsed;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchToolsSessionClient(opts?: {
  timeoutRetries?: number;
}): Promise<ReturnType<typeof parseToolsSessionPayload>> {
  const maxAttempts = Math.max(1, opts?.timeoutRetries ?? 1);
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchToolsSessionClientOnce();
    } catch (e) {
      lastError = e;
      if (!isFetchAbortedError(e) || attempt >= maxAttempts - 1) {
        throw e;
      }
      await new Promise((r) =>
        setTimeout(r, SESSION_FETCH_TIMEOUT_RETRY_DELAY_MS * (attempt + 1)),
      );
    }
  }
  throw lastError;
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
  const [inactiveReason, setInactiveReason] =
    useState<ToolsSessionInactiveReason | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const silentAttemptedRef = useRef(false);
  const loadGenRef = useRef(0);
  const readyRef = useRef(false);
  readyRef.current = ready;

  const reEnterHref = useCallback(() => {
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/projects";
    return (
      buildSilentReEnterHref(mainOrigin, path, "canvas") ||
      bookMallReEnterHref(path, "canvas")
    );
  }, [mainOrigin]);

  // 未认证兜底：跳本域品牌登录页（保留回跳），不再弹主站登录。
  const localLoginHref = useCallback(() => {
    const path =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/projects";
    return `/login?redirect=${encodeURIComponent(path || "/projects")}`;
  }, []);

  const redirectToSso = useCallback(() => {
    const reEnter = reEnterHref();
    if (reEnter) {
      window.location.href = reEnter;
      return true;
    }
    window.location.href = localLoginHref();
    return true;
  }, [reEnterHref, localLoginHref]);

  const loadSession = useCallback(
    async (opts?: { retry?: boolean; background?: boolean }) => {
      const gen = ++loadGenRef.current;
      const background = opts?.background === true;
      if ((!readyRef.current || opts?.retry) && !background) {
        setLoading(true);
      }
      if (!background) {
        setError(null);
      }
      const freshExchange = isSsoExchangeFreshClient();
      const inactivePollAttempts = freshExchange
        ? SESSION_FETCH_FRESH_EXCHANGE_RETRIES
        : opts?.retry === false
          ? 1
          : 2;
      const inactivePollDelayMs = freshExchange
        ? SESSION_FETCH_FRESH_EXCHANGE_DELAY_MS
        : SESSION_FETCH_RETRY_DELAY_MS;
      const timeoutRetries =
        freshExchange || opts?.retry
          ? SESSION_FETCH_TIMEOUT_RETRIES
          : 2;
      try {
        let data = await fetchToolsSessionClient({ timeoutRetries });
        for (
          let attempt = 1;
          attempt < inactivePollAttempts && !data.active;
          attempt++
        ) {
          await new Promise((r) => setTimeout(r, inactivePollDelayMs));
          if (gen !== loadGenRef.current) return;
          data = await fetchToolsSessionClient({ timeoutRetries });
        }
        if (gen !== loadGenRef.current) return;
        setHasTokenCookie(Boolean(data.hasCookie));
        setSessionActive(Boolean(data.active));
        setInactiveReason(parseToolsSessionInactiveReason(data));
        if (data.active) {
          clearSsoExchangeFreshClient();
          setReady(true);
          return;
        }
        const inactive = parseToolsSessionInactiveReason(data);
        if (background && readyRef.current) {
          if (
            inactive === "introspect_timeout" ||
            (inactive === "unknown" && data.hasCookie)
          ) {
            window.setTimeout(() => {
              if (gen === loadGenRef.current) {
                void loadSession({ background: true });
              }
            }, SESSION_BACKGROUND_REVALIDATE_MS);
            return;
          }
        }
        clearCachedToolsSession();
        setReady(false);
      } catch (e) {
        if (gen !== loadGenRef.current) return;
        if (background && readyRef.current) {
          window.setTimeout(() => {
            if (gen === loadGenRef.current) {
              void loadSession({ background: true });
            }
          }, SESSION_BACKGROUND_REVALIDATE_MS);
          return;
        }
        if (opts?.retry !== false) {
          try {
            await new Promise((r) =>
              setTimeout(r, SESSION_FETCH_RETRY_DELAY_MS),
            );
            if (gen !== loadGenRef.current) return;
            const retryData = await fetchToolsSessionClient({
              timeoutRetries: SESSION_FETCH_TIMEOUT_RETRIES,
            });
            if (gen !== loadGenRef.current) return;
            setHasTokenCookie(Boolean(retryData.hasCookie));
            setSessionActive(Boolean(retryData.active));
            setInactiveReason(parseToolsSessionInactiveReason(retryData));
            if (retryData.active) {
              clearSsoExchangeFreshClient();
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
        setInactiveReason("introspect_timeout");
        setReady(false);
        setError(
          isFetchAbortedError(e)
            ? "连接主站超时（常见于 book-mall 冷启动）。请点「重新连接」或确认 pnpm dev:all 已启动。"
            : "无法校验登录状态，请检查网络或主站是否可访问。",
        );
      } finally {
        if (gen === loadGenRef.current && !background) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const freshExchange = isSsoExchangeFreshClient();
    if (!freshExchange) {
      const cached = getCachedToolsSession();
      if (cached?.active) {
        readyRef.current = true;
        setHasTokenCookie(Boolean(cached.hasCookie));
        setSessionActive(true);
        setInactiveReason(parseToolsSessionInactiveReason(cached));
        setReady(true);
        setLoading(false);
        void loadSession({ background: true });
        return;
      }
    }
    void loadSession();
  }, [loadSession]);

  /** 会话建立成功后清零静默换票计数 */
  useEffect(() => {
    if (ready) {
      clearSsoReenterAttempts();
    }
  }, [ready]);

  /**
   * 会话无效时静默自动换票（re-enter），对用户无感。
   * 整页跳转会重新挂载组件，故用 sessionStorage 跨刷新累计次数：
   * 连续 MAX_SSO_REENTER_ATTEMPTS 次仍未建立会话，才停下并提示重新登录。
   */
  useEffect(() => {
    if (silentAttemptedRef.current) return;
    if (inactiveReason === "tools_access_denied") return;
    if (inactiveReason === "introspect_timeout") return;
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
      // 多次静默换票仍未建立会话（通常无 Book 会话）→ 落本域品牌登录页。
      window.location.href = localLoginHref();
      return;
    }
    bumpSsoReenterAttempts();
    silentAttemptedRef.current = true;
    window.location.href = href;
  }, [loading, hasTokenCookie, sessionActive, reEnterHref, error, inactiveReason, localLoginHref]);

  /**
   * 是否正处于「静默自动换票」过程中：此时不展示手动屏，只显示连接 loader，避免闪烁。
   * 与上面的 effect 条件保持一致（已达上限 / 有错误 / 被登出抑制 / 无 href 时为 false）。
   */
  const autoConnecting =
    !ready &&
    !loading &&
    !error &&
    !exhausted &&
    inactiveReason !== "tools_access_denied" &&
    inactiveReason !== "introspect_timeout" &&
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]">
        <div className="flex items-center">
          <Loader2 className="mr-2 size-5 animate-spin" />
          正在进入我的画布…
        </div>
      </div>
    );
  }

  const toolServiceFeeHref =
    mainOrigin != null && mainOrigin.length > 0
      ? `${mainOrigin.replace(/\/$/, "")}/account/tool-service-fee`
      : null;

  const inactiveMessage = toolsSessionInactiveUserMessage(inactiveReason, {
    freshExchange: isSsoExchangeFreshClient(),
    hasCookie: hasTokenCookie,
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--canvas-bg)] px-6 text-center text-[var(--canvas-muted)]">
      <p className="max-w-md text-sm text-zinc-300">
        {error ??
          (exhausted
            ? "多次自动连接 Book 账号均未成功，请重新登录后继续使用。"
            : inactiveMessage)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {inactiveReason === "tools_access_denied" && toolServiceFeeHref ? (
          <a
            href={toolServiceFeeHref}
            className="rounded-lg border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/15 px-4 py-2 text-sm text-[var(--canvas-accent)] transition hover:bg-[var(--canvas-accent)]/25"
          >
            去开通工具月费
          </a>
        ) : null}
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
            window.location.href = localLoginHref();
          }}
        >
          去登录
        </button>
      </div>
    </div>
  );
}
