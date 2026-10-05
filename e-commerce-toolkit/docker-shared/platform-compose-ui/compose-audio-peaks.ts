"use client";

import { useEffect, useMemo, useState } from "react";

import type { ComposeWorkbenchClip } from "./types";

const peaksCache = new Map<string, number[]>();

function peaksCacheKey(url: string): string {
  return url.trim();
}

/** 解码失败时的占位波形（稳定伪随机，便于识别「已连接」） */
export function syntheticAudioPeaks(barCount: number, seed = 0): number[] {
  const out: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < barCount; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const r = (s % 1000) / 1000;
    const env = 0.35 + 0.65 * Math.sin((i / barCount) * Math.PI);
    out.push(Math.min(1, 0.15 + r * 0.85 * env));
  }
  return out;
}

function seedFromUrl(url: string): number {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export async function loadAudioPeaksForUrl(
  url: string,
  barCount = 72,
): Promise<number[]> {
  const key = peaksCacheKey(url);
  const cached = peaksCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const channel = decoded.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channel.length / barCount));
      const peaks: number[] = [];
      for (let i = 0; i < barCount; i++) {
        let max = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const v = Math.abs(channel[start + j] ?? 0);
          if (v > max) max = v;
        }
        peaks.push(max);
      }
      const peakMax = Math.max(...peaks, 0.001);
      const normalized = peaks.map((p) => p / peakMax);
      peaksCache.set(key, normalized);
      return normalized;
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch {
    const fallback = syntheticAudioPeaks(barCount, seedFromUrl(url));
    peaksCache.set(key, fallback);
    return fallback;
  }
}

export function useComposeAudioPeaksLoader(
  clips: ComposeWorkbenchClip[],
  active: boolean,
) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const urls = [
      ...new Set(
        clips.map((c) => c.audioUrl?.trim()).filter((u): u is string => Boolean(u)),
      ),
    ];
    if (urls.length === 0) return;
    let cancelled = false;
    void Promise.all(urls.map((u) => loadAudioPeaksForUrl(u).catch(() => undefined))).finally(
      () => {
        if (!cancelled) setTick((n) => n + 1);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, clips]);

  const audioPeaksByUrl = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const c of clips) {
      const u = c.audioUrl?.trim();
      if (!u || out[u]) continue;
      const hit = peaksCache.get(peaksCacheKey(u));
      if (hit) out[u] = hit;
    }
    return out;
  }, [clips, tick]);

  return { audioPeaksByUrl };
}
