"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const ALLOWED_APPS = new Set([
  "tool",
  "canvas",
  "story",
  "prompt-optimizer",
  "quick-replica",
  "e-commerce",
]);

function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  const v = raw.trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

function parseApp(raw: string | null): string {
  const v = raw?.trim().toLowerCase() ?? "tool";
  return ALLOWED_APPS.has(v) ? v : "tool";
}

export function PortalSigninClient() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = searchParams.get("t")?.trim();
    const phone = searchParams.get("phone")?.trim();
    const app = parseApp(searchParams.get("app"));
    const redirect = safeRedirect(searchParams.get("redirect"));

    if (!token || !phone) {
      setError("登录票据缺失，请返回门户重新登录。");
      return;
    }

    void (async () => {
      try {
        const res = await signIn("credentials", {
          phone,
          loginMode: "autologin",
          autoLoginToken: token,
          redirect: false,
        });
        if (!res?.ok || res.error) {
          setError("登录票据已过期，请返回门户重新登录。");
          return;
        }
        // Book 会话已建立 → 交给既有换票流程签发 code 并 302 回子应用 callback。
        const q = new URLSearchParams({ redirect });
        if (app !== "tool") q.set("app", app);
        window.location.replace(`/api/sso/tools/re-enter?${q.toString()}`);
      } catch {
        setError("无法连接登录服务，请稍后重试。");
      }
    })();
  }, [searchParams]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm"
            onClick={() => window.history.back()}
          >
            返回门户
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">正在登录并跳转…</p>
      )}
    </div>
  );
}
