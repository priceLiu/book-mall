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
const rttSamples: number[] = [];
const MAX_SAMPLES = 8;
const MAX_RTT_SAMPLES = 5;
const APP_RTT_POLL_MS = 30_000;

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

function averageMeasuredRttMs(): number | null {
  if (rttSamples.length === 0) return null;
  const sum = rttSamples.reduce((a, b) => a + b, 0);
  return Math.round(sum / rttSamples.length);
}

function resolveEffectiveRttMs(connRttMs: number | null): number | null {
  if (connRttMs != null && connRttMs > 0) return connRttMs;
  return averageMeasuredRttMs();
}

/** Safari 等无 Network Information API 时，用同域 lite session 估算 RTT */
export async function measureCanvasAppRttMs(): Promise<number | null> {
  if (typeof performance === "undefined" || typeof fetch === "undefined") {
    return null;
  }
  const t0 = performance.now();
  try {
    const res = await fetch("/api/tools-session?lite=1", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    await res.json().catch(() => null);
    if (!res.ok) return null;
    const ms = performance.now() - t0;
    return ms > 0 && Number.isFinite(ms) ? Math.round(ms) : null;
  } catch {
    return null;
  }
}

export function recordCanvasAppRttSample(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  rttSamples.push(ms);
  if (rttSamples.length > MAX_RTT_SAMPLES) rttSamples.shift();
  window.dispatchEvent(new CustomEvent("canvas:network-rtt"));
}

export function formatCanvasNetworkStatusLabel(status: CanvasNetworkStatus): string {
  if (!status.online) return "离线";
  const parts: string[] = [];
  if (status.effectiveType) parts.push(status.effectiveType.toUpperCase());
  if (status.rttMs != null && status.rttMs > 0) {
    parts.push(`RTT ${Math.round(status.rttMs)}ms`);
  }
  if (status.downlinkMbps != null && status.downlinkMbps > 0) {
    parts.push(`${status.downlinkMbps.toFixed(1)} Mbps`);
  } else if (status.throughputKbps != null && status.throughputKbps > 0) {
    parts.push(`${status.throughputKbps.toFixed(0)} KB/s`);
  }
  return parts.join(" · ") || "在线";
}

/** 顶栏网络 · 连接类型 / RTT（不含网速） */
export function formatCanvasNetworkConnectionLabel(
  status: CanvasNetworkStatus,
): string {
  if (!status.online) return "离线";
  const parts: string[] = [];
  if (status.effectiveType) parts.push(status.effectiveType.toUpperCase());
  if (status.rttMs != null && status.rttMs > 0) {
    parts.push(`RTT ${Math.round(status.rttMs)}ms`);
  }
  return parts.join(" · ") || "在线";
}

/** 顶栏网络 · 网速（右侧展示） */
export function formatCanvasNetworkSpeedLabel(
  status: CanvasNetworkStatus,
): string | null {
  if (!status.online) return null;
  if (status.downlinkMbps != null && status.downlinkMbps > 0) {
    return `${status.downlinkMbps.toFixed(1)} Mbps`;
  }
  if (status.throughputKbps != null && status.throughputKbps > 0) {
    return `${status.throughputKbps.toFixed(0)} KB/s`;
  }
  return null;
}

function buildNetworkStatus(): CanvasNetworkStatus {
  const conn = readConnection();
  return {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    effectiveType: conn.effectiveType,
    downlinkMbps: conn.downlinkMbps,
    rttMs: resolveEffectiveRttMs(conn.rttMs),
    throughputKbps: averageThroughputKbps(),
  };
}

export function useCanvasNetworkStatus(): CanvasNetworkStatus {
  const [status, setStatus] = useState<CanvasNetworkStatus>(() =>
    buildNetworkStatus(),
  );

  useEffect(() => {
    const sync = () => {
      setStatus(buildNetworkStatus());
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("canvas:network-transfer", sync);
    window.addEventListener("canvas:network-rtt", sync);
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
    conn?.addEventListener?.("change", sync);

    let cancelled = false;
    const ping = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const ms = await measureCanvasAppRttMs();
      if (cancelled || ms == null) return;
      recordCanvasAppRttSample(ms);
    };
    void ping();
    const pingId = window.setInterval(() => void ping(), APP_RTT_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pingId);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("canvas:network-transfer", sync);
      window.removeEventListener("canvas:network-rtt", sync);
      conn?.removeEventListener?.("change", sync);
    };
  }, []);

  return status;
}
