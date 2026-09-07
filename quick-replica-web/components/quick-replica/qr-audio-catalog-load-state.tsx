"use client";

/** 声音目录加载 / 失败占位（避免 error 时无限 skeleton） */
export function QrAudioCatalogLoadState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="qr-skeleton h-20 w-full rounded-2xl" />
        <div className="qr-skeleton min-h-[360px] w-full rounded-2xl" />
        <div className="qr-skeleton h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-sm text-[var(--qr-text-secondary)]">
        {error ?? "声音目录加载失败"}
      </p>
      <p className="text-xs text-[var(--qr-text-muted)]">
        若 dev:all 刚启动，book-mall 编译完成后点重试即可。
      </p>
      <button type="button" className="qr-btn-secondary text-xs" onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
