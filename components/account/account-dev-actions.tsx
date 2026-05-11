"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AccountDevActions() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, init?: RequestInit) {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch(path, { method: "POST", ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "请求失败");
        return;
      }
      setMsg("已执行，刷新视图");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle>开发：模拟支付</CardTitle>
        <CardDescription>
          仅 NODE_ENV=development 可用；对齐产品文档「模拟流程可通」。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => call("/api/dev/mock-topup")}
        >
          模拟充值 ¥100
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => call("/api/dev/mock-subscribe")}
        >
          模拟月度订阅 30 天
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() =>
            call("/api/dev/mock-subscribe", {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planSlug: "yearly" }),
            })
          }
        >
          模拟年度订阅 365 天
        </Button>
        {msg ? (
          <p className="w-full text-sm text-muted-foreground">{msg}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
