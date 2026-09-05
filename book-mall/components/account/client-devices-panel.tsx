"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DeviceRow = {
  id: string;
  deviceType: string;
  deviceTypeLabel: string;
  deviceName: string | null;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
};

export function ClientDevicesPanel({ initialDevices }: { initialDevices: DeviceRow[] }) {
  const router = useRouter();
  const [devices, setDevices] = useState(initialDevices);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revoke = useCallback(
    async (id: string) => {
      if (!window.confirm("确定吊销此设备的登录？该设备需重新登录。")) return;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/sso/client/devices?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "吊销失败");
          return;
        }
        setDevices((prev) => prev.filter((d) => d.id !== id));
        router.refresh();
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">已登录设备</CardTitle>
        <CardDescription className="text-xs">
          浏览器扩展、桌面端与网页客户端的长效登录设备。同类型设备再登录会挤掉旧设备。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无活跃设备</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {d.deviceName?.trim() || d.deviceTypeLabel}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {d.deviceTypeLabel}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    最近活跃：{new Date(d.lastSeenAt).toLocaleString("zh-CN")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    凭证到期：{new Date(d.expiresAt).toLocaleString("zh-CN")}
                  </p>
                  {d.userAgent ? (
                    <p className="truncate text-xs text-muted-foreground">{d.userAgent}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === d.id}
                  onClick={() => void revoke(d.id)}
                >
                  {busyId === d.id ? "处理中…" : "吊销"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
