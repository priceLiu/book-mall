"use client";

import type { EcomBillingMode } from "@prisma/client";

type Mode = EcomBillingMode;

export function EcomBillingModeForm({
  initialMode,
  readOnly = true,
}: {
  initialMode: Mode;
  readOnly?: boolean;
}) {
  const label =
    initialMode === "PLATFORM_METERED"
      ? "平台代付（积分实时扣费）"
      : "自带 Key + BYOK 月费";

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        计费身份在注册时选定，不可更改。当前模式：
      </p>
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-medium">
        {label}
      </p>
      {readOnly ? (
        <p className="text-xs text-muted-foreground">
          如需切换 BYOK / 平台代付，请使用新账号注册。
        </p>
      ) : null}
    </div>
  );
}
