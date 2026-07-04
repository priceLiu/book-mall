"use client";

import { useEffect, useRef } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  progress: number;
  previewUrl?: string;
  phase: "fetch" | "splat";
  fadingOut?: boolean;
};

type Particle = {
  angle: number;
  radius: number;
  baseRadius: number;
  speed: number;
  size: number;
  hue: number;
  twinkle: number;
  twinkleSpeed: number;
};

/** 量子粒子加载动画：漂移 + 微收敛 + 闪烁的光点场，模拟 Marble 世界材质化前的状态 */
function QuantumParticleField({ intensity }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(220, Math.round((width * height) / 7000));
      const maxR = Math.hypot(width, height) / 2;
      particles = Array.from({ length: count }, () => {
        const baseRadius = rand(maxR * 0.12, maxR * 0.95);
        return {
          angle: rand(0, Math.PI * 2),
          radius: baseRadius,
          baseRadius,
          speed: rand(-0.0016, 0.0016),
          size: rand(0.6, 2.4),
          hue: rand(200, 225),
          twinkle: rand(0, Math.PI * 2),
          twinkleSpeed: rand(0.02, 0.06),
        };
      });
    };

    build();
    const onResize = () => build();
    window.addEventListener("resize", onResize);

    const cx = () => width / 2;
    const cy = () => height * 0.46;

    const draw = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const conv = 0.9 + intensityRef.current * 0.1;
      const centerX = cx();
      const centerY = cy();

      for (const p of particles) {
        p.angle += p.speed;
        p.twinkle += p.twinkleSpeed;
        const r = p.baseRadius * conv;
        const x = centerX + Math.cos(p.angle) * r;
        const y = centerY + Math.sin(p.angle) * r * 0.62;
        const flicker = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(p.twinkle));
        const alpha = flicker * (0.35 + intensityRef.current * 0.5);
        const size = p.size * (1 + intensityRef.current * 0.3);

        const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 78%, ${alpha})`);
        grad.addColorStop(1, "hsla(215, 90%, 60%, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, size * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}

export function QrWorldLoadingScreen({
  title,
  subtitle,
  progress,
  previewUrl,
  phase,
  fadingOut = false,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);
  const label = phase === "fetch" ? "正在准备场景…" : "正在构建 3D 世界…";

  return (
    <div
      className={`absolute inset-0 z-[102] flex flex-col items-center justify-center overflow-hidden bg-black transition-opacity duration-500 ${
        fadingOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl"
        />
      ) : null}

      <QuantumParticleField intensity={clamped} />

      <div className="qr-world-load-vignette pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex flex-col items-center gap-5 px-6">
        {title ? (
          <p className="max-w-md text-center text-sm font-medium tracking-wide text-white/90">
            {title}
          </p>
        ) : null}
        <p className="text-center text-xs text-white/55">{subtitle ?? label}</p>

        <div className="w-[min(280px,70vw)]">
          <div className="h-[2px] overflow-hidden rounded-full bg-white/10">
            <div
              className="qr-world-load-bar h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(pct, phase === "fetch" ? 6 : 10)}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[10px] tabular-nums tracking-[0.3em] text-white/40">
            {phase === "fetch" && progress <= 0 ? "CONNECTING" : `${pct}%`}
          </p>
        </div>
      </div>
    </div>
  );
}
