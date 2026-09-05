"use client";

import { Button } from "@/components/ui/button";

import { AiSpaceOverlay } from "./ai-space-overlay";

export type AiSpaceConfirmRequest = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
};

/**
 * AI 空间通用确认弹层。破坏性删除须由调用方发起 **两次** 确认
 * （见 .cursor/rules/destructive-delete-confirmation.mdc）。
 */
export function AiSpaceConfirmDialog({
  request,
  busy,
  onCancel,
}: {
  request: AiSpaceConfirmRequest | null;
  busy?: boolean;
  onCancel: () => void;
}) {
  if (!request) return null;

  const destructive = request.variant === "destructive";

  return (
    <AiSpaceOverlay
      level="confirm"
      label={request.title}
      onClose={busy ? undefined : onCancel}
    >
      <div className="w-full max-w-md rounded-lg border border-[#d0d7de] bg-white p-5 shadow-lg">
        <h2 className="text-base font-semibold text-[#1f2328]">{request.title}</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#656d76]">
          {request.message}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void request.onConfirm()}
          >
            {busy ? "处理中…" : (request.confirmLabel ?? "确定")}
          </Button>
        </div>
      </div>
    </AiSpaceOverlay>
  );
}
