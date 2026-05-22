"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/common/modal-portal";

type ExtraSubmit = {
  /** 默认 "保存并生成" */
  label: string;
  /** 进行中文案，默认 "提交中…" */
  savingLabel?: string;
  /** 成功提示文案，默认 "已提交生成" */
  successLabel?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 禁用时的 tooltip 说明 */
  disabledTitle?: string;
  /** 点击后的处理；返回 Promise 时 modal 会显示进度反馈 */
  onClick: (value: string) => void | Promise<void>;
};

type PromptEditModalProps = {
  open: boolean;
  title: string;
  value: string;
  /** textarea 行数，默认 8；故事大纲等长文本可调更高 */
  rows?: number;
  /** modal 主体最大宽度类，默认 max-w-3xl */
  maxWidthClass?: string;
  /** textarea 上方副标题/提示 */
  fieldLabel?: string;
  onClose: () => void;
  /**
   * 返回 Promise 时，modal 会显示「保存中…」→「已保存」并自动关闭；
   * 抛错时，错误信息留在 modal 内，用户可改完再试。
   */
  onSave: (value: string) => void | Promise<void>;
  /** 可选的「保存并生成」次按钮 */
  extraSubmit?: ExtraSubmit;
};

export function PromptEditModal({
  open,
  title,
  value,
  rows = 8,
  maxWidthClass = "max-w-3xl",
  fieldLabel = "提示词",
  onClose,
  onSave,
  extraSubmit,
}: PromptEditModalProps) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState<null | "save" | "extra">(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSaveError(null);
      setHint(null);
      setBusy(null);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const runWith = async (
    kind: "save" | "extra",
    successLabel: string,
    fn: (val: string) => void | Promise<void>,
  ) => {
    if (busy) return;
    setBusy(kind);
    setSaveError(null);
    try {
      await fn(draft.trim());
      setHint(successLabel);
      setTimeout(() => {
        setHint(null);
        onClose();
      }, 600);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () => runWith("save", "已保存", onSave);
  const handleExtra = () => {
    if (!extraSubmit) return;
    return runWith(
      "extra",
      extraSubmit.successLabel ?? "已提交生成",
      extraSubmit.onClick,
    );
  };

  const isBusy = busy !== null;
  const draftEmpty = !draft.trim();

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[var(--story-surface)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-medium text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-[var(--story-muted)] transition hover:text-white disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">
          <label className="block text-xs text-[var(--story-muted)]">{fieldLabel}</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isBusy}
            rows={rows}
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
          />

          {saveError ? (
            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {saveError}
            </p>
          ) : null}
          {hint ? (
            <p className="mt-3 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              <Check className="size-3" />
              {hint}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isBusy || draftEmpty}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:opacity-60"
            >
              {busy === "save" ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  保存中…
                </span>
              ) : (
                "仅保存"
              )}
            </button>
            {extraSubmit ? (
              <button
                type="button"
                onClick={() => void handleExtra()}
                disabled={isBusy || draftEmpty || extraSubmit.disabled}
                title={
                  extraSubmit.disabled ? extraSubmit.disabledTitle : undefined
                }
                className="twenty-btn !rounded-lg disabled:opacity-60"
              >
                {busy === "extra" ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="mr-2 size-3 animate-spin" />
                    {extraSubmit.savingLabel ?? "提交中…"}
                  </span>
                ) : (
                  extraSubmit.label
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
