"use client";

/**
 * Gateway 静默换票（自动换票）：与 book 同站（ai-code8.com / localhost），
 * 隐藏 iframe 内打开 book `/api/sso/gateway/issue`（带主站会话 Cookie）→
 * 换票链最终落在 gateway 同源着陆页 `/auth/book/silent-done`，由其 postMessage
 * 通知父页面完成。用户无感；主站会话也失效时返回 false，由调用方决定提示重新登录。
 */

/** 静默换票完成后，着陆页回传父页面的消息类型 */
export const GATEWAY_SILENT_SSO_MESSAGE = "gateway-sso-refreshed" as const;
/** 着陆页（轻量页，仅 postMessage） */
const SILENT_DONE_PATH = "/auth/book/silent-done";
const SILENT_REFRESH_TIMEOUT_MS = 6_000;
/** 刚成功换票视为仍新鲜，避免短时间重复换票 */
const SILENT_REFRESH_MIN_GAP_MS = 5_000;

let inFlight: Promise<boolean> | null = null;
let lastOkAt = 0;

function bookOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BOOK_MALL_ORIGIN ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

function buildSilentReEnterUrl(): string {
  return `${bookOrigin()}/api/sso/gateway/issue?redirect=${encodeURIComponent(
    SILENT_DONE_PATH,
  )}`;
}

export function silentGatewaySessionRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (inFlight) return inFlight;
  if (Date.now() - lastOkAt < SILENT_REFRESH_MIN_GAP_MS) {
    return Promise.resolve(true);
  }

  inFlight = new Promise<boolean>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "session-refresh";
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "1px",
      height: "1px",
      border: "0",
      visibility: "hidden",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
      if (ok) lastOkAt = Date.now();
      inFlight = null;
      resolve(ok);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === GATEWAY_SILENT_SSO_MESSAGE) finish(true);
    };

    const timer = window.setTimeout(
      () => finish(false),
      SILENT_REFRESH_TIMEOUT_MS,
    );
    window.addEventListener("message", onMessage);
    iframe.src = buildSilentReEnterUrl();
    document.body.appendChild(iframe);
  });

  return inFlight;
}
