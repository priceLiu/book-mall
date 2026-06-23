"use client";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="gw-card w-full max-w-md shadow-2xl" role="dialog" aria-modal="true">
        <h3 className="text-lg font-semibold text-[var(--gw-ink)]">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--gw-muted)]">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="gw-btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={danger ? "gw-btn-secondary" : "gw-btn"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
