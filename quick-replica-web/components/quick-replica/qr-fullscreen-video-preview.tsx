"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { QrMediaLoadProgress } from "@/components/quick-replica/qr-media-load-progress";

/** 全屏视频播放（带原生 controls） */
export function QrFullscreenVideoPreview({
  src,
  poster,
  title,
  onClose,
}: {
  src: string;
  poster?: string;
  title?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(true);
  const [ready, setReady] = useState(false);

  const updateBufferProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      setIndeterminate(true);
      return;
    }
    const ranges = video.buffered;
    if (ranges.length === 0) {
      setIndeterminate(true);
      return;
    }
    const end = ranges.end(ranges.length - 1);
    setIndeterminate(false);
    setProgress(Math.min(1, end / duration));
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    setProgress(0);
    setIndeterminate(true);
    setReady(false);
  }, [src]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `视频播放：${title}` : "视频播放"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
        aria-label="关闭"
      />

      <QrMediaLoadProgress
        active={!ready}
        ratio={progress}
        indeterminate={indeterminate}
        label={indeterminate ? "加载视频…" : undefined}
      />

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-12 pt-14"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="auto"
          className={`pointer-events-auto max-h-[calc(100dvh-7rem)] max-w-[min(96vw,100%)] rounded-xl object-contain transition-opacity duration-200${ready ? " opacity-100" : " opacity-0"}`}
          onProgress={updateBufferProgress}
          onLoadedMetadata={updateBufferProgress}
          onCanPlay={() => {
            updateBufferProgress();
            setReady(true);
            const video = videoRef.current;
            if (video) void video.play().catch(() => undefined);
          }}
          onWaiting={() => {
            setReady(false);
            setIndeterminate(true);
          }}
          onPlaying={() => setReady(true)}
          onError={() => setReady(true)}
        />
      </div>

      <button
        type="button"
        className="absolute right-4 top-4 z-30 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/90 hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="关闭"
      >
        <X className="size-5" />
      </button>
    </div>,
    document.body,
  );
}
