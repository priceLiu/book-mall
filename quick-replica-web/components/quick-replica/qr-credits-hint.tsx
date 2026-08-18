"use client";

import type { QrCreditsPreview } from "@/lib/qr-credits-preview";

type Props = {
  preview: QrCreditsPreview | null;
  loading?: boolean;
  className?: string;
};

/** 产生钮旁积分预估（平台代付 · 约 N 积分）。 */
export function QrCreditsHint({ preview, loading = false, className = "" }: Props) {
  if (loading) {
    return (
      <p
        className={`text-[11px] text-[var(--qr-text-muted)] ${className}`}
        aria-live="polite"
      >
        估算中…
      </p>
    );
  }

  if (!preview) return null;

  const title =
    preview.reason ??
    (preview.balance != null
      ? `余额 ${preview.balance} · 预扣 ${preview.reserved ?? 0}`
      : undefined);

  const tone = "text-yellow-300/90";

  return (
    <p
      className={`text-[11px] tabular-nums ${tone} ${className}`}
      title={title}
      aria-live="polite"
    >
      {preview.label}
    </p>
  );
}
