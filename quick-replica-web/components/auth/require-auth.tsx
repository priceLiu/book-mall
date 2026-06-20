"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const SESSION_FETCH_TIMEOUT_MS = 12_000;
const SESSION_FETCH_RETRY_DELAY_MS = 400;

async function fetchToolsSessionClient() {
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
  const mainOrigin = getMainSiteOrigin();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTokenCookie, setHasTokenCookie] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const silentAttemptedRef = useRef(false);
  const loadGenRef = useRef(0);

  const redirectToSso = useCallback(() => {
    const path =
      typeof window !== "undefined" ? window.location.pathname : "/";
    const reEnter =
      buildSilentReEnterHref(mainOrigin, path, "prompt-optimizer") ||
      bookMallReEnterHref(path, "prompt-optimizer");
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

  const loadSession = useCallback(async (opts?: { retry?: boolean }) => {
    const gen = ++loadGenRef.current;
    if (!ready || opts?.retry) setLoading(true);
    setError(null);
    try {
      let data = await fetchToolsSessionClient();
      if (!data.active && opts?.retry !== false) {
        await new Promise((r) => setTimeout(r, SESSION_FETCH_RETRY_DELAY_MS));
        if (gen !== loadGenRef.current) return;
        data = await fetchToolsSessionClient();
      }
      if (gen !== loadGenRef.current) return;
      setHasTokenCookie(Boolean(data.hasCookie));
      setSessionActive(Boolean(data.active));
      if (data.active) {
        setReady(true);
        return;
      }
      setReady(false);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setHasTokenCookie(false);
      setSessionActive(false);
      setReady(false);
      const aborted =
        e instanceof Error &&
        (e.name === "AbortError" || e.message.includes("aborted"));
      setError(
        aborted
          ? "连接主站超时。请点「重新连接」或确认 pnpm dev:all 已启动。"
          : "无法读取会话，请重试。",
      );
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (
      !shouldAttemptSilentSso({ hasTokenCookie, sessionActive, loading }) ||
      silentAttemptedRef.current
    ) {
      return;
    }
    silentAttemptedRef.current = true;
    redirectToSso();
  }, [hasTokenCookie, sessionActive, loading, redirectToSso]);

  if (loading && !ready) {
    return (
      <div className="po-main">
        <div className="po-spinner" aria-label="加载中" />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="po-main">
        <div className="po-card">
          <h1 style={{ marginTop: 0, fontSize: 18 }}>需要登录</h1>
          {error ? <p className="po-error">{error}</p> : null}
          <p className="po-muted">
            提示词优化器需通过主站 Book SSO 登录，并开通工具月费与 Gateway
            关联。
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="po-btn"
              onClick={() => redirectToSso()}
            >
              重新连接
            </button>
            <button
              type="button"
              className="po-btn"
              onClick={() => void loadSession({ retry: true })}
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
