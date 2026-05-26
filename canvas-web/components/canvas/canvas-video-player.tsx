"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CanvasVideoPlayer({
  src,
  className,
  autoPlay = false,
  poster,
  persistentControls = false,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  poster?: string;
  /** 弹层预览：控制条常显，不单靠 hover */
  persistentControls?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen?.();
  }, []);

  const seek = useCallback((ratio: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, ratio * v.duration));
  }, []);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (!autoPlay || !ready) return;
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => {
      /* 浏览器策略拦截 autoplay 时忽略 */
    });
  }, [autoPlay, ready]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group/vp relative flex aspect-video w-full max-w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#14141f] via-[#0d0d12] to-black shadow-2xl",
        className,
      )}
    >
      {!ready ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1c1c28]/95 to-black/95">
          <Loader2 className="size-9 animate-spin text-[#fdba74]" />
          <p className="text-[11px] text-white/45">视频加载中…</p>
        </div>
      ) : null}

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        muted={muted}
        preload="metadata"
        className={cn(
          "max-h-full max-w-full object-contain transition-opacity duration-300",
          ready ? "opacity-100" : "opacity-0",
        )}
        onLoadedData={() => setReady(true)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          setReady(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />

      {ready && !playing ? (
        <button
          type="button"
          aria-label="播放"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition hover:bg-black/35"
          onClick={togglePlay}
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/55 shadow-xl backdrop-blur-sm">
            <Play className="ml-1 size-7 fill-white text-white" />
          </span>
        </button>
      ) : null}

      {ready ? (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-2.5 pt-8 transition-opacity",
            persistentControls
              ? "opacity-100"
              : "opacity-0 group-hover/vp:opacity-100 group-focus-within/vp:opacity-100",
          )}
        >
          <input
            type="range"
            min={0}
            max={1000}
            value={
              duration > 0 ? Math.round((current / duration) * 1000) : 0
            }
            aria-label="进度"
            className="nodrag mb-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[#fb923c]"
            onChange={(e) => seek(Number(e.target.value) / 1000)}
          />
          <div className="flex items-center gap-2 text-white/90">
            <button
              type="button"
              aria-label={playing ? "暂停" : "播放"}
              className="grid size-8 place-items-center rounded-full hover:bg-white/10"
              onClick={togglePlay}
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="ml-0.5 size-4" />
              )}
            </button>
            <span className="min-w-[72px] font-mono text-[10px] text-white/60">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              aria-label={muted ? "取消静音" : "静音"}
              className="ml-auto grid size-8 place-items-center rounded-full hover:bg-white/10"
              onClick={toggleMute}
            >
              {muted ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="全屏"
              className="grid size-8 place-items-center rounded-full hover:bg-white/10"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
