"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ClientKind = "extension" | "desktop";

function ClientCallbackInner() {
  const sp = useSearchParams();
  const client = (sp.get("client") === "desktop" ? "desktop" : "extension") as ClientKind;
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("正在签发客户端凭证…");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/client-bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceType: client === "desktop" ? "DESKTOP" : "EXTENSION",
            deviceName: client === "desktop" ? "Publisher Desktop" : "Publisher Extension",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          setStatus("error");
          setMessage(typeof data.error === "string" ? data.error : "签发失败");
          return;
        }

        const payload = {
          type: "PUBLISHER_CLIENT_AUTH",
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          deviceId: data.device_id,
          userId: data.user_id,
        };

        if (client === "extension") {
          window.postMessage(payload, window.location.origin);
          window.opener?.postMessage(payload, "*");
        } else {
          const loopback = sp.get("loopback");
          const q = new URLSearchParams({
            access_token: String(data.access_token),
            refresh_token: String(data.refresh_token),
            expires_in: String(data.expires_in),
            device_id: String(data.device_id),
            user_id: String(data.user_id),
          });
          if (loopback?.startsWith("http://127.0.0.1")) {
            window.location.href = `${loopback}?${q.toString()}`;
          } else {
            window.location.href = `publisher-desktop://auth/callback?${q.toString()}`;
          }
        }

        setStatus("ok");
        setMessage(
          client === "extension"
            ? "凭证已发送，可关闭此页返回扩展。"
            : "正在返回桌面端…",
        );
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "未知错误");
      }
    })();
  }, [client]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className={status === "error" ? "text-red-600" : "text-[var(--pub-ink)]"}>
          {message}
        </p>
      </div>
    </main>
  );
}

export default function ClientCallbackPage() {
  return (
    <Suspense>
      <ClientCallbackInner />
    </Suspense>
  );
}
