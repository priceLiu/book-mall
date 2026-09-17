"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const TAU = Math.PI * 2;

function hash01(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export type DotGridGeneratingVariant = "cyan" | "violet";

type DotGridGeneratingBackgroundProps = {
  variant?: DotGridGeneratingVariant;
  className?: string;
};

/**
 * 生图 stage · 点阵随机缓亮（初版效果）。
 * 配合 LibtvMediaGeneratingState 扫光 + RefreshCw。
 */
export function DotGridGeneratingBackground({
  variant = "violet",
  className,
}: DotGridGeneratingBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rgb =
      variant === "violet" ? ([167, 139, 250] as const) : ([34, 211, 238] as const);
    const bg = "#0c0c0f";
    const spacing = 16;
    const dotR = 1.1;

    const readSize = (): { width: number; height: number } => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(
        1,
        Math.round(host.offsetWidth || rect.width),
      );
      const height = Math.max(
        1,
        Math.round(host.offsetHeight || rect.height),
      );
      return { width, height };
    };

    const syncCanvasSize = (): { width: number; height: number } => {
      const { width, height } = readSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prev = sizeRef.current;
      if (
        prev.width === width &&
        prev.height === height &&
        prev.dpr === dpr &&
        canvas.width > 0
      ) {
        return { width, height };
      }
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    const draw = (timeMs: number) => {
      const time = timeMs * 0.001;
      const { width, height } = syncCanvasSize();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const offsetX = (width - (cols - 1) * spacing) / 2;
      const offsetY = (height - (rows - 1) * spacing) / 2;
      const reduced = motionQuery.matches;
      const peakAlpha = variant === "violet" ? 0.72 : 0.65;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const phase = hash01(col, row) * TAU;
          const speed = 0.35 + hash01(col + 17, row + 31) * 1.1;
          let glow: number;
          if (reduced) {
            glow = 0.18 + hash01(col * 3, row * 5) * 0.12;
          } else {
            const w1 = 0.5 + 0.5 * Math.sin(time * speed + phase);
            const w2 =
              0.5 + 0.5 * Math.sin(time * speed * 1.43 + phase * 2.17);
            const combined = w1 * w2;
            glow = 0.04 + Math.pow(combined, 2.4) * 0.92;
          }
          const alpha = Math.min(1, glow * peakAlpha);
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
          ctx.beginPath();
          ctx.arc(
            offsetX + col * spacing,
            offsetY + row * spacing,
            dotR + alpha * 0.35,
            0,
            TAU,
          );
          ctx.fill();
        }
      }
    };

    const loop = (t: number) => {
      draw(t);
      rafRef.current = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      sizeRef.current = { width: 0, height: 0, dpr: sizeRef.current.dpr };
      if (motionQuery.matches) draw(0);
    });
    ro.observe(host);

    syncCanvasSize();
    if (motionQuery.matches) {
      draw(0);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    const onMotionChange = () => {
      cancelAnimationFrame(rafRef.current);
      if (motionQuery.matches) {
        draw(0);
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [variant]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "pointer-events-none absolute inset-0 min-h-0 min-w-0",
        className,
      )}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
};
