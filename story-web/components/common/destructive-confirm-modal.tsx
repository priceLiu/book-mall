"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/common/modal-portal";

/**
 * 通用「破坏性删除」二次确认弹窗。
 * 严格遵循工作区规则 destructive-delete-confirmation.mdc：
 *   1) 第一次：说明删除对象
 *   2) 第二次：明确「不可恢复」；若涉及 OSS 必须写明「云端存储（OSS）」
 *
 * 只有在 step=2 时才会触发 onConfirm；onConfirm 内的真实 API 调用由调用方负责。
 */
export type DestructiveConfirmContent = {
  /** 第一步标题，例如「删除项目」 */
  step1Title: string;
  /** 第一步内容（你将要删除的对象） */
  step1Body: React.ReactNode;
  /** 第一步主按钮文案，默认「下一步」 */
  step1ConfirmLabel?: string;
  /** 第二步标题 */
  step2Title: string;
  /** 第二步内容（必须包含「不可恢复」+ 涉及 OSS 时写明「云端存储（OSS）」） */
  step2Body: React.ReactNode;
  /** 第二步主按钮文案，默认「确认删除」 */
  step2ConfirmLabel?: string;
};

type Props = {
  open: boolean;
  content: DestructiveConfirmContent;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

export function DestructiveConfirmModal({
  open,
  content,
  onCancel,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[var(--story-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={
                step === 1 ? "size-5 text-amber-400" : "size-5 text-red-400"
              }
            />
            <h3 className="font-medium text-white">
              {step === 1 ? content.step1Title : content.step2Title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-[var(--story-muted)] hover:text-white disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3 p-5 text-sm text-white/90">
          {step === 1 ? content.step1Body : content.step2Body}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={busy}
            className={
              step === 1
                ? "rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-60"
                : "rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-60"
            }
          >
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                执行中…
              </span>
            ) : step === 1 ? (
              (content.step1ConfirmLabel ?? "下一步")
            ) : (
              (content.step2ConfirmLabel ?? "确认删除")
            )}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
