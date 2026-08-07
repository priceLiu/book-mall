"use client";

import { useEffect, useState } from "react";

export type CanvasNetworkStatus = {
  online: boolean;
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  /** 最近 canvas API 滑动平均吞吐（KB/s） */
  throughputKbps: number | null;
};

type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

const throughputSamples: number[] = [];
const MAX_SAMPLES = 8;

/** canvas-api call() 上报传输量，用于顶栏网速估算 */
export function recordCanvasApiTransfer(bytes: number, durationMs: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0 || durationMs <= 0) return;
  const kbps = bytes / 1024 / (durationMs / 1000);
  throughputSamples.push(kbps);
  if (throughputSamples.length > MAX_SAMPLES) throughputSamples.shift();
  window.dispatchEvent(new CustomEvent("canvas:network-transfer"));
}

function readConnection(): Pick<
  CanvasNetworkStatus,
  "effectiveType" | "downlinkMbps" | "rttMs"
> {
  if (typeof navigator === "undefined") {
    return { effectiveType: null, downlinkMbps: null, rttMs: null };
  }
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection;
  if (!conn) {
    return { effectiveType: null, downlinkMbps: null, rttMs: null };
  }
  return {
    effectiveType: conn.effectiveType ?? null,
    downlinkMbps:
      typeof conn.downlink === "number" && Number.isFinite(conn.downlink)
        ? conn.downlink
        : null,
    rttMs:
      typeof conn.rtt === "number" && Number.isFinite(conn.rtt)
        ? conn.rtt
        : null,
  };
}

function averageThroughputKbps(): number | null {
  if (throughputSamples.length === 0) return null;
  const sum = throughputSamples.reduce((a, b) => a + b, 0);
  return sum / throughputSamples.length;
}

export function formatCanvasNetworkStatusLabel(status: CanvasNetworkStatus): string {
  if (!status.online) return "离线";
  const parts: string[] = ["在线"];
  if (status.effectiveType) parts.push(status.effectiveType.toUpperCase());
  if (status.downlinkMbps != null && status.downlinkMbps > 0) {
    parts.push(`${status.downlinkMbps.toFixed(1)} Mbps`);
  } else if (status.throughputKbps != null && status.throughputKbps > 0) {
    parts.push(`${status.throughputKbps.toFixed(0)} KB/s`);
  }
  if (status.rttMs != null && status.rttMs > 0) {
    parts.push(`RTT ${Math.round(status.rttMs)}ms`);
  }
  return parts.join(" · ");
}

export function useCanvasNetworkStatus(): CanvasNetworkStatus {
  const [status, setStatus] = useState<CanvasNetworkStatus>(() => ({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    ...readConnection(),
    throughputKbps: averageThroughputKbps(),
  }));

  useEffect(() => {
    const sync = () => {
      setStatus({
        online: navigator.onLine,
        ...readConnection(),
        throughputKbps: averageThroughputKbps(),
      });
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("canvas:network-transfer", sync);
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
    conn?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("canvas:network-transfer", sync);
      conn?.removeEventListener?.("change", sync);
    };
  }, []);

  return status;
}
