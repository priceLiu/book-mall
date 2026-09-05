"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { LIBTV_AUDIO_MINI_ICON_SRC } from "@/lib/canvas/libtv-node-chrome";

export { resolveLibtvAudioDisplayTitle } from "@/lib/canvas/libtv-audio-display-title";

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  src?: string;
  title: string;
  /** 已生成：播放/拖拽进度可交互 */
  controlsEnabled: boolean;
  /** 画布节点内：除播放/进度外区域可拖节点 */
  passNodeDrag?: boolean;
  className?: string;
  onMediaError?: () => void;
};

/** 画布音频节点 · 迷你播放器（460×74 内宽） */
export function LibtvMiniAudioPlayer({
  src,
  title,
  controlsEnabled,
  passNodeDrag = false,
  className,
  onMediaError,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !controlsEnabled) return;
    if (playing) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [playing, src, controlsEnabled]);

  const progress = duration > 0 ? current / duration : 0;

  const seekToRatio = useCallback(
    (ratio: number) => {
      const el = audioRef.current;
      if (!el || !controlsEnabled || !Number.isFinite(el.duration)) return;
      const next = Math.min(Math.max(ratio, 0), 1) * el.duration;
      el.currentTime = next;
      setCurrent(next);
    },
    [controlsEnabled],
  );

  const onTrackPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !controlsEnabled) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekToRatio((clientX - rect.left) / rect.width);
    },
    [controlsEnabled, seekToRatio],
  );

  return (
    <div
      className={cn(
        "flex h-[74px] w-full max-w-full items-center rounded-[12px] bg-gradient-to-r from-[#2E4A64] to-[#2B5547]",
        className,
      )}
      role="document"
      aria-label="Mini audio player"
    >
      {src && controlsEnabled ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
          onError={() => onMediaError?.()}
        />
      ) : null}

      <div className="flex shrink-0 py-3 ps-[18px] pe-[22px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" width={50} height={50} src={LIBTV_AUDIO_MINI_ICON_SRC} draggable={false} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-y-1 py-3 pe-6">
        <div className="truncate text-[14px] font-medium text-white">{title}</div>

        <div
          className={cn(
            "flex items-center gap-x-2",
            !controlsEnabled && "pointer-events-none",
          )}
        >
          <button
            type="button"
            className={cn(
              "flex size-4 shrink-0 items-center justify-center transition-opacity",
              controlsEnabled && "nodrag",
              controlsEnabled
                ? "text-white hover:opacity-80"
                : "text-white/25",
            )}
            aria-label={playing ? "暂停" : "播放"}
            disabled={!controlsEnabled}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing && controlsEnabled ? (
              <span className="flex gap-0.5">
                <span className="h-3 w-[3px] rounded-sm bg-current" />
                <span className="h-3 w-[3px] rounded-sm bg-current" />
              </span>
            ) : (
              <span
                className={cn(
                  "h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent",
                  controlsEnabled ? "border-l-white" : "border-l-white/25",
                )}
              />
            )}
          </button>

          <div
            className={cn(
              "shrink-0 text-[11px] font-medium tabular-nums",
              controlsEnabled ? "text-white/55" : "text-white/25",
            )}
          >
            {controlsEnabled
              ? `${formatAudioTime(current)} / ${formatAudioTime(duration)}`
              : "00:00 / 00:00"}
          </div>

          <div
            ref={trackRef}
            className={cn(
              "relative flex-1 py-2",
              controlsEnabled ? "nodrag cursor-pointer" : "cursor-default",
            )}
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={controlsEnabled ? duration : 0}
            aria-valuenow={controlsEnabled ? current : 0}
            aria-disabled={!controlsEnabled}
            tabIndex={controlsEnabled ? 0 : -1}
            onClick={(e) => {
              if (!controlsEnabled) return;
              onTrackPointer(e.clientX);
            }}
            onKeyDown={(e) => {
              if (!controlsEnabled) return;
              if (e.key === "ArrowRight") seekToRatio(progress + 0.05);
              if (e.key === "ArrowLeft") seekToRatio(progress - 0.05);
            }}
          >
            <div
              className={cn(
                "relative h-[2px] w-full rounded-full",
                controlsEnabled ? "bg-white/20" : "bg-white/15",
              )}
            >
              {controlsEnabled ? (
                <>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                  />
                  <div
                    className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-white shadow-lg"
                    style={{
                      left: `${Math.min(100, Math.max(0, progress * 100))}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
