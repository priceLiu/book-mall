"use client";

import { Loader2 } from "lucide-react";
import { navigatePortalLogout } from "@private/federated-portal-logout";

import { useCanvasShellSession } from "@/lib/canvas/use-canvas-shell-session";
import { canvasLoginHref, canvasRegisterHref } from "@/lib/portal-auth-links";
import { getBookAccountUrl } from "@/lib/site-origin";
import { clearCachedToolsSession } from "@/lib/tools-session-client-cache";

function handleCanvasLogout() {
  clearCachedToolsSession();
  navigatePortalLogout("/api/auth/logout");
}

export function CanvasShellAuthSlot() {
  const bookAccountUrl = getBookAccountUrl();
  const { loading, session } = useCanvasShellSession();

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--canvas-muted)]">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        <span className="hidden sm:inline">登录检查</span>
      </span>
    );
  }

  if (!session.active) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <a href={canvasLoginHref()} className="twenty-btn-ghost !px-3 !py-1.5 !text-xs">
          登录
        </a>
        <a href={canvasRegisterHref()} className="twenty-btn-accent !px-3 !py-1.5 !text-xs">
          注册
        </a>
      </div>
    );
  }

  const display =
    session.name?.trim() ||
    session.email?.trim() ||
    session.sub?.trim() ||
    "已登录";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden max-w-[100px] truncate text-[11px] text-[var(--canvas-muted)] md:inline xl:max-w-[160px]">
        {display}
      </span>
      {bookAccountUrl ? (
        <a href={bookAccountUrl} className="twenty-btn-accent !px-3 !py-1.5 !text-xs">
          个人中心
        </a>
      ) : null}
      <button
        type="button"
        onClick={handleCanvasLogout}
        className="twenty-btn-ghost !px-3 !py-1.5 !text-xs"
      >
        退出
      </button>
    </div>
  );
}
