"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_REDIRECT = "/fitting-room";

export function LaunchToolsAppButton({
  enabled,
  helperText,
  redirectPath = DEFAULT_REDIRECT,
  label,
  busyLabel = "正在跳转…",
  variant = "default",
  className,
  title,
  /**
   * `inlineNav`：顶栏等 flex 内联一排时使用（勿用 display:contents，部分环境下点击无法触发）。
   * `default`：个人中心等块状区域。
   */
  layout = "default",
  /** 为 true 时在拿到 redirectUrl 后 `window.open`，否则当前页跳转 */
  openInNewTab = false,
}: {
  enabled: boolean;
  /** 未启用时在按钮下方展示 */
  helperText?: string;
  /** 工具站内路径，须以 / 开头 */
  redirectPath?: string;
  /** 按钮文案 */
  label?: string;
  busyLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  title?: string;
  layout?: "default" | "inlineNav";
  openInNewTab?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isInlineNav = layout === "inlineNav";

  async function handleLaunch() {
    if (!enabled || busy) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/sso/tools/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ redirectPath }),
      });
      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* HTML 或非 JSON */
      }
      if (!res.ok) {
        const errorStr =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : "";
        const trimmed = raw.trim();
        if (errorStr) {
          setMsg(errorStr);
          return;
        }
        if (trimmed.startsWith("<")) {
          setMsg(
            `请求失败（HTTP ${res.status}）。首次启用工具站 SSO 时，请在 book-mall 目录执行：pnpm exec dotenv -e .env.local -- prisma migrate deploy，然后重启 pnpm dev。`,
          );
          return;
        }
        setMsg(
          trimmed.slice(0, 180) ||
            `请求失败（HTTP ${res.status}）。请确认已登录且数据库迁移已执行。`,
        );
        return;
      }
      if (typeof data.redirectUrl === "string") {
        if (openInNewTab) {
          window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        } else {
          window.location.assign(data.redirectUrl);
        }
        return;
      }
      setMsg("响应缺少 redirectUrl");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        isInlineNav
          ? "inline-flex shrink-0 flex-col items-start gap-0 self-center"
          : "space-y-2",
      )}
    >
      <Button
        type="button"
        variant={variant}
        size="sm"
        title={title}
        className={cn(
          !isInlineNav && "w-full sm:w-auto",
          isInlineNav && "h-9 shrink-0",
          className,
        )}
        disabled={!enabled || busy}
        onClick={() => void handleLaunch()}
      >
        {busy ? busyLabel : label ?? "打开试衣间（工具站）"}
      </Button>
      {helperText ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{helperText}</p>
      ) : null}
      {msg ? (
        <p
          className={cn(
            "text-xs text-destructive leading-relaxed",
            isInlineNav && "max-w-[min(24rem,92vw)] mt-0.5",
          )}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
