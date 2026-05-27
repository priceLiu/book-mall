"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  fetchGatewayLinkStatus,
  type GatewayLinkStatusDto,
} from "@/lib/canvas-providers-api";

const GATEWAY_ORIGIN =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() || "http://localhost:3005";

export function useGatewayLinkStatus() {
  const base = useBookMallBaseUrl();
  const [status, setStatus] = useState<GatewayLinkStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    let cancelled = false;
    setLoading(true);
    void fetchGatewayLinkStatus(base)
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载 Gateway 关联状态失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const accountUrl = base
    ? `${base.replace(/\/$/, "")}/account#gateway-api-key`
    : null;
  const gatewayConsoleUrl = `${GATEWAY_ORIGIN.replace(/\/$/, "")}/dashboard/credentials`;
  const gatewayGuideUrl = `${GATEWAY_ORIGIN.replace(/\/$/, "")}/guide`;
  const linked = Boolean(status?.linked && !status?.revoked);

  return {
    status,
    loading,
    error,
    linked,
    boundKinds: status?.boundKinds ?? [],
    accountUrl,
    gatewayConsoleUrl,
    gatewayGuideUrl,
  };
}
