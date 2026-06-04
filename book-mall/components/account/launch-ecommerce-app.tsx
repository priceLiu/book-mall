"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { accountNavActionClass } from "@/components/account/account-nav-styles";
import { cn } from "@/lib/utils";

export function LaunchEcommerceAppButton({
  enabled,
  helperText,
  redirectPath = "/",
  label = "打开电商工具箱",
  busyLabel = "正在跳转…",
  variant = "subscription",
  className,
  openInNewTab = true,
  appearance = "button",
}: {
  enabled: boolean;
  helperText?: string;
  redirectPath?: string;
  label?: string;
  busyLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  openInNewTab?: boolean;
  appearance?: "button" | "nav";
}) {
  const [busy, setBusy] = useState(false);

  function handleLaunch() {
    if (!enabled || busy) return;
    setBusy(true);
    const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    const href = `/ecom-open?path=${encodeURIComponent(path)}`;
    if (openInNewTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      setBusy(false);
      return;
    }
    window.location.assign(href);
  }

  const isNav = appearance === "nav";

  return (
    <div className={cn(isNav ? "w-full" : "space-y-2")}>
      {isNav ? (
        <button
          type="button"
          className={cn(accountNavActionClass(!enabled || busy), className)}
          disabled={!enabled || busy}
          onClick={handleLaunch}
        >
          {busy ? busyLabel : label}
        </button>
      ) : (
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={cn("w-full sm:w-auto", className)}
          disabled={!enabled || busy}
          onClick={handleLaunch}
        >
          {busy ? busyLabel : label}
        </Button>
      )}
      {helperText ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
