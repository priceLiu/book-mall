"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  audioAnalysisCacheKey,
  getCachedAudioAnalysis,
  setCachedAudioAnalysis,
  type AudioAnalysisResult,
} from "./compose-audio-analysis-cache";
import type { ComposeWorkbenchClip } from "./types";

export type { AudioAnalysisResult };

function barCountForDuration(durationSec: number): number {
  return Math.max(16, Math.min(240, Math.round(durationSec * 24)));
}

/** 解码失败：无假波形，仅静音占位 */
export const SILENT_AUDIO_PEAKS: number[] = [];

export async function loadAudioAnalysisForUrl(
  url: string,
  opts?: { force?: boolean },
): Promise<AudioAnalysisResult | null> {
  const key = audioAnalysisCacheKey(url);
  if (!key) return null;
  if (!opts?.force) {
    const cached = getCachedAudioAnalysis(url);
    if (cached) return cached;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const durationSec = Math.max(0.05, decoded.duration);
      const barCount = barCountForDuration(durationSec);
      const channel = decoded.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channel.length / barCount));
      const peaks: number[] = [];
      for (let i = 0; i < barCount; i++) {
        let sumSq = 0;
        let count = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const v = channel[start + j] ?? 0;
          sumSq += v * v;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
        peaks.push(rms);
      }
      const peakMax = Math.max(...peaks, 0);
      if (peakMax <= 0.00001) {
        return null;
      }
      const normalized = peaks.map((p) => (p <= 0.00001 ? 0 : p / peakMax));
      const result: AudioAnalysisResult = { peaks: normalized, durationSec };
      setCachedAudioAnalysis(url, result);
      return result;
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

/** @deprecated 使用 loadAudioAnalysisForUrl */
export async function loadAudioPeaksForUrl(
  url: string,
  barCount = 72,
): Promise<number[]> {
  void barCount;
  const a = await loadAudioAnalysisForUrl(url);
  return a?.peaks ?? SILENT_AUDIO_PEAKS;
}

function audioUrlsKey(clips: ComposeWorkbenchClip[]): string {
  const parts = clips
    .map((c) => {
      const u = c.audioUrl?.trim();
      if (!u) return "";
      const mk = c.audioMediaKey?.trim() ?? u;
      return `${c.id}\0${u}\0${mk}`;
    })
    .filter(Boolean)
    .sort();
  return parts.join("\n");
}

export function useComposeAudioPeaksLoader(
  clips: ComposeWorkbenchClip[],
  active: boolean,
) {
  const [tick, setTick] = useState(0);
  const urlsKey = useMemo(() => audioUrlsKey(clips), [clips]);
  const lastUrlsKeyRef = useRef("");

  useEffect(() => {
    if (!active || !urlsKey) return;
    const urls = [
      ...new Set(
        urlsKey
          .split("\n")
          .map((line) => line.split("\0")[1]?.trim())
          .filter((u): u is string => Boolean(u)),
      ),
    ];
    if (urls.length === 0) return;
    const mediaKeyChanged = lastUrlsKeyRef.current !== urlsKey;
    lastUrlsKeyRef.current = urlsKey;
    let cancelled = false;
    void Promise.all(
      urls.map((u) =>
        loadAudioAnalysisForUrl(u, {
          force: mediaKeyChanged || !getCachedAudioAnalysis(u),
        }).catch(() => null),
      ),
    ).finally(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [active, urlsKey]);

  const { audioPeaksByUrl, audioDurationByUrl } = useMemo(() => {
    const peaksOut: Record<string, number[]> = {};
    const durOut: Record<string, number> = {};
    for (const c of clips) {
      const u = c.audioUrl?.trim();
      if (!u || peaksOut[u]) continue;
      const hit = getCachedAudioAnalysis(u);
      if (hit) {
        peaksOut[u] = hit.peaks;
        durOut[u] = hit.durationSec;
      }
    }
    return { audioPeaksByUrl: peaksOut, audioDurationByUrl: durOut };
  }, [clips, tick]);

  return { audioPeaksByUrl, audioDurationByUrl };
}
