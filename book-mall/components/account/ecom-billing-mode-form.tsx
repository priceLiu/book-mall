"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "BYOK_SERVICE_FEE" | "PLATFORM_METERED";

export function EcomBillingModeForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: Mode) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/ecom-billing-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ecomBillingMode: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ecomBillingMode?: Mode;
      };
      if (!res.ok) {
        setMsg(data.error ?? "保存失败");
        return;
      }
      setMode(data.ecomBillingMode ?? next);
      setMsg("已保存");
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="ecomBilling"
          checked={mode === "BYOK_SERVICE_FEE"}
          disabled={busy}
          onChange={() => void save("BYOK_SERVICE_FEE")}
        />
        <span>
          <strong>自备 Key + 月费（6b）</strong>
          <br />
          <span className="text-muted-foreground">
            开通电商工具箱技术服务费，云厂商账单在 Gateway 查看；生成不按次扣点。
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="ecomBilling"
          checked={mode === "PLATFORM_METERED"}
          disabled={busy}
          onChange={() => void save("PLATFORM_METERED")}
        />
        <span>
          <strong>代付按次（6a）</strong>
          <br />
          <span className="text-muted-foreground">
            充值钱包，按张/按秒扣点（挂牌价×2）；平台代付厂商，无需自备 Gateway Key。
          </span>
        </span>
      </label>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      <Button type="button" variant="subscription" size="sm" disabled={busy} asChild>
        <a href="/account/pricing#billing-policy">查看计费说明</a>
      </Button>
    </div>
  );
}
