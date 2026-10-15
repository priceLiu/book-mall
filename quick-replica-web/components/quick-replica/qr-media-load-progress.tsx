"use client";

/** 全屏媒体加载进度（图片 / 视频下载） */
export function QrMediaLoadProgress({
  active,
  ratio,
  indeterminate,
  label,
}: {
  active: boolean;
  ratio: number;
  indeterminate?: boolean;
  label?: string;
}) {
  if (!active) return null;

  const clamped = Math.max(0, Math.min(1, ratio));
  const pct = Math.round(clamped * 100);
  const showIndeterminate = indeterminate ?? clamped <= 0;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-24 z-[85] flex flex-col items-center gap-2.5 px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-[min(360px,78vw)]">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          {showIndeterminate ? (
            <div className="qr-world-load-bar h-full w-2/5 rounded-full" />
          ) : (
            <div
              className="h-full rounded-full bg-[var(--qr-brand)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(6, pct)}%` }}
            />
          )}
        </div>
      </div>
      <span className="text-xs tracking-wide text-white/55">
        {label ?? (showIndeterminate ? "加载中…" : `${pct}%`)}
      </span>
    </div>
  );
}
