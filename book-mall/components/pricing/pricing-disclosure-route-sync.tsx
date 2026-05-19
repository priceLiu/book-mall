"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 从个人中心等入口带 `?from=account` 软导航时，Next 客户端路由缓存可能复用
 * 无 query 的旧 RSC 快照（样式/权限视图都不对）。进入本页时强制 refresh 一次。
 */
export function PricingDisclosureRouteSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    if (refreshedFor.current === query) return;
    refreshedFor.current = query;
    router.refresh();
  }, [router, query]);

  return null;
}
