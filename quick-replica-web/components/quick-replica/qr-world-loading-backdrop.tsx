"use client";

/** 加载阶段占位：避免纯黑屏，对齐 Marble 粒子氛围 */
export function QrWorldLoadingBackdrop({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[101] overflow-hidden"
      aria-hidden
      style={{ background: "radial-gradient(ellipse at 50% 40%, #0d1524 0%, #060910 70%)" }}
    >
      <div className="qr-world-loading-stars absolute inset-0 opacity-80" />
      <div className="qr-world-loading-glow absolute left-1/2 top-[42%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(120,160,255,0.12)] blur-3xl" />
    </div>
  );
}
