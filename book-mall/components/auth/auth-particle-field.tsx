"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
};

const LINK_DISTANCE = 130;

function particlePalette(isDark: boolean) {
  return isDark
    ? { rgb: "125, 211, 252", line: 0.18, dot: 1 }
    : { rgb: "14, 165, 233", line: 0.28, dot: 0.85 };
}

function createParticles(width: number, height: number): Particle[] {
  const count = Math.min(160, Math.max(56, Math.floor((width * height) / 9000)));
  return Array.from({ length: count }, () => {
    const speed = 0.15 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1 + Math.random() * 1.8,
      alpha: 0.25 + Math.random() * 0.45,
    };
  });
}

type Props = {
  className?: string;
};

/** 注册页粒子网络背景（Canvas） */
export function AuthParticleField({ className }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark =
    resolvedTheme === "dark" ||
    (resolvedTheme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const isLight = resolvedTheme === "light";
  const themeDark = isLight ? false : isDark;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const rafRef = useRef<number>(0);
  const paletteRef = useRef(particlePalette(themeDark));

  paletteRef.current = particlePalette(themeDark);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = wrap;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = createParticles(w, h);
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) return;

      const particles = particlesRef.current;

      if (!reducedMotion) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          p.x = Math.max(0, Math.min(w, p.x));
          p.y = Math.max(0, Math.min(h, p.y));
        }
      }

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;
          const pal = paletteRef.current;
          const lineAlpha = (1 - dist / LINK_DISTANCE) * pal.line;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${pal.rgb}, ${lineAlpha})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        const pal = paletteRef.current;
        ctx.fillStyle = `rgba(${pal.rgb}, ${p.alpha * pal.dot})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [themeDark]);

  return (
    <div
      ref={wrapRef}
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
