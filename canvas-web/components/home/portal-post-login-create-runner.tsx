"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { createPro2BlankCanvasProject } from "@/lib/canvas/create-pro2-blank-project";
import { assignCanvasProjectLocation } from "@/lib/canvas/canvas-project-navigation";
import {
  clearCanvasPortalPostLoginIntent,
  readCanvasPortalPostLoginIntent,
  stripCanvasPortalActionFromUrl,
} from "@/lib/canvas/portal-post-login-intent";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";
import { duplicatePortalFeaturedProject } from "@/lib/canvas-api";
import { isSsoExchangeFreshClient } from "@/lib/sso-exchange-fresh";
import { sleepMs } from "@/lib/fetch-with-db-retry";

const SESSION_WAIT_MS = 22_000;
const SESSION_POLL_MS = 350;

async function waitForActiveCanvasSession(): Promise<boolean> {
  const deadline = Date.now() + SESSION_WAIT_MS;
  const freshExchange = isSsoExchangeFreshClient();
  while (Date.now() < deadline) {
    const session = await fetchCanvasToolsSessionFull();
    if (session.active) return true;
    if (!freshExchange && !session.hasCookie) return false;
    await sleepMs(SESSION_POLL_MS);
  }
  const last = await fetchCanvasToolsSessionFull();
  return last.active;
}

export function PortalPostLoginCreateRunner() {
  const base = useBookMallBaseUrl();
  const startedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current || typeof window === "undefined") return;

    const intent = readCanvasPortalPostLoginIntent(window.location.search);
    if (!intent) return;

    startedRef.current = true;
    stripCanvasPortalActionFromUrl();

    void (async () => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }

      setBusy(true);
      setError(null);

      const active = await waitForActiveCanvasSession();
      if (!active) {
        setBusy(false);
        clearCanvasPortalPostLoginIntent();
        return;
      }

      try {
        if (intent.kind === "create-pro2") {
          const { id } = await createPro2BlankCanvasProject(base);
          clearCanvasPortalPostLoginIntent();
          assignCanvasProjectLocation(id);
          return;
        }
        const created = await duplicatePortalFeaturedProject(base, intent.featuredId);
        clearCanvasPortalPostLoginIntent();
        assignCanvasProjectLocation(created.id);
      } catch (e) {
        clearCanvasPortalPostLoginIntent();
        setError(e instanceof Error ? e.message : "创建失败");
        setBusy(false);
      }
    })();
  }, [base]);

  if (!busy && !error) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 z-50 flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border border-[var(--canvas-border)] bg-[var(--canvas-surface)]/95 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
        {busy ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin text-[var(--canvas-accent)]" />
            正在创建画布项目…
          </>
        ) : (
          <span className="text-red-300/90">{error}</span>
        )}
      </div>
    </div>
  );
}
