"use client";

import { useCallback, useRef, type VideoHTMLAttributes } from "react";

/** 鼠标悬停自动静音循环播放，移出暂停并回到开头 */
export function QrHoverVideo({
  resetOnLeave = true,
  ...props
}: VideoHTMLAttributes<HTMLVideoElement> & { resetOnLeave?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  const onEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    if (resetOnLeave) el.currentTime = 0;
  }, [resetOnLeave]);

  return (
    <video
      {...props}
      ref={ref}
      muted
      loop
      playsInline
      onMouseEnter={(e) => {
        props.onMouseEnter?.(e);
        onEnter();
      }}
      onMouseLeave={(e) => {
        props.onMouseLeave?.(e);
        onLeave();
      }}
    />
  );
}
