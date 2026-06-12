"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  clearBookMallSessionMarker,
  hadBookMallSessionMarker,
  markBookMallSessionActive,
  SESSION_KICKED_MESSAGE,
} from "@/lib/session-kicked-marker";

/**
 * 单会话挤下线：会话从已登录变为未登录且非主动退出时，提示用户。
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
    if (!wasAuthenticatedRef.current && !hadBookMallSessionMarker()) return;

    wasAuthenticatedRef.current = false;
    clearBookMallSessionMarker();
    if (pathname === "/login" || pathname === "/register") return;
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
