"use client";

import { useEffect, useRef } from "react";

import { syntheticAudioPeaks } from "./compose-audio-peaks";
import { cn } from "./cn";

export function ComposeSegmentAudioWaveform({
  peaks,
  widthPx,
  label,
  className,
}: {
  peaks?: number[];
  widthPx: number;
  label?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const h = canvas.clientHeight || 36;
    const w = Math.max(8, Math.floor(widthPx));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0c1f33");
    grad.addColorStop(1, "#081018");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const bars = peaks?.length ? peaks : syntheticAudioPeaks(Math.min(64, Math.max(24, Math.floor(w / 3))));
    const barCount = bars.length;
    const barW = w / barCount;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    for (let i = 0; i < barCount; i++) {
      const amp = bars[i] ?? 0;
      const barH = Math.max(2, amp * (h - 6));
      const x = i * barW;
      ctx.fillStyle = "rgba(56, 189, 248, 0.92)";
      ctx.fillRect(x + barW * 0.12, (h - barH) / 2, barW * 0.76, barH);
      ctx.fillStyle = "rgba(147, 197, 253, 0.35)";
      ctx.fillRect(x + barW * 0.12, h / 2, barW * 0.76, barH / 2);
    }
  }, [peaks, widthPx]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      {label ? (
        <span className="pointer-events-none absolute left-1 top-0.5 max-w-[85%] truncate rounded bg-[#0a1628]/80 px-1 text-[9px] text-sky-200/90">
          {label}
        </span>
      ) : null}
    </div>
  );
}
