"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const DEFAULT_TOOL_ENTRY = "/fitting-room";

export function LaunchToolsAppButton({
  enabled,
  helperText,
}: {
  enabled: boolean;
  /** 未启用时在按钮下方展示 */
  helperText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/sso/tools/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirectPath: DEFAULT_TOOL_ENTRY }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "无法生成跳转链接");
        return;
      }
      if (typeof data.redirectUrl === "string") {
        window.location.assign(data.redirectUrl);
        return;
      }
      setMsg("响应缺少 redirectUrl");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full sm:w-auto"
        disabled={!enabled || busy}
        onClick={onClick}
      >
        {busy ? "正在跳转…" : "打开试衣间（工具站）"}
      </Button>
      {helperText ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{helperText}</p>
      ) : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}
