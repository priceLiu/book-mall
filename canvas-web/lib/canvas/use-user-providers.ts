"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  listCanvasProviders,
  type CanvasProviderDto,
  type GatewayLinkStatusDto,
} from "@/lib/canvas-providers-api";

const CACHE: {
  value: CanvasProviderDto[] | null;
  gatewayLink: GatewayLinkStatusDto | null;
  ts: number;
} = {
  value: null,
  gatewayLink: null,
  ts: 0,
};
const TTL_MS = 30_000;
let prefetchInflight: Promise<void> | null = null;

async function fetchUserProvidersIntoCache(base: string): Promise<void> {
  const result = await listCanvasProviders(base);
  CACHE.value = result.providers;
  CACHE.gatewayLink = result.gatewayLink;
  CACHE.ts = Date.now();
}

/** 画布页挂载时预拉 Provider，避免 EnginePicker 首次打开卡顿 */
export function prefetchUserProviders(base: string | null | undefined): void {
  if (!base) return;
  const fresh = CACHE.value && Date.now() - CACHE.ts < TTL_MS;
  if (fresh) return;
  if (prefetchInflight) return;
  prefetchInflight = fetchUserProvidersIntoCache(base)
    .catch(() => {
      /* hook 打开时会重试 */
    })
    .finally(() => {
      prefetchInflight = null;
    });
}

/**
 * 取当前用户的全部 Provider（含 models）。
 * 节点上的 Provider/Model 二级 dropdown 都用它。
 *
 * 简易缓存 30s；切换页面后 hook 第一次会重新拉。
 */
export function useUserProviders(opts?: { forceRefresh?: boolean }) {
  const base = useBookMallBaseUrl();
  const [providers, setProviders] = useState<CanvasProviderDto[]>(
    CACHE.value ?? [],
  );
  const [gatewayLink, setGatewayLink] = useState<GatewayLinkStatusDto | null>(
    CACHE.gatewayLink,
  );
  const [loading, setLoading] = useState(!CACHE.value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    const fresh = CACHE.value && Date.now() - CACHE.ts < TTL_MS;
    if (fresh && !opts?.forceRefresh) {
      setProviders(CACHE.value!);
      setGatewayLink(CACHE.gatewayLink);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchUserProvidersIntoCache(base)
      .then(() => {
        if (cancelled) return;
        setProviders(CACHE.value!);
        setGatewayLink(CACHE.gatewayLink);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载 Providers 失败");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, opts?.forceRefresh]);

  return {
    providers,
    gatewayLink,
    gatewayLinked: Boolean(gatewayLink?.linked && !gatewayLink?.revoked),
    loading,
    error,
  };
}

export function invalidateUserProvidersCache() {
  CACHE.value = null;
  CACHE.gatewayLink = null;
  CACHE.ts = 0;
}
