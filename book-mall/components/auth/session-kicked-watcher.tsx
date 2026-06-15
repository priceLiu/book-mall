"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearBookMallSessionMarker,
  markBookMallSessionActive,
  SESSION_KICKED_MESSAGE,
} from "@/lib/session-kicked-marker";
import {
  clearSessionKickCookieClient,
  readSessionKickCookie,
} from "@/lib/session-kick-cookie";

/**
 * 单会话挤下线：仅在服务端写入 bm_session_kicked 标记时提示（新登录挤掉旧会话）。
 * 主动退出、会话过期或网络抖动不再误报「别处登录」。
 */
export function SessionKickedWatcher() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const wasAuthenticatedRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      wasAuthenticatedRef.current = true;
      markBookMallSessionActive();
      return;
    }

    if (status !== "unauthenticated") return;
    if (!wasAuthenticatedRef.current) return;

    wasAuthenticatedRef.current = false;
    clearBookMallSessionMarker();
    if (pathname === "/login" || pathname === "/register") return;

    if (!readSessionKickCookie()) return;

    clearSessionKickCookieClient();
    setOpen(true);
  }, [status, pathname]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-kicked-title"
    >
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg">
        <h2 id="session-kicked-title" className="text-lg font-semibold">
          账号已在别处登录
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">{SESSION_KICKED_MESSAGE}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              setOpen(false);
              router.push("/login");
              router.refresh();
            }}
          >
            重新登录
          </button>
        </div>
      </div>
    </div>
  );
}
