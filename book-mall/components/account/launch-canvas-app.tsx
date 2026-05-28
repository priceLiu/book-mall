"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_REDIRECT = "/projects";

export function LaunchCanvasAppButton({
  enabled,
  helperText,
  redirectPath = DEFAULT_REDIRECT,
  label = "打开 AI 画布",
  busyLabel = "正在跳转…",
  variant = "default",
  className,
  title,
  openInNewTab = false,
}: {
  enabled: boolean;
  helperText?: string;
  redirectPath?: string;
  label?: string;
  busyLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  title?: string;
  openInNewTab?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  function handleLaunch() {
    if (!enabled || busy) return;
    setBusy(true);
    const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    const href = `/canvas-open?path=${encodeURIComponent(path)}`;
    if (openInNewTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      setBusy(false);
      return;
    }
    window.location.assign(href);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        size="sm"
        title={title}
        className={cn("w-full sm:w-auto", className)}
        disabled={!enabled || busy}
        onClick={handleLaunch}
      >
        {busy ? busyLabel : label}
      </Button>
      {helperText ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
