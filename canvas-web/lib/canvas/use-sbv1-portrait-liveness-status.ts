"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  fetchSbv1PortraitLivenessStatus,
  type Sbv1PortraitLivenessStatusDto,
} from "@/lib/canvas/sbv1-portrait-liveness-api";

export function useSbv1PortraitLivenessStatus(enabled = true) {
  const base = useBookMallBaseUrl();
  const [status, setStatus] = useState<Sbv1PortraitLivenessStatusDto | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!base) {
      setStatus(null);
      return null;
    }
    setLoading(true);
    try {
      const next = await fetchSbv1PortraitLivenessStatus(base);
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    status,
    loading,
    refresh,
    isVerified: Boolean(status?.verified && status.groupId),
    groupId: status?.groupId,
    verifiedAt: status?.verifiedAt,
  };
}
